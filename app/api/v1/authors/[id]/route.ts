import { authenticateRequest } from "@/lib/jwtAuth";
import { apiFail, apiOk } from "@/lib/apiResponse";
import { getRunMockRole } from "@/lib/rbac/runs";
import { getClientQaseSettings } from "@/lib/qaseConfig";
import { QaseClient, QaseError } from "@/lib/qaseSdk";

const QASE_BASE_URL = (process.env.QASE_BASE_URL || "https://api.qase.io").replace(/\/(v1|v2)\/?$/, "");
const QASE_TOKEN = process.env.QASE_TOKEN || process.env.QASE_API_TOKEN || "";

type RouteParams = { params: Promise<{ id: string }> };

function parseId(value: string): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 && Number.isInteger(parsed) ? parsed : null;
}

// GET /api/v1/authors/[id]
export async function GET(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const authorId = parseId(id);

  if (!authorId) {
    return apiFail(request, "Invalid author id", { status: 400, code: "VALIDATION_ERROR", extra: { error: { message: "Invalid author id" } } });
  }

  const auth = await authenticateRequest(request);
  const mockRole = await getRunMockRole();
  const effectiveAuth =
    auth ?? (mockRole ? { id: `mock-${mockRole}`, email: `${mockRole}@example.com`, isGlobalAdmin: mockRole === "leader_tc" } : null);

  if (!effectiveAuth) {
    return apiFail(request, "Não autorizado", { status: 401, code: "AUTH_REQUIRED", extra: { error: { message: "Não autorizado" } } });
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
    const data = await client.getAuthor(authorId);
    return apiOk(request, data, "OK", { extra: data });
  } catch (err) {
    if (err instanceof QaseError) {
      return apiFail(request, err.message, { status: err.status, code: "QASE_ERROR", extra: { error: { message: err.message } } });
    }
    return apiFail(request, "Erro interno", { status: 500, code: "INTERNAL_ERROR", extra: { error: { message: "Erro interno" } } });
  }
}
