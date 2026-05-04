import { authenticateRequest } from "@/lib/jwtAuth";
import { apiFail, apiOk } from "@/lib/apiResponse";
import { resolveRunRole, getRunMockRole, canCreateRun } from "@/lib/rbac/runs";
import { isCompanyUser } from "@/lib/rbac/companyAccess";
import { getClientQaseSettings } from "@/lib/qaseConfig";
import { QaseClient, QaseError } from "@/lib/qaseSdk";

const QASE_BASE_URL = (process.env.QASE_BASE_URL || "https://api.qase.io").replace(/\/(v1|v2)\/?$/, "");
const QASE_TOKEN = process.env.QASE_TOKEN || process.env.QASE_API_TOKEN || "";

type RouteParams = { params: Promise<{ code: string; id: string }> };

function validateProjectCode(code: string): string | null {
  const trimmed = code.trim().toUpperCase();
  return trimmed.length >= 2 && trimmed.length <= 10 ? trimmed : null;
}

function parseRunId(value: string): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 && Number.isInteger(parsed) ? parsed : null;
}

// POST /api/v1/results/[code]/[id]/bulk
export async function POST(request: Request, { params }: RouteParams) {
  const { code, id } = await params;
  const projectCode = validateProjectCode(code);
  const runId = parseRunId(id);

  if (!projectCode || !runId) {
    return apiFail(request, "Invalid project code or run id", {
      status: 400,
      code: "VALIDATION_ERROR",
      extra: { error: { message: "Invalid project code or run id" } },
    });
  }

  const auth = await authenticateRequest(request);
  const mockRole = await getRunMockRole();
  const effectiveAuth =
    auth ?? (mockRole ? { id: `mock-${mockRole}`, email: `${mockRole}@example.com`, isGlobalAdmin: mockRole === "leader_tc" } : null);

  if (!effectiveAuth) {
    return apiFail(request, "Não autorizado", {
      status: 401,
      code: "AUTH_REQUIRED",
      extra: { error: { message: "Não autorizado" } },
    });
  }
  if (auth && !auth.isGlobalAdmin && !isCompanyUser(auth)) {
    return apiFail(request, "Acesso proibido", {
      status: 403,
      code: "FORBIDDEN",
      extra: { error: { message: "Acesso proibido" } },
    });
  }

  const role = auth ? await resolveRunRole(effectiveAuth) : mockRole ?? "testing_company_user";
  if (!canCreateRun(role)) {
    return apiFail(request, "Acesso proibido", {
      status: 403,
      code: "FORBIDDEN",
      extra: { error: { message: "Acesso proibido" } },
    });
  }

  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body?.results) || body.results.length === 0) {
    return apiFail(request, "Body inválido: 'results' deve ser array não vazio", {
      status: 400,
      code: "VALIDATION_ERROR",
      extra: { error: { message: "Body inválido: 'results' deve ser array não vazio" } },
    });
  }
  if (body.results.length > 2000) {
    return apiFail(request, "Payload muito grande: máximo 2000 resultados por requisição", {
      status: 413,
      code: "PAYLOAD_TOO_LARGE",
      extra: { error: { message: "Máximo 2000 resultados por requisição" } },
    });
  }

  const companySlug = auth?.companySlug ?? null;
  const qaseSettings = companySlug ? await getClientQaseSettings(companySlug) : null;
  const token = qaseSettings?.token || QASE_TOKEN;
  const baseUrl = (qaseSettings?.baseUrl || QASE_BASE_URL).replace(/\/+$/, "");

  if (!token) {
    return apiFail(request, "QASE_API_TOKEN ausente", {
      status: 503,
      code: "ENV_MISSING",
      extra: { error: { message: "QASE_API_TOKEN ausente" } },
    });
  }

  const client = new QaseClient({ token, baseUrl });
  try {
    const data = await client.bulkCreateResults(projectCode, runId, body as { results: Record<string, unknown>[] });
    return apiOk(request, data, "OK", { extra: data });
  } catch (err) {
    if (err instanceof QaseError) {
      return apiFail(request, err.message, {
        status: err.status,
        code: "QASE_ERROR",
        extra: { error: { message: err.message } },
      });
    }
    return apiFail(request, "Erro interno", {
      status: 500,
      code: "INTERNAL_ERROR",
      extra: { error: { message: "Erro interno" } },
    });
  }
}
