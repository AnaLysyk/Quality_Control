import { NextResponse } from "next/server";
import { z } from "zod";

import { resolveAutomationAccess, resolveAutomationAllowedCompanySlugs } from "@/lib/automations/access";
import { normalizeAutomationCompanyScope } from "@/lib/automations/companyScope";
import { saveAutomationExecutionAudit } from "@/lib/automations/executionAuditStore";
import { authenticateRequest } from "@/lib/jwtAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RequestSchema = z.object({
  companySlug: z.string().trim().optional().nullable(),
  expectedText: z.string().trim().optional().nullable(),
  targetPath: z.string().trim().min(1),
  titleHint: z.string().trim().optional().nullable(),
});

function resolveAccess(user: Awaited<ReturnType<typeof authenticateRequest>>) {
  const allowedCompanySlugs = resolveAutomationAllowedCompanySlugs(user);
  return {
    access: resolveAutomationAccess(user, allowedCompanySlugs.length),
    allowedCompanySlugs,
  };
}

function resolveTargetUrl(targetPath: string, requestUrl: string) {
  if (!targetPath.startsWith("/") || targetPath.startsWith("//")) {
    throw new Error("A tela precisa ser interna e comecar com '/'.");
  }

  const baseUrl = new URL(requestUrl);
  const targetUrl = new URL(targetPath, baseUrl);
  if (targetUrl.origin !== baseUrl.origin) {
    throw new Error("A tela precisa estar no mesmo host da aplicacao.");
  }

  return targetUrl;
}

function resolveLoopbackTargetUrl(targetUrl: URL) {
  const port = process.env.PORT?.trim();
  if (!port || !/^\d+$/.test(port)) return null;

  const loopbackUrl = new URL(targetUrl);
  loopbackUrl.protocol = "http:";
  loopbackUrl.hostname = "127.0.0.1";
  loopbackUrl.port = port;
  loopbackUrl.username = "";
  loopbackUrl.password = "";
  return loopbackUrl;
}

function buildTargetHeaders(request: Request, targetUrl: URL, fetchUrl: URL) {
  const headers = new Headers({
    Accept: "text/html,application/xhtml+xml",
  });
  const cookie = request.headers.get("cookie");
  if (cookie) headers.set("cookie", cookie);

  if (fetchUrl.origin !== targetUrl.origin) {
    headers.set("host", targetUrl.host);
    headers.set("x-forwarded-host", targetUrl.host);
    headers.set("x-forwarded-proto", targetUrl.protocol.replace(":", ""));
  }

  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) headers.set("x-forwarded-for", forwardedFor);
  return headers;
}

function resolvePublicResponseUrl(responseUrl: string, targetUrl: URL, fetchUrl: URL) {
  if (!responseUrl) return targetUrl.toString();
  if (fetchUrl.origin === targetUrl.origin) return responseUrl;

  try {
    const parsed = new URL(responseUrl);
    if (parsed.origin !== fetchUrl.origin) return responseUrl;
    return new URL(`${parsed.pathname}${parsed.search}${parsed.hash}`, targetUrl.origin).toString();
  } catch {
    return responseUrl;
  }
}

function extractTitle(html: string) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match?.[1]?.replace(/\s+/g, " ").trim() || null;
}

export async function POST(request: Request) {
  const user = await authenticateRequest(request);
  const startedAt = Date.now();

  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { access, allowedCompanySlugs } = resolveAccess(user);

  if (!access.canOpen) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const rawBody = await request.json().catch(() => null);
  const validation = RequestSchema.safeParse(rawBody);

  if (!validation.success) {
    return NextResponse.json({ error: validation.error.issues[0]?.message || "Payload inválido" }, { status: 400 });
  }

  const payload = validation.data;
  const companySlug = payload.companySlug?.trim() || allowedCompanySlugs[0] || null;

  if (normalizeAutomationCompanyScope(companySlug) !== "testing-company") {
    return NextResponse.json({ error: "Runner interno disponível somente para o perfil da Testing Company." }, { status: 403 });
  }

  if (!access.hasGlobalCompanyVisibility && companySlug && !allowedCompanySlugs.includes(companySlug)) {
    return NextResponse.json({ error: "Empresa fora do escopo da sessão." }, { status: 403 });
  }

  let targetUrl: URL;
  try {
    targetUrl = resolveTargetUrl(payload.targetPath, request.url);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Payload invalido";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const startedAt = Date.now();
    const fetchUrl = resolveLoopbackTargetUrl(targetUrl) ?? targetUrl;
    const response = await fetch(fetchUrl, {
      method: "GET",
      headers: buildTargetHeaders(request, targetUrl, fetchUrl),
      cache: "no-store",
      redirect: "follow",
    });
    const html = await response.text();
    const title = extractTitle(html);
    const containsExpectedText = payload.expectedText
      ? html.toLowerCase().includes(payload.expectedText.toLowerCase())
      : true;
    const matchesTitleHint = payload.titleHint
      ? (title ?? "").toLowerCase().includes(payload.titleHint.toLowerCase())
      : true;
    const finalUrl = resolvePublicResponseUrl(response.url, targetUrl, fetchUrl);
    const redirectedToLogin = finalUrl.includes("/login");
    const durationMs = Date.now() - startedAt;

    await saveAutomationExecutionAudit({
      actorUserId: user.id,
      companySlug,
      durationMs,
      metadata: {
        fetchUrl: fetchUrl.toString(),
        finalUrl,
        redirectedToLogin,
        targetPath: payload.targetPath,
        targetUrl: targetUrl.toString(),
      },
      ok: response.ok && containsExpectedText && matchesTitleHint && !redirectedToLogin,
      route: "qc-page-smoke",
      statusCode: response.status,
    });

    return NextResponse.json({
      ok: response.ok && containsExpectedText && matchesTitleHint && !redirectedToLogin,
      result: {
        companySlug,
        containsExpectedText,
        durationMs,
        finalUrl,
        redirectedToLogin,
        status: response.status,
        statusText: response.statusText,
        targetPath: payload.targetPath,
        title,
        titleHintMatched: matchesTitleHint,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao validar a tela.";
    await saveAutomationExecutionAudit({
      actorUserId: user.id,
      companySlug,
      durationMs: Date.now() - startedAt,
      error: message,
      metadata: {
        targetPath: payload.targetPath,
        targetUrl: targetUrl.toString(),
      },
      ok: false,
      route: "qc-page-smoke",
      statusCode: 500,
    });

    return NextResponse.json(
      {
        error: message,
      },
      { status: 500 },
    );
  }
}
