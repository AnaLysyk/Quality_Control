import { NextRequest, NextResponse } from "next/server";

import { getClientQaseSettings } from "@/backend/qaseConfig";
import { createQaseClient, QaseError } from "@/backend/qaseSdk";
import { requireGlobalAdminWithStatus } from "@/backend/rbac/requireGlobalAdmin";

export const runtime = "nodejs";

async function parseValidationRequest(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  return {
    requestedToken: typeof body?.token === "string" ? body.token.trim() : "",
    requestedSlug: typeof body?.companySlug === "string" ? body.companySlug.trim().toLowerCase() : "",
    projectCode: typeof body?.code === "string" ? body.code.trim().toUpperCase() : "",
    requestedBaseUrl: typeof body?.baseUrl === "string" ? body.baseUrl.trim() : "",
  };
}

async function resolveQaseCredentials(input: Awaited<ReturnType<typeof parseValidationRequest>>) {
  const settings = !input.requestedToken && input.requestedSlug ? await getClientQaseSettings(input.requestedSlug) : null;
  return {
    token: input.requestedToken || settings?.token || "",
    baseUrl: input.requestedBaseUrl || settings?.baseUrl || process.env.QASE_BASE_URL || "https://api.qase.io",
  };
}

function validationErrorResponse(err: unknown) {
  const statusCode = err instanceof QaseError ? err.status : 500;
  if (statusCode === 404) return NextResponse.json({ valid: false, error: "Projeto não encontrado" }, { status: 404 });
  if (statusCode === 401 || statusCode === 403) return NextResponse.json({ valid: false, error: "Token invalido ou sem acesso" }, { status: statusCode });
  return NextResponse.json({ valid: false, error: "Erro ao validar projeto" }, { status: statusCode });
}

export async function POST(req: NextRequest) {
  const { admin, status } = await requireGlobalAdminWithStatus(req);
  if (!admin) return NextResponse.json({ error: "Sem permissão" }, { status });

  const request = await parseValidationRequest(req);
  if (!request.projectCode) return NextResponse.json({ error: "Informe o codigo do projeto a validar." }, { status: 400 });

  const { token, baseUrl } = await resolveQaseCredentials(request);
  if (!token) return NextResponse.json({ error: "Token da Qase ausente." }, { status: 400 });

  const client = createQaseClient({ token, baseUrl, defaultFetchOptions: { cache: "no-store" } });

  try {
    // Qase supports GET /project/{code}
    const path = `/project/${encodeURIComponent(request.projectCode)}`;
    const { data } = await client.getWithStatus<{ result?: unknown }>(path);
    // if success, consider valid
    return NextResponse.json({ valid: true, project: data.result ?? null }, { status: 200 });
  } catch (err) {
    return validationErrorResponse(err);
  }
}

