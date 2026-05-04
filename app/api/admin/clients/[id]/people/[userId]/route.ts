import { NextRequest, NextResponse } from "next/server";

import { addAuditLogSafe } from "@/data/auditLogRepository";
import { getAdminUserItem } from "@/lib/adminUsers";
import { findLocalCompanyById, removeLocalLink } from "@/lib/auth/localStore";
import { requireGlobalAdminWithStatus } from "@/lib/rbac/requireGlobalAdmin";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  const { admin, status } = await requireGlobalAdminWithStatus(req);
  if (!admin) {
    return NextResponse.json({ error: status === 401 ? "Não autenticado" : "Sem permissão" }, { status });
  }

  const { id: companyId, userId } = await params;
  const company = await findLocalCompanyById(companyId);
  if (!company) {
    return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
  }

  const user = await getAdminUserItem(userId);
  if (!user) {
    return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
  }

  const removed = await removeLocalLink(userId, companyId);
  if (!removed) {
    return NextResponse.json({ error: "Vínculo não encontrado" }, { status: 404 });
  }

  await addAuditLogSafe({
    actorUserId: admin.id,
    actorEmail: admin.email,
    action: "client.updated",
    entityType: "client",
    entityId: companyId,
    entityLabel: company.name ?? company.company_name ?? company.slug ?? company.id,
    metadata: {
      operation: "user_unlinked",
      userId,
      userEmail: user.email,
    },
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
