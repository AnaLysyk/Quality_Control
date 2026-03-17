import { NextRequest, NextResponse } from "next/server";

import { getClientQaseSettings } from "@/lib/qaseConfig";
import { createQaseClient, QaseError } from "@/lib/qaseSdk";
import { requireGlobalAdminWithStatus } from "@/lib/rbac/requireGlobalAdmin";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { admin, status } = await requireGlobalAdminWithStatus(req);
  if (!admin) return NextResponse.json({ error: "Sem permissao" }, { status });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const requestedToken = typeof body?.token === "string" ? body.token.trim() : "";
  const requestedSlug = typeof body?.companySlug === "string" ? body.companySlug.trim().toLowerCase() : "";
  const projectCode = typeof body?.code === "string" ? body.code.trim().toUpperCase() : "";
  const requestedBaseUrl = typeof body?.baseUrl === "string" ? body.baseUrl.trim() : "";

  if (!projectCode) return NextResponse.json({ error: "Informe o codigo do projeto a validar." }, { status: 400 });

  const settings = !requestedToken && requestedSlug ? await getClientQaseSettings(requestedSlug) : null;
  const token = requestedToken || settings?.token || "";
  const baseUrl = requestedBaseUrl || settings?.baseUrl || process.env.QASE_BASE_URL || "https://api.qase.io";

  if (!token) return NextResponse.json({ error: "Token da Qase ausente." }, { status: 400 });

  const client = createQaseClient({ token, baseUrl, defaultFetchOptions: { cache: "no-store" } });

  try {
    // Qase supports GET /project/{code}
    const path = `/project/${encodeURIComponent(projectCode)}`;
    const { data } = await client.getWithStatus<{ result?: unknown }>(path);
    // if success, consider valid
    return NextResponse.json({ valid: true, project: data.result ?? null }, { status: 200 });
  } catch (err) {
    const statusCode = err instanceof QaseError ? err.status : 500;
    if (statusCode === 404) return NextResponse.json({ valid: false, error: "Projeto nao encontrado" }, { status: 404 });
    if (statusCode === 401 || statusCode === 403) return NextResponse.json({ valid: false, error: "Token invalido ou sem acesso" }, { status: statusCode });
    return NextResponse.json({ valid: false, error: "Erro ao validar projeto" }, { status: statusCode });
  }
}
