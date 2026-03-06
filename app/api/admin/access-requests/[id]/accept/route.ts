import { NextResponse } from "next/server";
import { prisma } from "@/lib/prismaClient";
import { requireGlobalAdminWithStatus } from "@/lib/rbac/requireGlobalAdmin";
import { shouldUseJsonStore } from "@/lib/storeMode";
import { getAccessRequestById, updateAccessRequest } from "@/data/accessRequestsStore";
import { createLocalUser, findLocalUserByEmailOrId, upsertLocalLink } from "@/lib/auth/localStore";
import { hashPasswordSha256 } from "@/lib/passwordHash";
import { createAccessRequestComment } from "@/data/accessRequestCommentsStore";

function applyAdminNotes(message: string, notes: string | null) {
  if (!notes || !notes.trim()) return message;
  const lines = message.split("\n").filter((line) => !line.startsWith("ADMIN_NOTES:"));
  lines.push(`ADMIN_NOTES: ${notes.trim()}`);
  return lines.join("\n");
}

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { admin, status } = await requireGlobalAdminWithStatus(req);
    if (!admin) {
      return NextResponse.json({ error: status === 401 ? "Nao autenticado" : "Sem permissao" }, { status });
    }

    const body = (await req.json().catch(() => null)) as { comment?: string; admin_notes?: string } | null;
    const comment = typeof body?.comment === "string" ? body.comment.trim() : "";
    const adminNotes = typeof body?.admin_notes === "string" ? body.admin_notes.trim() : "";

    const { id } = await context.params;
    if (shouldUseJsonStore()) {
      const existing = await getAccessRequestById(id);
      if (!existing) {
        return NextResponse.json({ error: "Solicitacao nao encontrada" }, { status: 404 });
      }
      console.debug(`[ACCESS-REQUESTS][ACCEPT] admin=${admin?.email ?? "-"} id=${id} comment=${Boolean(comment)} adminNotes=${Boolean(adminNotes)}`);
      const nextMessage = adminNotes ? applyAdminNotes(existing.message, adminNotes) : existing.message;
      const updated = await updateAccessRequest(id, { status: "closed", message: nextMessage });
      // If there's no user linked, try to create one so the requester can login.
      let createdUserId: string | null = null;
      try {
        if (!existing.user_id) {
          // Attempt to parse JSON payload embedded in message (ACCESS_REQUEST_V1 ...)
          let parsed: any = null;
          try {
            const idx = existing.message.indexOf("{");
            if (idx !== -1) {
              const raw = existing.message.slice(idx);
              parsed = JSON.parse(raw);
            }
          } catch {
            parsed = null;
          }

          const email = existing.email;
          const name = (parsed && parsed.name) ? String(parsed.name) : email.split("@")[0];
          const mappedRole = parsed?.mappedAppRole ?? null;
          const role = mappedRole && typeof mappedRole === "string" && mappedRole.includes("admin") ? "company_admin" : "user";

          // generate a temporary password
          const pw = (globalThis as any).crypto?.randomUUID?.() ?? `${Date.now()}${Math.random().toString(36).slice(2)}`;
          const password_hash = hashPasswordSha256(pw);

          try {
            const created = await createLocalUser({ name: String(name), email: String(email), password_hash, role });
            createdUserId = created.id;
            // try to link to company if message contains clientId/company slug (best-effort)
            try {
              const companyId = parsed?.clientId ?? parsed?.companyId ?? null;
              if (companyId && typeof companyId === "string") {
                await upsertLocalLink({ userId: created.id, companyId });
              }
            } catch {
              // ignore link errors
            }
            // update access request with user_id
            await updateAccessRequest(id, { user_id: created.id });
            // include password in debug log for admin to copy
            console.debug(`[ACCESS-REQUESTS][ACCEPT] created user id=${created.id} email=${email}`);
            // attach generated password to response via debug log file (safe for local/dev)
            try {
              const fs = await import("node:fs/promises");
              const path = await import("node:path");
              const debugPath = path.join(process.cwd(), "data", "access-requests-debug.log");
              const line = `${new Date().toISOString()} CREATED_USER id=${created.id} email=${email} pw=${pw}\n`;
              await fs.appendFile(debugPath, line, "utf8");
            } catch {
              // ignore
            }
          } catch (err: any) {
            // if duplicate, try to find existing user and attach
            if (err?.code === "DUPLICATE_EMAIL" || err?.code === "DUPLICATE_USER") {
              const existingUser = await findLocalUserByEmailOrId(email);
              if (existingUser) {
                createdUserId = existingUser.id;
                await updateAccessRequest(id, { user_id: existingUser.id });
              }
            } else {
              console.error("Failed creating local user from access-request accept:", err);
            }
          }
        }
      } catch (e) {
        console.error("Error while creating user for access-request:", e);
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
      // grava um log auxiliar em disco para diagnostico E2E local
      try {
        const fs = await import("node:fs/promises");
        const path = await import("node:path");
        const debugPath = path.join(process.cwd(), "data", "access-requests-debug.log");
        const line = `${new Date().toISOString()} ACCEPT id=${id} admin=${admin?.email ?? "-"} status=${updated?.status ?? "closed"}\n`;
        await fs.appendFile(debugPath, line, "utf8");
      } catch {
        // ignore write errors
      }
      return NextResponse.json({
        ok: true,
        item: {
          id: updated?.id ?? id,
          status: updated?.status ?? "closed",
        },
      });
    }

    const existing = await prisma.supportRequest.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Solicitacao nao encontrada" }, { status: 404 });
    }
    console.debug(`[ACCESS-REQUESTS][ACCEPT] admin=${admin?.email ?? "-"} id=${id} comment=${Boolean(comment)} adminNotes=${Boolean(adminNotes)}`);

    const updated = await prisma.supportRequest.update({
      where: { id },
      data: { status: "closed", message: adminNotes ? applyAdminNotes(existing.message, adminNotes) : existing.message },
    });

    // For prisma-backed store, try to create a local user if none linked
    try {
      if (!existing.user_id) {
        let parsed: any = null;
        try {
          const idx = existing.message.indexOf("{");
          if (idx !== -1) {
            const raw = existing.message.slice(idx);
            parsed = JSON.parse(raw);
          }
        } catch {
          parsed = null;
        }
        const email = existing.email;
        const name = (parsed && parsed.name) ? String(parsed.name) : email.split("@")[0];
        const mappedRole = parsed?.mappedAppRole ?? null;
        const role = mappedRole && typeof mappedRole === "string" && mappedRole.includes("admin") ? "company_admin" : "user";
        const pw = (globalThis as any).crypto?.randomUUID?.() ?? `${Date.now()}${Math.random().toString(36).slice(2)}`;
        const password_hash = hashPasswordSha256(pw);
        try {
          const created = await createLocalUser({ name: String(name), email: String(email), password_hash, role });
          // update prisma supportRequest.user_id if schema allows (best-effort)
          try {
            await prisma.supportRequest.update({ where: { id }, data: { user_id: created.id } as any });
          } catch {
            // ignore if schema doesn't have user_id
          }
          try {
            const fs = await import("node:fs/promises");
            const path = await import("node:path");
            const debugPath = path.join(process.cwd(), "data", "access-requests-debug.log");
            const line = `${new Date().toISOString()} CREATED_USER id=${created.id} email=${email} pw=${pw}\n`;
            await fs.appendFile(debugPath, line, "utf8");
          } catch {
            // ignore
          }
        } catch (err: any) {
          if (err?.code === "DUPLICATE_EMAIL" || err?.code === "DUPLICATE_USER") {
            // nothing to do
          } else {
            console.error("Failed creating local user from access-request accept (prisma):", err);
          }
        }
      }
    } catch (e) {
      console.error("Error while creating user for access-request (prisma):", e);
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

    // grava log auxiliar em disco para diagnostico E2E (prisma)
    try {
      const fs = await import("node:fs/promises");
      const path = await import("node:path");
      const debugPath = path.join(process.cwd(), "data", "access-requests-debug.log");
      const line = `${new Date().toISOString()} ACCEPT prisma id=${id} admin=${admin?.email ?? "-"} status=${updated?.status}\n`;
      await fs.appendFile(debugPath, line, "utf8");
    } catch {
      // ignore write errors
    }

    return NextResponse.json({
      ok: true,
      item: {
        id: updated.id,
        status: updated.status,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[ACCESS-REQUESTS][ACCEPT][ERROR]`, err);
    try {
      const fs = await import("node:fs/promises");
      const path = await import("node:path");
      const debugPath = path.join(process.cwd(), "data", "access-requests-debug.log");
      const line = `${new Date().toISOString()} ERROR ACCEPT ${message}\n`;
      await fs.appendFile(debugPath, line, "utf8");
    } catch {
      // ignore
    }
    return NextResponse.json({ error: "Internal Server Error", details: message }, { status: 500 });
  }
}
