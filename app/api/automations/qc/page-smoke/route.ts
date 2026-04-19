import { NextResponse } from "next/server";
import { z } from "zod";

import { resolveAutomationAccess, resolveAutomationAllowedCompanySlugs } from "@/lib/automations/access";
import { normalizeAutomationCompanyScope } from "@/lib/automations/companyScope";
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
  if (!targetPath.startsWith("/")) {
    throw new Error("A tela precisa ser interna e começar com '/'.");
  }

  return new URL(targetPath, requestUrl);
}

function extractTitle(html: string) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match?.[1]?.replace(/\s+/g, " ").trim() || null;
}

export async function POST(request: Request) {
  const user = await authenticateRequest(request);

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

  try {
    const targetUrl = resolveTargetUrl(payload.targetPath, request.url);
    const startedAt = Date.now();
    const response = await fetch(targetUrl, {
      method: "GET",
      headers: {
        Accept: "text/html,application/xhtml+xml",
        cookie: request.headers.get("cookie") ?? "",
      },
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
    const finalUrl = response.url || targetUrl.toString();
    const redirectedToLogin = finalUrl.includes("/login");
    const durationMs = Date.now() - startedAt;

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
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Falha ao validar a tela.",
      },
      { status: 500 },
    );
  }
}
