import { authenticateRequest } from "@/lib/jwtAuth";
import { apiFail, apiOk } from "@/lib/apiResponse";
import { resolveRunRole, getRunMockRole, canEditRun } from "@/lib/rbac/runs";
import { isCompanyUser } from "@/lib/rbac/companyAccess";
import { getClientQaseSettings } from "@/lib/qaseConfig";
import { QaseClient, QaseError } from "@/lib/qaseSdk";

const QASE_BASE_URL = (process.env.QASE_BASE_URL || "https://api.qase.io").replace(/\/(v1|v2)\/?$/, "");
const QASE_TOKEN = process.env.QASE_TOKEN || process.env.QASE_API_TOKEN || "";

type RouteParams = { params: Promise<{ code: string }> };

function validateProjectCode(code: string): string | null {
  const trimmed = code.trim().toUpperCase();
  return trimmed.length >= 2 && trimmed.length <= 10 ? trimmed : null;
}

// POST /api/v1/cases/[code]/external-issue/attach
export async function POST(request: Request, { params }: RouteParams) {
  const { code } = await params;
  const projectCode = validateProjectCode(code);
  if (!projectCode) {
    return apiFail(request, "Invalid project code", {
      status: 400,
      code: "VALIDATION_ERROR",
      extra: { error: { message: "Invalid project code" } },
    });
  }

  const auth = await authenticateRequest(request);
  const mockRole = await getRunMockRole();
  const effectiveAuth =
    auth ?? (mockRole ? { id: `mock-${mockRole}`, email: `${mockRole}@example.com`, isGlobalAdmin: mockRole === "leader_tc" } : null);

  if (!effectiveAuth) {
    return apiFail(request, "Não autorizado", { status: 401, code: "AUTH_REQUIRED", extra: { error: { message: "Não autorizado" } } });
  }
  if (auth && !auth.isGlobalAdmin && !isCompanyUser(auth)) {
    return apiFail(request, "Acesso proibido", { status: 403, code: "FORBIDDEN", extra: { error: { message: "Acesso proibido" } } });
  }

  const role = auth ? await resolveRunRole(effectiveAuth) : mockRole ?? "user";
  if (!canEditRun(role)) {
    return apiFail(request, "Acesso proibido", { status: 403, code: "FORBIDDEN", extra: { error: { message: "Acesso proibido" } } });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || !body.type || !Array.isArray(body.links)) {
    return apiFail(request, "Body inválido: 'type' e 'links' obrigatórios", {
      status: 400,
      code: "VALIDATION_ERROR",
      extra: { error: { message: "Body inválido: 'type' e 'links' obrigatórios" } },
    });
  }

  const companySlug = auth?.companySlug ?? null;
  const qaseSettings = companySlug ? await getClientQaseSettings(companySlug) : null;
  const token = qaseSettings?.token || QASE_TOKEN;
  const baseUrl = (qaseSettings?.baseUrl || QASE_BASE_URL).replace(/\/+$/, "");
  if (!token) {
    return apiFail(request, "QASE_API_TOKEN ausente", { status: 503, code: "ENV_MISSING", extra: { error: { message: "QASE_API_TOKEN ausente" } } });
  }

  const client = new QaseClient({ token, baseUrl });
  try {
    const data = await client.attachExternalIssues(projectCode, body as Record<string, unknown>);
    return apiOk(request, data, "OK", { extra: data });
  } catch (err) {
    if (err instanceof QaseError) {
      return apiFail(request, err.message, { status: err.status, code: "QASE_ERROR", extra: { error: { message: err.message } } });
    }
    return apiFail(request, "Erro interno", { status: 500, code: "INTERNAL_ERROR", extra: { error: { message: "Erro interno" } } });
  }
}
