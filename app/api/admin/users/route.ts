import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";

import { hashPasswordSha256 } from "@/lib/passwordHash";
import { requireGlobalAdminWithStatus } from "@/lib/rbac/requireGlobalAdmin";
import { addAuditLogSafe } from "@/data/auditLogRepository";
import { getAccessContext } from "@/lib/auth/session";
import {
  createLocalUser,
  listLocalLinksForCompany,
  listLocalLinksForUser,
  listLocalUsers,
  normalizeLocalRole,
  updateLocalUser,
  upsertLocalLink,
} from "@/lib/auth/localStore";

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

function mapUser(
  user: { id: string; name: string; email: string; active?: boolean },
  link?: { role?: string | null; companyId?: string | null },
) {
  const role = normalizeLocalRole(link?.role ?? "user");
  return {
    id: user.id,
    name: user.name ?? "",
    email: user.email,
    role: role === "company_admin" ? "client_admin" : "client_user",
    client_id: link?.companyId ?? null,
    active: user.active !== false,
    job_title: null,
    linkedin_url: null,
    avatar_url: null,
  };
}

function normalizeRole(input?: string | null) {
  const value = (input ?? "").toLowerCase();
  if (value === "client_admin" || value === "admin" || value === "global_admin" || value === "company_admin") return "company_admin";
  if (value === "viewer" || value === "client_viewer") return "viewer";
  return "user";
}

export async function GET(req: NextRequest) {
  const access = await getAccessContext(req);
  if (!access) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  }

  const isGlobalAdmin = access.isGlobalAdmin === true || (access.role ?? "").toLowerCase() === "admin";
  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("client_id");

  if (!isGlobalAdmin) {
    if (!access.companyId) {
      return NextResponse.json({ error: "Sem empresa vinculada" }, { status: 403 });
    }
    const links = await listLocalLinksForCompany(access.companyId);
    const users = await listLocalUsers();
    const byId = new Map(users.map((user) => [user.id, user]));
    const items: UserItem[] = links.map((link) => mapUser(byId.get(link.userId) ?? { id: link.userId, name: "", email: "", active: true }, { role: link.role, companyId: link.companyId }));
    return NextResponse.json({ items }, { status: 200 });
  }

  if (clientId) {
    const links = await listLocalLinksForCompany(clientId);
    const users = await listLocalUsers();
    const byId = new Map(users.map((user) => [user.id, user]));
    const items: UserItem[] = links.map((link) => mapUser(byId.get(link.userId) ?? { id: link.userId, name: "", email: "", active: true }, { role: link.role, companyId: link.companyId }));
    return NextResponse.json({ items }, { status: 200 });
  }

  const users = await listLocalUsers();
  const items: UserItem[] = [];
  for (const user of users) {
    const link = (await listLocalLinksForUser(user.id))[0];
    items.push(mapUser(user, link ? { role: link.role, companyId: link.companyId } : undefined));
  }

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
  const capabilities = Array.isArray(body?.capabilities)
    ? body.capabilities.filter((item: unknown) => typeof item === "string")
    : null;

  if (!name || !email) {
    return NextResponse.json({ error: "Nome e email sao obrigatorios" }, { status: 400 });
  }
  if (!clientId) {
    return NextResponse.json({ error: "Empresa obrigatoria para este perfil" }, { status: 400 });
  }

  const tempPassword = hashPasswordSha256(`${Date.now()}-${randomUUID()}`);
  const user = await createLocalUser({
    name,
    email,
    password_hash: tempPassword,
    active: true,
    role: "user",
  });

  await upsertLocalLink({ userId: user.id, companyId: clientId, role, capabilities });

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
  const capabilities = Array.isArray(body?.capabilities)
    ? body.capabilities.filter((item: unknown) => typeof item === "string")
    : null;

  const updated = await updateLocalUser(userId, {
    ...(name ? { name } : {}),
    ...(email ? { email } : {}),
    ...(active !== null ? { active } : {}),
  });

  if (!updated) {
    return NextResponse.json({ error: "Usuario nao encontrado" }, { status: 404 });
  }

  if (clientId) {
    await upsertLocalLink({ userId, companyId: clientId, role, capabilities });
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
