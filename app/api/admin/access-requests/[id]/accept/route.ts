import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";

import { prisma } from "@/lib/prisma";
import { hashPasswordSha256 } from "@/lib/passwordHash";
import { requireGlobalAdminWithStatus } from "@/lib/rbac/requireGlobalAdmin";

export const runtime = "nodejs";

function normalizeRole(accessType?: string | null) {
  if (accessType === "admin" || accessType === "company") return "admin";
  return "user";
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { admin, status } = await requireGlobalAdminWithStatus(req);
  if (!admin) {
    return NextResponse.json({ error: status === 401 ? "Nao autenticado" : "Sem permissao" }, { status });
  }

  const { id } = await context.params;
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const clientId = typeof body?.client_id === "string" ? body.client_id : null;
  const role = normalizeRole(typeof body?.access_type === "string" ? body.access_type : null);

  if (!email) {
    return NextResponse.json({ error: "Email obrigatorio" }, { status: 400 });
  }
  if (!clientId) {
    return NextResponse.json({ error: "Empresa obrigatoria para este perfil" }, { status: 400 });
  }

  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    const tempPassword = hashPasswordSha256(`${Date.now()}-${randomUUID()}`);
    user = await prisma.user.create({
      data: {
        email,
        name,
        password_hash: tempPassword,
        active: true,
      },
    });
  }

  await prisma.userCompany.upsert({
    where: { user_id_company_id: { user_id: user.id, company_id: clientId } },
    update: { role },
    create: { user_id: user.id, company_id: clientId, role },
  });

  await prisma.supportRequest.update({
    where: { id },
    data: { status: "accepted" },
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
