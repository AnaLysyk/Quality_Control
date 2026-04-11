import { NextResponse } from "next/server";
import { prisma } from "@/lib/prismaClient";
import { requireAccessRequestReviewerWithStatus } from "@/lib/rbac/requireAccessRequestReviewer";
import { canReviewerAccessQueue, resolveAccessRequestQueue } from "@/lib/requestReviewAccess";
import { shouldUseJsonStore } from "@/lib/storeMode";
import { getAccessRequestById } from "@/data/accessRequestsStore";
import { createAccessRequestComment, listAccessRequestComments } from "@/data/accessRequestCommentsStore";
import { NO_STORE_HEADERS } from "@/lib/http/noStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function sanitizeBody(value: unknown, max = 2000) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

async function getRequestForReview(id: string): Promise<{ email: string; message: string; status: string } | null> {
  if (shouldUseJsonStore()) {
    const existing = await getAccessRequestById(id);
    return existing ? { email: existing.email, message: existing.message, status: existing.status } : null;
  }
  try {
    const existing = await prisma.supportRequest.findUnique({ where: { id } });
    return existing ? { email: existing.email, message: existing.message, status: existing.status } : null;
  } catch (error) {
    console.error("Erro ao validar support_request, fallback JSON:", error);
    const existing = await getAccessRequestById(id);
    return existing ? { email: existing.email, message: existing.message, status: existing.status } : null;
  }
}

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const { admin, status } = await requireAccessRequestReviewerWithStatus(req);
  if (!admin) {
    return NextResponse.json({ error: status === 401 ? "Nao autenticado" : "Sem permissao" }, { status, headers: NO_STORE_HEADERS });
  }

  const { id } = await context.params;
  const request = await getRequestForReview(id);
  if (!request) {
    return NextResponse.json({ error: "Solicitacao nao encontrada." }, { status: 404, headers: NO_STORE_HEADERS });
  }
  if (!canReviewerAccessQueue(admin, resolveAccessRequestQueue(request.message, request.email))) {
    return NextResponse.json({ error: "Sem permissao para esta solicitacao" }, { status: 403, headers: NO_STORE_HEADERS });
  }
  try {
    const comments = await listAccessRequestComments(id);
    return NextResponse.json({ items: comments }, { status: 200, headers: NO_STORE_HEADERS });
  } catch (error) {
    console.error("Falha ao carregar comentarios (access-requests):", error);
    return NextResponse.json({ items: [], error: "Falha ao carregar comentarios" }, { status: 200, headers: NO_STORE_HEADERS });
  }
}

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const { admin, status } = await requireAccessRequestReviewerWithStatus(req);
  if (!admin) {
    return NextResponse.json({ error: status === 401 ? "Nao autenticado" : "Sem permissao" }, { status });
  }

  const { id } = await context.params;
  const body = (await req.json().catch(() => null)) as { body?: string; comment?: string } | null;
  const comment = sanitizeBody(body?.comment ?? body?.body ?? "");
  if (!comment) {
    return NextResponse.json({ error: "Comentario obrigatorio." }, { status: 400 });
  }

  const request = await getRequestForReview(id);
  if (!request) {
    return NextResponse.json({ error: "Solicitacao nao encontrada." }, { status: 404 });
  }
  if (!canReviewerAccessQueue(admin, resolveAccessRequestQueue(request.message, request.email))) {
    return NextResponse.json({ error: "Sem permissao para esta solicitacao" }, { status: 403 });
  }
  if (request.status === "rejected" || request.status === "closed") {
    return NextResponse.json({ error: "Esta solicitacao ja foi finalizada e nao aceita novos comentarios." }, { status: 409 });
  }

  const record = await createAccessRequestComment({
    requestId: id,
    authorRole: "admin",
    authorName: admin.email || "Admin",
    authorEmail: admin.email || null,
    authorId: admin.id || null,
    body: comment,
  });

  return NextResponse.json({ item: record }, { status: 200 });
}
