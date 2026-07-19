import { NextResponse } from "next/server";

import {
  getPublicAccessRequestByKey,
  updateAccessRequestByKey,
} from "@/backend/access-requests/service";
import { rateLimit } from "@/backend/rateLimit";
import { NO_STORE_HEADERS } from "@/backend/http/noStore";

export async function GET(req: Request, context: { params: Promise<{ key: string }> }) {
  const { key } = await context.params;
  if (!key || key.length < 10 || key.length > 160) {
    return NextResponse.json({ message: "Chave invalida" }, { status: 400, headers: NO_STORE_HEADERS });
  }

  const limiter = await rateLimit(req, `access-request-by-key:${key}`, 30, 60);
  if (limiter.limited) return limiter.response;

  const result = await getPublicAccessRequestByKey(key);
  if (!result) {
    return NextResponse.json({ message: "Solicitação não encontrada" }, { status: 404, headers: NO_STORE_HEADERS });
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
  }, { headers: NO_STORE_HEADERS });
}

export async function PATCH(req: Request, context: { params: Promise<{ key: string }> }) {
  const { key } = await context.params;
  if (!key || key.length < 10 || key.length > 160) {
    return NextResponse.json({ message: "Chave invalida" }, { status: 400, headers: NO_STORE_HEADERS });
  }

  const limiter = await rateLimit(req, `access-request-update-by-key:${key}`, 10, 60);
  if (limiter.limited) return limiter.response;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ message: "Payload invalido" }, { status: 400, headers: NO_STORE_HEADERS });
  }

  const result = await updateAccessRequestByKey(key, body);
  if (!result) return NextResponse.json({ message: "Solicitação não encontrada" }, { status: 404, headers: NO_STORE_HEADERS });
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
  }, { headers: NO_STORE_HEADERS });
}
