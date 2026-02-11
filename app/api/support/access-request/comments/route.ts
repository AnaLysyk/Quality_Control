import { NextResponse } from "next/server";
import { prisma } from "@/lib/prismaClient";
import { shouldUseJsonStore } from "@/lib/storeMode";
import { getAccessRequestById, listAccessRequests } from "@/data/accessRequestsStore";
import { createAccessRequestComment } from "@/data/accessRequestCommentsStore";
import { notifyAccessRequestComment } from "@/lib/notificationService";
import { parseAccessRequestMessage } from "@/lib/accessRequestMessage";

type SupportRequestRow = {
  id: string;
  email: string;
  message: string;
  status: string;
  created_at: Date | string;
  user_id?: string | null;
};

function normalizeLookup(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
}

function sanitizeBody(value: unknown, max = 2000) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

async function findRequestById(id: string): Promise<SupportRequestRow | null> {
  if (shouldUseJsonStore()) {
    const item = await getAccessRequestById(id);
    if (!item) return null;
    return {
      id: item.id,
      email: item.email,
      message: item.message,
      status: item.status,
      created_at: item.created_at,
      user_id: item.user_id ?? null,
    };
  }
  try {
    const item = await prisma.supportRequest.findUnique({ where: { id } });
    if (!item) return null;
    return {
      id: item.id,
      email: item.email,
      message: item.message,
      status: item.status,
      created_at: item.created_at,
      user_id: (item as { user_id?: string | null }).user_id ?? null,
    };
  } catch (error) {
    console.error("Erro ao buscar support_request, fallback JSON:", error);
    const item = await getAccessRequestById(id);
    if (!item) return null;
    return {
      id: item.id,
      email: item.email,
      message: item.message,
      status: item.status,
      created_at: item.created_at,
      user_id: item.user_id ?? null,
    };
  }
}

async function findRequestByLookup(email: string, name: string): Promise<SupportRequestRow | null> {
  const normalizedEmail = normalizeLookup(email);
  const normalizedName = normalizeLookup(name);
  if (!normalizedEmail || !normalizedName) return null;

  let items: SupportRequestRow[] = [];
  if (shouldUseJsonStore()) {
    const list = await listAccessRequests();
    items = list.map((item) => ({
      id: item.id,
      email: item.email,
      message: item.message,
      status: item.status,
      created_at: item.created_at,
      user_id: item.user_id ?? null,
    }));
  } else {
    try {
      const list = await prisma.supportRequest.findMany({
        where: { email: email.trim().toLowerCase() },
        orderBy: { created_at: "desc" },
      });
      items = list.map((item) => ({
        id: item.id,
        email: item.email,
        message: item.message,
        status: item.status,
        created_at: item.created_at,
        user_id: (item as { user_id?: string | null }).user_id ?? null,
      }));
    } catch (error) {
      console.error("Erro ao consultar support_request, fallback JSON:", error);
      const list = await listAccessRequests();
      items = list.map((item) => ({
        id: item.id,
        email: item.email,
        message: item.message,
        status: item.status,
        created_at: item.created_at,
        user_id: item.user_id ?? null,
      }));
    }
  }

  const match = items.find((item) => {
    if (normalizeLookup(item.email ?? "") !== normalizedEmail) return false;
    const parsed = parseAccessRequestMessage(String(item.message ?? ""), String(item.email ?? ""));
    return normalizeLookup(parsed.name ?? "") === normalizedName;
  });
  return match ?? null;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    requestId?: string;
    name?: string;
    email?: string;
    comment?: string;
    body?: string;
  } | null;

  if (!body) {
    return NextResponse.json({ error: "Payload invalido." }, { status: 400 });
  }

  const requestId = typeof body.requestId === "string" ? body.requestId.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const comment = sanitizeBody(body.comment ?? body.body ?? "");

  if (!name || !email || !comment) {
    return NextResponse.json({ error: "Informe nome, e-mail e comentario." }, { status: 400 });
  }

  const request = requestId ? await findRequestById(requestId) : await findRequestByLookup(email, name);
  if (!request) {
    return NextResponse.json({ error: "Solicitacao nao encontrada." }, { status: 404 });
  }

  const parsed = parseAccessRequestMessage(String(request.message ?? ""), String(request.email ?? ""));
  if (normalizeLookup(parsed.name ?? "") !== normalizeLookup(name) || normalizeLookup(request.email ?? "") !== normalizeLookup(email)) {
    return NextResponse.json({ error: "Dados nao conferem com a solicitacao." }, { status: 403 });
  }

  const record = await createAccessRequestComment({
    requestId: request.id,
    authorRole: "requester",
    authorName: name,
    authorEmail: email,
    body: comment,
  });

  await notifyAccessRequestComment({
    requestId: request.id,
    commentId: record.id,
    authorName: name,
    body: comment,
  });

  return NextResponse.json({ item: record }, { status: 200 });
}
