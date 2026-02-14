import { NextResponse } from "next/server";
import { prisma } from "@/lib/prismaClient";
import { requireGlobalAdminWithStatus } from "@/lib/rbac/requireGlobalAdmin";
import { shouldUseJsonStore } from "@/lib/storeMode";
import { getAccessRequestById } from "@/data/accessRequestsStore";
import { createAccessRequestComment, listAccessRequestComments } from "@/data/accessRequestCommentsStore";

export const runtime = "nodejs";

const MAX_BODY = 2000;
const MAX_BYTES = 16 * 1024;

function sanitizeBody(value: unknown) {
  if (typeof value !== "string") return "";
  const clean = value.replace(/\s+/g, " ").trim();
  if (!clean) return "";
  return clean.length > MAX_BODY ? clean.slice(0, MAX_BODY) : clean;
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

function json(data: unknown, init?: ResponseInit) {
  const res = NextResponse.json(data, init);
  res.headers.set("Cache-Control", "no-store");
  return res;
}

function validateJsonRequest(req: Request) {
  const contentType = req.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error("UNSUPPORTED_MEDIA");
  }

  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_BYTES) {
    throw new Error("PAYLOAD_TOO_LARGE");
  }
}

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const { admin, status } = await requireGlobalAdminWithStatus(req);
  if (!admin) {
    return json({ error: status === 401 ? "Nao autenticado" : "Sem permissao" }, { status });
  }

  const { id } = await context.params;
  try {
    const comments = await listAccessRequestComments(id);
    return json({ items: comments }, { status: 200 });
  } catch (error) {
    console.error("Falha ao carregar comentarios (access-requests):", error);
    return json({ items: [], degraded: true }, { status: 200 });
  }
}

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const { admin, status } = await requireGlobalAdminWithStatus(req);
  if (!admin) {
    return json({ error: status === 401 ? "Nao autenticado" : "Sem permissao" }, { status });
  }

  try {
    validateJsonRequest(req);
  } catch (error) {
    if (error instanceof Error && error.message === "UNSUPPORTED_MEDIA") {
      return json({ error: "Content-Type invalido" }, { status: 415 });
    }
    if (error instanceof Error && error.message === "PAYLOAD_TOO_LARGE") {
      return json({ error: "Payload muito grande" }, { status: 413 });
    }
    return json({ error: "Requisicao invalida" }, { status: 400 });
  }

  const { id } = await context.params;
  const body = (await req.json().catch(() => null)) as { body?: string; comment?: string } | null;
  const comment = sanitizeBody(body?.comment ?? body?.body);
  if (!comment) {
    return json({ error: "Comentario obrigatorio." }, { status: 400 });
  }

  const exists = await ensureRequestExists(id);
  if (!exists) {
    return json({ error: "Solicitacao nao encontrada." }, { status: 404 });
  }

  const record = await createAccessRequestComment({
    requestId: id,
    authorRole: "admin",
    authorName: admin.email || "Admin",
    authorEmail: admin.email || null,
    authorId: admin.id || null,
    body: comment,
  });

  return json({ item: record }, { status: 201 });
}
