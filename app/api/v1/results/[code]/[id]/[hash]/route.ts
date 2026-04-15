import { authenticateRequest } from "@/lib/jwtAuth";
import { apiFail, apiOk } from "@/lib/apiResponse";
import { resolveRunRole, getRunMockRole, canEditRun, canDeleteRun } from "@/lib/rbac/runs";
import { isCompanyUser } from "@/lib/rbac/companyAccess";
import { getClientQaseSettings } from "@/lib/qaseConfig";
import { QaseClient, QaseError } from "@/lib/qaseSdk";

const QASE_BASE_URL = (process.env.QASE_BASE_URL || "https://api.qase.io").replace(/\/(v1|v2)\/?$/, "");
const QASE_TOKEN = process.env.QASE_TOKEN || process.env.QASE_API_TOKEN || "";

type RouteParams = { params: Promise<{ code: string; id: string; hash: string }> };

function validateProjectCode(code: string): string | null {
  const trimmed = code.trim().toUpperCase();
  return trimmed.length >= 2 && trimmed.length <= 10 ? trimmed : null;
}

function parseRunId(value: string): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 && Number.isInteger(parsed) ? parsed : null;
}

async function resolveAuth(request: Request) {
  const auth = await authenticateRequest(request);
  const mockRole = await getRunMockRole();
  const effectiveAuth =
    auth ?? (mockRole ? { id: `mock-${mockRole}`, email: `${mockRole}@example.com`, isGlobalAdmin: mockRole === "leader_tc" } : null);
  return { auth, mockRole, effectiveAuth };
}

function buildClient(auth: Awaited<ReturnType<typeof authenticateRequest>>, qaseSettings: { token?: string; baseUrl?: string } | null) {
  const token = qaseSettings?.token || QASE_TOKEN;
  const baseUrl = (qaseSettings?.baseUrl || QASE_BASE_URL).replace(/\/+$/, "");
  return { token, baseUrl, client: token ? new QaseClient({ token, baseUrl }) : null };
}

// GET /api/v1/results/[code]/[id]/[hash]
export async function GET(request: Request, { params }: RouteParams) {
  const { code, hash } = await params;
  const projectCode = validateProjectCode(code);
  if (!projectCode || !hash) {
    return apiFail(request, "Invalid project code or hash", {
      status: 400,
      code: "VALIDATION_ERROR",
      extra: { error: { message: "Invalid project code or hash" } },
    });
  }

  const { auth, effectiveAuth } = await resolveAuth(request);
  if (!effectiveAuth) {
    return apiFail(request, "Não autorizado", { status: 401, code: "AUTH_REQUIRED", extra: { error: { message: "Não autorizado" } } });
  }

  const companySlug = auth?.companySlug ?? null;
  const qaseSettings = companySlug ? await getClientQaseSettings(companySlug) : null;
  const { token, client } = buildClient(auth, qaseSettings);
  if (!token || !client) {
    return apiFail(request, "QASE_API_TOKEN ausente", { status: 503, code: "ENV_MISSING", extra: { error: { message: "QASE_API_TOKEN ausente" } } });
  }

  try {
    const data = await client.getResult(projectCode, hash);
    return apiOk(request, data, "OK", { extra: data });
  } catch (err) {
    if (err instanceof QaseError) {
      return apiFail(request, err.message, { status: err.status, code: "QASE_ERROR", extra: { error: { message: err.message } } });
    }
    return apiFail(request, "Erro interno", { status: 500, code: "INTERNAL_ERROR", extra: { error: { message: "Erro interno" } } });
  }
}

// PATCH /api/v1/results/[code]/[id]/[hash]
export async function PATCH(request: Request, { params }: RouteParams) {
  const { code, id, hash } = await params;
  const projectCode = validateProjectCode(code);
  const runId = parseRunId(id);

  if (!projectCode || !runId || !hash) {
    return apiFail(request, "Invalid project code, run id or hash", {
      status: 400,
      code: "VALIDATION_ERROR",
      extra: { error: { message: "Invalid project code, run id or hash" } },
    });
  }

  const { auth, mockRole, effectiveAuth } = await resolveAuth(request);
  if (!effectiveAuth) {
    return apiFail(request, "Não autorizado", { status: 401, code: "AUTH_REQUIRED", extra: { error: { message: "Não autorizado" } } });
  }
  if (auth && !auth.isGlobalAdmin && !isCompanyUser(auth)) {
    return apiFail(request, "Acesso proibido", { status: 403, code: "FORBIDDEN", extra: { error: { message: "Acesso proibido" } } });
  }

  const role = auth ? await resolveRunRole(effectiveAuth) : mockRole ?? "testing_company_user";
  if (!canEditRun(role)) {
    return apiFail(request, "Acesso proibido", { status: 403, code: "FORBIDDEN", extra: { error: { message: "Acesso proibido" } } });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return apiFail(request, "Body inválido", { status: 400, code: "VALIDATION_ERROR", extra: { error: { message: "Body inválido" } } });
  }

  const allowedFields = ["status", "time_ms", "defect", "attachments", "stacktrace", "comment", "steps"];
  const sanitized = Object.fromEntries(Object.entries(body as Record<string, unknown>).filter(([k]) => allowedFields.includes(k)));

  const companySlug = auth?.companySlug ?? null;
  const qaseSettings = companySlug ? await getClientQaseSettings(companySlug) : null;
  const { token, client } = buildClient(auth, qaseSettings);
  if (!token || !client) {
    return apiFail(request, "QASE_API_TOKEN ausente", { status: 503, code: "ENV_MISSING", extra: { error: { message: "QASE_API_TOKEN ausente" } } });
  }

  try {
    const data = await client.updateResult(projectCode, runId, hash, sanitized);
    return apiOk(request, data, "OK", { extra: data });
  } catch (err) {
    if (err instanceof QaseError) {
      return apiFail(request, err.message, { status: err.status, code: "QASE_ERROR", extra: { error: { message: err.message } } });
    }
    return apiFail(request, "Erro interno", { status: 500, code: "INTERNAL_ERROR", extra: { error: { message: "Erro interno" } } });
  }
}

// DELETE /api/v1/results/[code]/[id]/[hash]
export async function DELETE(request: Request, { params }: RouteParams) {
  const { code, id, hash } = await params;
  const projectCode = validateProjectCode(code);
  const runId = parseRunId(id);

  if (!projectCode || !runId || !hash) {
    return apiFail(request, "Invalid project code, run id or hash", {
      status: 400,
      code: "VALIDATION_ERROR",
      extra: { error: { message: "Invalid project code, run id or hash" } },
    });
  }

  const { auth, mockRole, effectiveAuth } = await resolveAuth(request);
  if (!effectiveAuth) {
    return apiFail(request, "Não autorizado", { status: 401, code: "AUTH_REQUIRED", extra: { error: { message: "Não autorizado" } } });
  }
  if (auth && !auth.isGlobalAdmin && !isCompanyUser(auth)) {
    return apiFail(request, "Acesso proibido", { status: 403, code: "FORBIDDEN", extra: { error: { message: "Acesso proibido" } } });
  }

  const role = auth ? await resolveRunRole(effectiveAuth) : mockRole ?? "testing_company_user";
  if (!canDeleteRun(role)) {
    return apiFail(request, "Acesso proibido", { status: 403, code: "FORBIDDEN", extra: { error: { message: "Acesso proibido" } } });
  }

  const companySlug = auth?.companySlug ?? null;
  const qaseSettings = companySlug ? await getClientQaseSettings(companySlug) : null;
  const { token, client } = buildClient(auth, qaseSettings);
  if (!token || !client) {
    return apiFail(request, "QASE_API_TOKEN ausente", { status: 503, code: "ENV_MISSING", extra: { error: { message: "QASE_API_TOKEN ausente" } } });
  }

  try {
    const data = await client.deleteResult(projectCode, runId, hash);
    return apiOk(request, data, "OK", { extra: data });
  } catch (err) {
    if (err instanceof QaseError) {
      return apiFail(request, err.message, { status: err.status, code: "QASE_ERROR", extra: { error: { message: err.message } } });
    }
    return apiFail(request, "Erro interno", { status: 500, code: "INTERNAL_ERROR", extra: { error: { message: "Erro interno" } } });
  }
}
