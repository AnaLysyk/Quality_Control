import { NextResponse } from "next/server";

import { prisma } from "@/lib/prismaClient";
import { requireGlobalAdminWithStatus } from "@/lib/rbac/requireGlobalAdmin";
import { shouldUseJsonStore } from "@/lib/storeMode";
import { getAccessRequestById, updateAccessRequest } from "@/data/accessRequestsStore";
import { createAccessRequestComment } from "@/data/accessRequestCommentsStore";

const MAX_TEXT_LENGTH = 2000;

function sanitizeText(value: string | undefined | null) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, MAX_TEXT_LENGTH);
}

function applyAdminNotes(message: string, notes: string | null) {
  const sanitizedNotes = sanitizeText(notes);
  if (!sanitizedNotes) return message;
  const baseMessage = typeof message === "string" ? message : "";
  const lines = baseMessage.split("\n").filter((line) => !line.startsWith("ADMIN_NOTES:"));
  lines.push(`ADMIN_NOTES: ${sanitizedNotes}`);
  return lines.join("\n");
}

async function appendDebugLog(line: string) {
  try {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const dir = path.join(process.cwd(), "data");
    await fs.mkdir(dir, { recursive: true });
    await fs.appendFile(path.join(dir, "access-requests-debug.log"), line, "utf8");
  } catch {
    // ignore
  }
}

function json(data: unknown, init?: ResponseInit) {
  const res = NextResponse.json(data, init);
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { admin, status } = await requireGlobalAdminWithStatus(req);
    if (!admin) {
      return json({ error: status === 401 ? "Nao autenticado" : "Sem permissao" }, { status });
    }

    const body = (await req.json().catch(() => null)) as { comment?: string; admin_notes?: string } | null;
    const comment = sanitizeText(body?.comment);
    const adminNotes = sanitizeText(body?.admin_notes);

    const params = await context.params;
    const id = `${params.id ?? ""}`.trim();
    if (!id) {
      return json({ error: "ID invalido" }, { status: 400 });
    }

    if (shouldUseJsonStore()) {
      const existing = await getAccessRequestById(id);
      if (!existing) {
        return json({ error: "Solicitacao nao encontrada" }, { status: 404 });
      }
      if (existing.status === "closed") {
        return json({ error: "Solicitacao ja encerrada" }, { status: 409 });
      }
      console.debug(
        `[ACCESS-REQUESTS][ACCEPT][JSON] admin=${admin.email ?? "-"} id=${id} comment=${Boolean(comment)} adminNotes=${Boolean(adminNotes)}`,
      );
      const baseMessage = typeof existing.message === "string" ? existing.message : "";
      const nextMessage = applyAdminNotes(baseMessage, adminNotes);
      const updated = await updateAccessRequest(id, { status: "closed", message: nextMessage });
      if (!updated) {
        return json({ error: "Falha ao atualizar solicitacao" }, { status: 500 });
      }
      if (comment) {
        await createAccessRequestComment({
          requestId: id,
          authorRole: "admin",
          authorName: admin.email || "Admin",
          authorEmail: admin.email || null,
          authorId: admin.id || null,
          body: comment,
        });
      }
      await appendDebugLog(`${new Date().toISOString()} ACCEPT json id=${id} admin=${admin.email ?? "-"} status=${updated.status}\n`);
      return json({
        ok: true,
        item: {
          id: updated.id,
          status: updated.status,
        },
      });
    }

    const existing = await prisma.supportRequest.findUnique({ where: { id } });
    if (!existing) {
      return json({ error: "Solicitacao nao encontrada" }, { status: 404 });
    }
    if (existing.status === "closed") {
      return json({ error: "Solicitacao ja encerrada" }, { status: 409 });
    }
    console.debug(
      `[ACCESS-REQUESTS][ACCEPT][PRISMA] admin=${admin.email ?? "-"} id=${id} comment=${Boolean(comment)} adminNotes=${Boolean(adminNotes)}`,
    );

    const updated = await prisma.supportRequest.update({
      where: { id },
      data: {
        status: "closed",
        message: applyAdminNotes(existing.message ?? "", adminNotes),
      },
    });

    if (comment) {
      await createAccessRequestComment({
        requestId: id,
        authorRole: "admin",
        authorName: admin.email || "Admin",
        authorEmail: admin.email || null,
        authorId: admin.id || null,
        body: comment,
      });
    }

    await appendDebugLog(`${new Date().toISOString()} ACCEPT prisma id=${id} admin=${admin.email ?? "-"} status=${updated.status}\n`);

    return json({
      ok: true,
      item: {
        id: updated.id,
        status: updated.status,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[ACCESS-REQUESTS][ACCEPT][ERROR]`, err);
    await appendDebugLog(`${new Date().toISOString()} ERROR ACCEPT ${message}\n`);
    return json({ error: "Internal Server Error", details: message }, { status: 500 });
  }
}
