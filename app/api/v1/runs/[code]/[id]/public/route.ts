import { authenticateRequest } from "@/lib/jwtAuth";
import { apiFail, apiOk } from "@/lib/apiResponse";
import { resolveRunRole, getRunMockRole, canEditRun } from "@/lib/rbac/runs";
import { isCompanyUser } from "@/lib/rbac/companyAccess";
import { getClientQaseSettings } from "@/lib/qaseConfig";
import { QaseClient, QaseError } from "@/lib/qaseSdk";

const QASE_BASE_URL = (process.env.QASE_BASE_URL || "https://api.qase.io").replace(/\/(v1|v2)\/?$/, "");
const QASE_TOKEN = process.env.QASE_TOKEN || process.env.QASE_API_TOKEN || "";

type RouteParams = { params: Promise<{ code: string; id: string }> };

function parseRunId(value: string): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 && Number.isInteger(parsed) ? parsed : null;
}

function validateProjectCode(code: string): string | null {
  const trimmed = code.trim().toUpperCase();
  return trimmed.length >= 2 && trimmed.length <= 10 ? trimmed : null;
}

// PATCH /api/v1/runs/[code]/[id]/public
export async function PATCH(request: Request, { params }: RouteParams) {
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

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body.status !== "boolean") {
    return apiFail(request, "Request body must include boolean 'status' field", {
      status: 400,
      code: "VALIDATION_ERROR",
      extra: { error: { message: "Request body must include boolean 'status' field" } },
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

  const role = auth ? await resolveRunRole(effectiveAuth) : mockRole ?? "user";
  if (!canEditRun(role)) {
    return apiFail(request, "Acesso proibido", {
      status: 403,
      code: "FORBIDDEN",
      extra: { error: { message: "Acesso proibido" } },
    });
  }

  const companySlug = auth?.companySlug ?? null;
  const qaseSettings = companySlug ? await getClientQaseSettings(companySlug) : null;
  const token = (qaseSettings?.token) || QASE_TOKEN;
  const baseUrl = (qaseSettings?.baseUrl || QASE_BASE_URL).replace(/\/+$/, "");

  if (!token) {
    return apiFail(request, "QASE_API_TOKEN ausente", {
      status: 503,
      code: "ENV_MISSING",
      extra: { error: { message: "QASE_API_TOKEN ausente" } },
    });
  }

  try {
    const client = new QaseClient({ token, baseUrl });
    const result = await client.updateRunPublicity(projectCode, runId, body.status);
    return apiOk(request, { data: result }, "OK", { extra: { data: result } });
  } catch (error) {
    const status = error instanceof QaseError ? error.status : 500;
    const msg = error instanceof Error ? error.message : "Erro ao atualizar publicidade da run";
    return apiFail(request, msg, {
      status,
      code: "UPSTREAM_ERROR",
      extra: { error: { message: msg } },
    });
  }
}
