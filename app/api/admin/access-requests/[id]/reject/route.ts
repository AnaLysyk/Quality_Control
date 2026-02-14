import { NextResponse } from "next/server";
import { prisma } from "@/lib/prismaClient";
import { requireGlobalAdminWithStatus } from "@/lib/rbac/requireGlobalAdmin";
import { shouldUseJsonStore } from "@/lib/storeMode";
import { getAccessRequestById, updateAccessRequest } from "@/data/accessRequestsStore";
import { createAccessRequestComment } from "@/data/accessRequestCommentsStore";

const MAX_TEXT = 2000;
const MAX_BYTES = 16 * 1024;
const STATUS_REJECTED = "rejected";

function cleanText(value: unknown) {
  if (typeof value !== "string") return "";
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  return normalized.length > MAX_TEXT ? normalized.slice(0, MAX_TEXT) : normalized;
}

function applyAdminNotes(message: string | null | undefined, notes: string | null) {
  const base = typeof message === "string" ? message : "";
  if (!notes || !notes.trim()) return base;
  const lines = base.split("\n").filter((line) => !line.startsWith("ADMIN_NOTES:"));
  lines.push(`ADMIN_NOTES: ${notes.trim()}`);
  return lines.join("\n");
}

function validateJsonRequest(req: Request) {
  const contentType = req.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error("BAD_CT");
  }

  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_BYTES) {
    throw new Error("TOO_LARGE");
  }
}

function json(data: unknown, init?: ResponseInit) {
  const res = NextResponse.json(data, init);
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const { admin, status } = await requireGlobalAdminWithStatus(req);
  if (!admin) {
    return json({ error: status === 401 ? "Nao autenticado" : "Sem permissao" }, { status });
  }

  try {
    validateJsonRequest(req);
  } catch (error) {
    if (error instanceof Error && error.message === "BAD_CT") {
      return json({ error: "Content-Type invalido" }, { status: 415 });
    }
    if (error instanceof Error && error.message === "TOO_LARGE") {
      return json({ error: "Payload muito grande" }, { status: 413 });
    }
    return json({ error: "Requisicao invalida" }, { status: 400 });
  }

  const body = (await req.json().catch(() => null)) as { reason?: string | null; comment?: string | null } | null;
  const reason = cleanText(body?.reason);
  const comment = cleanText(body?.comment);
  const commentBody = comment || reason;

  const { id } = await context.params;
  if (shouldUseJsonStore()) {
    const existing = await getAccessRequestById(id);
    if (!existing) {
      return json({ error: "Solicitacao nao encontrada" }, { status: 404 });
    }
    console.debug(`[ACCESS-REQUESTS][REJECT] admin=${admin?.email ?? "-"} id=${id} comment=${Boolean(comment)} reason=${Boolean(reason)}`);
    const updated = await updateAccessRequest(id, {
      status: STATUS_REJECTED,
      message: applyAdminNotes(existing.message, reason || null),
    });
    if (commentBody) {
      await createAccessRequestComment({
        requestId: id,
        authorRole: "admin",
        authorName: admin.email || "Admin",
        authorEmail: admin.email || null,
        authorId: admin.id || null,
        body: commentBody,
      });
    }
    return json({
      ok: true,
      item: {
        id: updated?.id ?? id,
        status: updated?.status ?? STATUS_REJECTED,
      },
    });
  }

  const existing = await prisma.supportRequest.findUnique({ where: { id } });
  if (!existing) {
    return json({ error: "Solicitacao nao encontrada" }, { status: 404 });
  }
  console.debug(`[ACCESS-REQUESTS][REJECT] admin=${admin?.email ?? "-"} id=${id} comment=${Boolean(comment)} reason=${Boolean(reason)}`);

  const updated = await prisma.supportRequest.update({
    where: { id },
    data: {
      status: STATUS_REJECTED,
      message: applyAdminNotes(existing.message, reason || null),
    },
  });

  if (commentBody) {
    await createAccessRequestComment({
      requestId: id,
      authorRole: "admin",
      authorName: admin.email || "Admin",
      authorEmail: admin.email || null,
      authorId: admin.id || null,
      body: commentBody,
    });
  }

  return json({
    ok: true,
    item: {
      id: updated.id,
      status: updated.status,
    },
  });
}
