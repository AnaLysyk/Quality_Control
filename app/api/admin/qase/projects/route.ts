import { NextRequest, NextResponse } from "next/server";

import { getClientQaseSettings } from "@/lib/qaseConfig";
import { createQaseClient, QaseError } from "@/lib/qaseSdk";
import { requireGlobalAdminWithStatus } from "@/lib/rbac/requireGlobalAdmin";

export const runtime = "nodejs";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

export async function POST(req: NextRequest) {
  const { admin, status } = await requireGlobalAdminWithStatus(req);
  if (!admin) {
    return NextResponse.json({ error: "Sem permissao" }, { status });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const requestedToken = typeof body?.token === "string" ? body.token.trim() : "";
  const requestedSlug = typeof body?.companySlug === "string" ? body.companySlug.trim().toLowerCase() : "";
  const requestedBaseUrl = typeof body?.baseUrl === "string" ? body.baseUrl.trim() : "";

  const settings = !requestedToken && requestedSlug ? await getClientQaseSettings(requestedSlug) : null;
  const token = requestedToken || settings?.token || "";
  const baseUrl = requestedBaseUrl || settings?.baseUrl || process.env.QASE_BASE_URL || "https://api.qase.io";

  if (!token) {
    return NextResponse.json({ error: "Informe um token da Qase para buscar os projetos." }, { status: 400 });
  }

  const client = createQaseClient({
    token,
    baseUrl,
    defaultFetchOptions: { cache: "no-store" },
  });

  try {
    const { data } = await client.getWithStatus<{ result?: { entities?: unknown[] } }>("/project");
    const entities = Array.isArray(data.result?.entities) ? data.result.entities : [];
    const items = entities
      .map((item) => {
        const record = asRecord(item) ?? {};
        const code =
          typeof record.code === "string"
            ? record.code.trim().toUpperCase()
            : typeof record.project === "string"
              ? record.project.trim().toUpperCase()
              : "";
        const title =
          typeof record.title === "string"
            ? record.title.trim()
            : typeof record.name === "string"
              ? record.name.trim()
              : code;
        if (!code) return null;
        return {
          code,
          title: title || code,
        };
      })
      .filter((item): item is { code: string; title: string } => Boolean(item));

    return NextResponse.json({ items }, { status: 200 });
  } catch (error) {
    const statusCode = error instanceof QaseError ? error.status : 500;
    const message =
      statusCode === 401 || statusCode === 403
        ? "Token da Qase invalido ou sem acesso aos projetos."
        : "Nao foi possivel consultar os projetos na Qase.";
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
