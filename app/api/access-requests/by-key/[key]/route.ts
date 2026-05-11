import { NextResponse } from "next/server";

import { getAccessRequestV2ByKey } from "@/lib/accessRequestsV2/repository";

/** Retorna informações públicas de uma solicitação a partir da chave segura.
 *  Não requer autenticação — apenas a chave opaca já é suficiente para segurança. */
export async function GET(_req: Request, context: { params: Promise<{ key: string }> }) {
  const { key } = await context.params;
  if (!key || key.length < 10) {
    return NextResponse.json({ message: "Chave inválida" }, { status: 400 });
  }

  const request = await getAccessRequestV2ByKey(key);
  if (!request) {
    return NextResponse.json({ message: "Solicitação não encontrada" }, { status: 404 });
  }

  // Retorna apenas campos seguros para exibição pública
  return NextResponse.json({
    item: {
      id: request.id,
      status: request.status,
      requestType: request.requestType,
      requestedRole: request.requestedRole,
      requestedCompanySlug: request.requestedCompanySlug,
      requesterName: request.requesterName,
      requesterEmail: request.requesterEmail,
      reason: request.reason,
      reviewComment: request.reviewComment,
      adjustmentFields: request.adjustmentFields ?? [],
      priority: request.priority,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
    },
  });
}
