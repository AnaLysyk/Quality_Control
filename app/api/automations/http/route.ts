import { NextResponse } from "next/server";
import { z } from "zod";

import { resolvePrimaryCompanySlug } from "@/lib/auth/normalizeAuthenticatedUser";
import { resolveAutomationAccess, resolveAutomationAllowedCompanySlugs } from "@/lib/automations/access";
import { saveAutomationExecutionAudit } from "@/lib/automations/executionAuditStore";
import { authenticateRequest } from "@/lib/jwtAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RequestSchema = z.object({
  body: z.string().nullable().optional(),
  companySlug: z.string().trim().optional().nullable(),
  forwardCookies: z.boolean().optional(),
  headers: z.record(z.string(), z.string()).optional(),
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
  timeoutMs: z.coerce.number().int().min(500).max(30000).optional(),
  url: z.string().trim().min(1),
});

function resolveAccess(user: Awaited<ReturnType<typeof authenticateRequest>>) {
  const allowedCompanySlugs = resolveAutomationAllowedCompanySlugs(user);
  return resolveAutomationAccess(user, allowedCompanySlugs.length);
}

function resolveTargetUrl(rawUrl: string, requestUrl: string) {
  if (rawUrl.startsWith("/")) {
    return new URL(rawUrl, requestUrl).toString();
  }

  const parsed = new URL(rawUrl);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Apenas URLs http/https são suportadas.");
  }

  return parsed.toString();
}

export async function POST(request: Request) {
  const user = await authenticateRequest(request);
  const startedAt = Date.now();

  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const access = resolveAccess(user);

  if (!access.canOpen) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const rawBody = await request.json().catch(() => null);
  const validation = RequestSchema.safeParse(rawBody);

  if (!validation.success) {
    return NextResponse.json({ error: validation.error.issues[0]?.message || "Payload inválido" }, { status: 400 });
  }

  const payload = validation.data;
  const companySlug = payload.companySlug?.trim() || resolvePrimaryCompanySlug(user) || null;

  try {
    const targetUrl = resolveTargetUrl(payload.url, request.url);
    const requestOrigin = new URL(request.url).origin;
    const targetOrigin = new URL(targetUrl).origin;
    const controller = new AbortController();
    const timeoutMs = payload.timeoutMs ?? 15000;
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const startedAt = Date.now();

    const headers = new Headers();
    for (const [key, value] of Object.entries(payload.headers ?? {})) {
      if (!key.trim()) continue;
      headers.set(key, value);
    }

    if (payload.forwardCookies) {
      if (targetOrigin !== requestOrigin) {
        throw new Error("A sessão atual só pode ser reutilizada em endpoints internos do mesmo domínio.");
      }

      const cookieHeader = request.headers.get("cookie");
      if (cookieHeader && !headers.has("cookie")) {
        headers.set("cookie", cookieHeader);
      }
    }

    const response = await fetch(targetUrl, {
      method: payload.method,
      headers,
      body: payload.method === "GET" || payload.method === "DELETE" ? undefined : payload.body ?? undefined,
      signal: controller.signal,
      cache: "no-store",
    });

    clearTimeout(timer);
    const durationMs = Date.now() - startedAt;
    const text = await response.text();
    let json: unknown = null;

    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }

    await saveAutomationExecutionAudit({
      actorUserId: user.id,
      companySlug,
      durationMs,
      metadata: {
        method: payload.method,
        targetUrl,
      },
      ok: response.ok,
      route: "http",
      statusCode: response.status,
    });

    return NextResponse.json({
      ok: response.ok,
      response: {
        durationMs,
        headers: Object.fromEntries(response.headers.entries()),
        json,
        status: response.status,
        statusText: response.statusText,
        text,
        url: targetUrl,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error && error.name === "AbortError"
        ? "Tempo limite excedido para a chamada."
        : error instanceof Error
          ? error.message
          : "Falha ao executar a chamada.";

    await saveAutomationExecutionAudit({
      actorUserId: user.id,
      companySlug,
      durationMs: Date.now() - startedAt,
      error: message,
      ok: false,
      route: "http",
      statusCode: 500,
    });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
