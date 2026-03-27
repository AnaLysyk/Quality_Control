import { NextRequest, NextResponse } from "next/server";

import { getClientQaseSettings } from "@/lib/qaseConfig";
import { createQaseClient, QaseError } from "@/lib/qaseSdk";
import { getAccessContext } from "@/lib/auth/session";
import { canManageInstitutionalCompanyAccess } from "@/lib/companyProfileAccess";

export const runtime = "nodejs";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

export async function POST(req: NextRequest) {
  const access = await getAccessContext(req);
  if (!access) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  }
  if (!access.companyId && !access.companySlug) {
    return NextResponse.json({ error: "Sem empresa vinculada" }, { status: 403 });
  }
  if (!canManageInstitutionalCompanyAccess(access)) {
    return NextResponse.json({ error: "Sem permissao para consultar a integracao da empresa" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const requestedToken = typeof body?.token === "string" ? body.token.trim() : "";
  const requestedBaseUrl = typeof body?.baseUrl === "string" ? body.baseUrl.trim() : "";
  const fetchAll = Boolean(body?.all);
  const pageLimit = typeof body?.limit === "number" && body.limit > 0 ? Math.min(200, body.limit) : 100;

  const companySlug = access.companySlug?.trim().toLowerCase() || "";
  const settings = !requestedToken && companySlug ? await getClientQaseSettings(companySlug) : null;
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
    const items: Array<{ code: string; title: string }> = [];

    if (!fetchAll) {
      const { data } = await client.getWithStatus<{ result?: { entities?: unknown[] } }>("/project");
      const entities = Array.isArray(data.result?.entities) ? data.result.entities : [];
      const pageItems = entities
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
          return { code, title: title || code };
        })
        .filter((item): item is { code: string; title: string } => Boolean(item));
      items.push(...pageItems);
    } else {
      let offset = 0;
      while (true) {
        const path = `/project?limit=${pageLimit}&offset=${offset}`;
        const { data } = await client.getWithStatus<{ result?: { entities?: unknown[] } }>(path);
        const entities = Array.isArray(data.result?.entities) ? data.result.entities : [];
        const pageItems = entities
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
            return { code, title: title || code };
          })
          .filter((item): item is { code: string; title: string } => Boolean(item));
        if (pageItems.length === 0) break;
        items.push(...pageItems);
        if (pageItems.length < pageLimit) break;
        offset += pageLimit;
      }
    }

    const seen = new Set<string>();
    const deduped = items.filter((item) => {
      if (seen.has(item.code)) return false;
      seen.add(item.code);
      return true;
    });

    return NextResponse.json({ items: deduped }, { status: 200 });
  } catch (error) {
    const statusCode = error instanceof QaseError ? error.status : 500;
    const message =
      statusCode === 401 || statusCode === 403
        ? "Token da Qase invalido ou sem acesso aos projetos."
        : "Nao foi possivel consultar os projetos na Qase.";
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
