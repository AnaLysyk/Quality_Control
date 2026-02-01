import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";

import { prisma } from "@/lib/prismaClient";
import { hashPasswordSha256 } from "@/lib/passwordHash";
import { requireGlobalAdminWithStatus } from "@/lib/rbac/requireGlobalAdmin";
import { addAuditLogSafe } from "@/data/auditLogRepository";

export const runtime = "nodejs";

type UserItem = {
  id: string;
  name: string;
  email: string;
  role?: string;
  client_id?: string | null;
  active?: boolean;
  job_title?: string | null;
  linkedin_url?: string | null;
  avatar_url?: string | null;
};

function mapUser(user: { id: string; name: string; email: string; active: boolean }, link?: { role?: string; company_id?: string | null }) {
  const role = (link?.role ?? "user").toLowerCase();
  return {
    id: user.id,
    name: user.name ?? "",
    email: user.email,
    role: role === "admin" ? "client_admin" : "client_user",
    client_id: link?.company_id ?? null,
    active: user.active === true,
    job_title: null,
    linkedin_url: null,
    avatar_url: null,
  };
}

function normalizeRole(input?: string | null) {
  const value = (input ?? "").toLowerCase();
  if (value === "client_admin" || value === "admin" || value === "global_admin") return "admin";
  return "user";
}

export async function GET(req: NextRequest) {
  // Extrai sessão do request (ajuste conforme seu middleware/session)
  const session = (req as any).session || {};
  const userEmail = session.email;
  const userRole = session.role;
  const userCompanyId = session.companyId;

  // Se for admin (role admin/super-admin ou email da admin global), pode ver todos
  const isGlobalAdmin = userRole === 'admin' || userRole === 'super-admin' || userEmail === 'ana.testing.company@gmail.com';

  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("client_id");

  if (!isGlobalAdmin) {
    // Usuário comum só pode ver usuários da própria empresa
    if (!userCompanyId) {
      return NextResponse.json({ error: "Sem empresa vinculada" }, { status: 403 });
    }
    const links = await prisma.userCompany.findMany({
      where: { company_id: userCompanyId },
      include: { user: true },
    });
    const items: UserItem[] = links.map((link) => mapUser(link.user, { role: link.role, company_id: link.company_id }));
    return NextResponse.json({ items }, { status: 200 });
  }

  // Admin pode filtrar por empresa ou ver todos
  if (clientId) {
    const links = await prisma.userCompany.findMany({
      where: { company_id: clientId },
      include: { user: true },
    });
    const items: UserItem[] = links.map((link) => mapUser(link.user, { role: link.role, company_id: link.company_id }));
    return NextResponse.json({ items }, { status: 200 });
  }

  const users = await prisma.user.findMany({
    include: { userCompanies: true },
    orderBy: { created_at: "desc" },
  });

  const items: UserItem[] = users.map((user) => {
    const link = user.userCompanies[0];
    return mapUser(user, link ? { role: link.role, company_id: link.company_id } : undefined);
  });

  return NextResponse.json({ items }, { status: 200 });
}

export async function POST(req: NextRequest) {
  const { admin, status } = await requireGlobalAdminWithStatus(req);
  if (!admin) {
    return NextResponse.json({ error: status === 401 ? "Nao autenticado" : "Sem permissao" }, { status });
  }

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const clientId = typeof body?.client_id === "string" ? body.client_id : null;
  const role = normalizeRole(body?.role);

  if (!name || !email) {
    return NextResponse.json({ error: "Nome e email sao obrigatorios" }, { status: 400 });
  }
  if (!clientId) {
    return NextResponse.json({ error: "Empresa obrigatoria para este perfil" }, { status: 400 });
  }

  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    const tempPassword = hashPasswordSha256(`${Date.now()}-${randomUUID()}`);
    user = await prisma.user.create({
      data: {
        name,
        email,
        password_hash: tempPassword,
        active: true,
      },
    });
  }

  const existing = await prisma.userCompany.findUnique({
    where: { user_id_company_id: { user_id: user.id, company_id: clientId } },
  });
  if (existing) {
    return NextResponse.json({ error: "Usuario ja vinculado" }, { status: 409 });
  }

  await prisma.userCompany.create({
    data: { user_id: user.id, company_id: clientId, role },
  });

  await addAuditLogSafe({
    actorUserId: admin.id,
    actorEmail: admin.email,
    action: "user.created",
    entityType: "user",
    entityId: user.id,
    entityLabel: user.email,
    metadata: { companyId: clientId, role },
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const { admin, status } = await requireGlobalAdminWithStatus(req);
  if (!admin) {
    return NextResponse.json({ error: status === 401 ? "Nao autenticado" : "Sem permissao" }, { status });
  }

  const body = await req.json().catch(() => null);
  const userId = typeof body?.id === "string" ? body.id : "";
  if (!userId) {
    return NextResponse.json({ error: "id obrigatorio" }, { status: 400 });
  }

  const name = typeof body?.name === "string" ? body.name.trim() : null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : null;
  const active = typeof body?.active === "boolean" ? body.active : null;
  const clientId = typeof body?.client_id === "string" ? body.client_id : null;
  const role = normalizeRole(body?.role);

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(name ? { name } : {}),
      ...(email ? { email } : {}),
      ...(active !== null ? { active } : {}),
    },
  }).catch(() => null);

  if (!updated) {
    return NextResponse.json({ error: "Usuario nao encontrado" }, { status: 404 });
  }

  if (clientId) {
    await prisma.userCompany.upsert({
      where: { user_id_company_id: { user_id: userId, company_id: clientId } },
      update: { role },
      create: { user_id: userId, company_id: clientId, role },
    });
  }

  await addAuditLogSafe({
    actorUserId: admin.id,
    actorEmail: admin.email,
    action: "user.updated",
    entityType: "user",
    entityId: updated.id,
    entityLabel: updated.email,
    metadata: { companyId: clientId, role, active },
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
