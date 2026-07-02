import { NextResponse } from "next/server";

import {
  getPublicAccessRequestByKey,
  updateAccessRequestByKey,
} from "@/lib/accessRequestsV2/service";

export async function GET(_req: Request, context: { params: Promise<{ key: string }> }) {
  const { key } = await context.params;
  if (!key || key.length < 10) {
    return NextResponse.json({ message: "Chave invalida" }, { status: 400 });
  }

  const result = await getPublicAccessRequestByKey(key);
  if (!result) {
    return NextResponse.json({ message: "SolicitaÃ§Ã£o nÃ£o encontrada" }, { status: 404 });
  }
  const { request, comments } = result;

  return NextResponse.json({
    item: {
      id: request.id,
      status: request.status,
      requestType: request.requestType,
      requestedRole: request.requestedRole,
      requestedCompanySlug: request.requestedCompanySlug,
      requestedCompanyId: request.requestedCompanyId,
      requesterName: request.requesterName,
      requesterEmail: request.requesterEmail,
      reason: request.reason,
      reviewComment: request.reviewComment,
      adjustmentFields: request.adjustmentFields ?? [],
      adjustmentHistory: request.adjustmentHistory ?? [],
      lastAdjustmentAt: request.lastAdjustmentAt,
      lastAdjustmentDiff: request.lastAdjustmentDiff ?? [],
      details: request.details ?? {},
      priority: request.priority,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
    },
    comments: comments.map((comment) => ({
      id: comment.id,
      authorRole: comment.authorRole,
      authorName: comment.authorName,
      body: comment.body,
      createdAt: comment.createdAt,
    })),
  });
}

export async function PATCH(req: Request, context: { params: Promise<{ key: string }> }) {
  const { key } = await context.params;
  if (!key || key.length < 10) {
    return NextResponse.json({ message: "Chave invalida" }, { status: 400 });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ message: "Payload invalido" }, { status: 400 });
  }

  const result = await updateAccessRequestByKey(key, body);
  if (!result) return NextResponse.json({ message: "SolicitaÃ§Ã£o nÃ£o encontrada" }, { status: 404 });
  if (result === "not-adjustable" || result === "no-adjustment-fields") {
    return NextResponse.json({ message: "Esta solicitacao nao aceita correcao" }, { status: 409 });
  }
  if ("error" in result) {
    const messages = {
      "required-field": "Preencha todos os campos solicitados",
      "invalid-password": "A senha deve ter ao menos 8 caracteres",
      "invalid-email": "Informe um e-mail valido",
      "invalid-profile": "Perfil invalido",
      "invalid-company": "Empresa invalida",
      "duplicate-user": "Usuario ja cadastrado",
    };
    return NextResponse.json(
      { message: messages[result.error], field: result.field },
      { status: 400 },
    );
  }

  return NextResponse.json({
    item: {
      id: result.id,
      status: result.status,
      updatedAt: result.updatedAt,
    },
  });
}

