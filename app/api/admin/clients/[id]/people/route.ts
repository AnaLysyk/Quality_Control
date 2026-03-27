import { NextRequest, NextResponse } from "next/server";

import { addAuditLogSafe } from "@/data/auditLogRepository";
import { getAdminUserItem } from "@/lib/adminUsers";
import { findLocalCompanyById, upsertLocalLink } from "@/lib/auth/localStore";
import { isUserScopeLockedError } from "@/lib/companyUserScope";
import { requireGlobalAdminWithStatus } from "@/lib/rbac/requireGlobalAdmin";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { admin, status } = await requireGlobalAdminWithStatus(req);
  if (!admin) {
    return NextResponse.json({ error: status === 401 ? "Nao autenticado" : "Sem permissao" }, { status });
  }

  const { id: companyId } = await params;
  const company = await findLocalCompanyById(companyId);
  if (!company) {
    return NextResponse.json({ error: "Empresa nao encontrada" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const userId = typeof body?.userId === "string" ? body.userId : "";
  if (!userId) {
    return NextResponse.json({ error: "Usuario obrigatorio" }, { status: 400 });
  }

  const user = await getAdminUserItem(userId);
  if (!user) {
    return NextResponse.json({ error: "Usuario nao encontrado" }, { status: 404 });
  }

  const allowedRoles = new Set(["user", "company", "admin"]);
  if (!allowedRoles.has(user.permission_role ?? "")) {
    return NextResponse.json({ error: "Apenas usuarios permitidos podem ser vinculados por esta aba" }, { status: 400 });
  }

  if ((user.companyIds ?? user.company_ids ?? []).includes(companyId)) {
    return NextResponse.json({ error: "Esse usuario ja esta vinculado a esta empresa" }, { status: 409 });
  }

  try {
    await upsertLocalLink({
      userId,
      companyId,
      role: user.permission_role === "admin" ? "admin" : user.permission_role === "company" ? "company_admin" : "user",
      capabilities: [],
    });
  } catch (error) {
    if (isUserScopeLockedError(error)) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }

  const updated = await getAdminUserItem(userId);

  await addAuditLogSafe({
    actorUserId: admin.id,
    actorEmail: admin.email,
    action: "client.updated",
    entityType: "client",
    entityId: companyId,
    entityLabel: company.name ?? company.company_name ?? company.slug ?? company.id,
    metadata: {
      operation: "user_linked",
      userId,
      userEmail: updated?.email ?? user.email,
    },
  });

  return NextResponse.json({ item: updated }, { status: 200 });
}
