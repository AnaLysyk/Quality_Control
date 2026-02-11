import { NextResponse } from "next/server";
import { prisma } from "@/lib/prismaClient";
import { requireGlobalAdminWithStatus } from "@/lib/rbac/requireGlobalAdmin";
import { shouldUseJsonStore } from "@/lib/storeMode";
import { getAccessRequestById } from "@/data/accessRequestsStore";
import { createAccessRequestComment, listAccessRequestComments } from "@/data/accessRequestCommentsStore";

export const runtime = "nodejs";

function sanitizeBody(value: unknown, max = 2000) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

async function ensureRequestExists(id: string): Promise<boolean> {
  if (shouldUseJsonStore()) {
    const existing = await getAccessRequestById(id);
    return Boolean(existing);
  }
  try {
    const existing = await prisma.supportRequest.findUnique({ where: { id } });
    return Boolean(existing);
  } catch (error) {
    console.error("Erro ao validar support_request, fallback JSON:", error);
    const existing = await getAccessRequestById(id);
    return Boolean(existing);
  }
}

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const { admin, status } = await requireGlobalAdminWithStatus(req);
  if (!admin) {
    return NextResponse.json({ error: status === 401 ? "Nao autenticado" : "Sem permissao" }, { status });
  }

  const { id } = await context.params;
  try {
    const comments = await listAccessRequestComments(id);
    return NextResponse.json({ items: comments }, { status: 200 });
  } catch (error) {
    console.error("Falha ao carregar comentarios (access-requests):", error);
    return NextResponse.json({ items: [], error: "Falha ao carregar comentarios" }, { status: 200 });
  }
}

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const { admin, status } = await requireGlobalAdminWithStatus(req);
  if (!admin) {
    return NextResponse.json({ error: status === 401 ? "Nao autenticado" : "Sem permissao" }, { status });
  }

  const { id } = await context.params;
  const body = (await req.json().catch(() => null)) as { body?: string; comment?: string } | null;
  const comment = sanitizeBody(body?.comment ?? body?.body ?? "");
  if (!comment) {
    return NextResponse.json({ error: "Comentario obrigatorio." }, { status: 400 });
  }

  const exists = await ensureRequestExists(id);
  if (!exists) {
    return NextResponse.json({ error: "Solicitacao nao encontrada." }, { status: 404 });
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
