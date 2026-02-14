import { authenticateRequest } from "@/lib/jwtAuth";
import { apiFail, apiOk } from "@/lib/apiResponse";
import { canCreateRun, getRunMockRole, resolveRunRole } from "@/lib/rbac/runs";
import { isCompanyUser } from "@/lib/rbac/companyAccess";

const QASE_BASE_URL = (process.env.QASE_BASE_URL || "https://api.qase.io").replace(/\/(v1|v2)\/?$/, "");
const QASE_TOKEN = process.env.QASE_TOKEN || process.env.QASE_API_TOKEN || "";
const DEFAULT_PROJECT =
  process.env.NEXT_PUBLIC_QASE_DEFAULT_PROJECT ||
  process.env.NEXT_PUBLIC_QASE_PROJECT ||
  process.env.QASE_DEFAULT_PROJECT ||
  "";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const ip = request.headers.get("x-forwarded-for") || "unknown";
  const timestamp = new Date().toISOString();
  try {
    const auth = await authenticateRequest(request);
    const mockRole = await getRunMockRole();
    if (!auth && !mockRole) {
      console.info("[AUDIT] GET /v1/runs denied: no auth", { ip, timestamp });
      return apiFail(request, "Nao autorizado", {
        status: 401,
        code: "AUTH_REQUIRED",
        extra: { error: { message: "Nao autorizado" } },
      });
    }
    if (auth && !isCompanyUser(auth)) {
      console.info("[AUDIT] GET /v1/runs forbidden: not company user", { user: auth?.email, ip, timestamp });
      return apiFail(request, "Acesso proibido", {
        status: 403,
        code: "FORBIDDEN",
        extra: { error: { message: "Acesso proibido" } },
      });
    }
    if (!auth && mockRole && mockRole !== "company") {
      console.info("[AUDIT] GET /v1/runs forbidden: mockRole not company", { mockRole, ip, timestamp });
      return apiFail(request, "Acesso proibido", {
        status: 403,
        code: "FORBIDDEN",
        extra: { error: { message: "Acesso proibido" } },
      });
    }

    const project = normalizeString(url.searchParams.get("project")) || DEFAULT_PROJECT;
    if (!project) {
      console.info("[AUDIT] GET /v1/runs validation error: missing project", { user: auth?.email, ip, timestamp });
      return apiFail(request, "Missing project", {
        status: 400,
        code: "VALIDATION_ERROR",
        extra: { error: { message: "Missing project" } },
      });
    }

    if (!QASE_TOKEN) {
      const out = { data: [], warning: "QASE_API_TOKEN ausente" };
      console.info("[AUDIT] GET /v1/runs warning: QASE_API_TOKEN missing", { user: auth?.email, ip, timestamp });
      return apiOk(request, out, "OK", { extra: out });
    }

    const res = await fetch(`${QASE_BASE_URL}/v1/run/${encodeURIComponent(project)}?limit=50`, {
      headers: { Token: QASE_TOKEN, Accept: "application/json" },
      cache: "no-store",
    });

    const json = (await res.json().catch(() => null)) as unknown;
    if (!res.ok) {
      const message = asRecord(json)?.error && asRecord(asRecord(json)?.error)?.message;
      const msg = (message as string) || "Erro ao consultar Qase";
      console.info("[AUDIT] GET /v1/runs upstream error", { user: auth?.email, ip, timestamp, status: res.status, msg });
      return apiFail(request, msg, {
        status: res.status,
        code: "UPSTREAM_ERROR",
        details: json,
        extra: { error: { message: msg } },
      });
    }

    const entities = (asRecord(asRecord(json)?.result)?.entities as unknown[]) || [];
    const out = { data: entities };
    console.info("[AUDIT] GET /v1/runs success", { user: auth?.email, ip, timestamp, project, count: entities.length });
    return apiOk(request, out, "OK", { extra: out });
  } catch (err) {
    console.error("[AUDIT] GET /v1/runs exception", { ip, timestamp, error: (err as Error)?.message });
    return apiFail(request, "Erro interno do servidor", {
      status: 500,
      code: "INTERNAL_ERROR",
      extra: { error: { message: "Erro interno do servidor" } },
    });
  }
}

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for") || "unknown";
  const timestamp = new Date().toISOString();
  try {
    const body = (await request.json().catch(() => null)) as unknown;
    const auth = await authenticateRequest(request);
    const mockRole = await getRunMockRole();
    const effectiveAuth =
      auth ?? (mockRole ? { id: `mock-${mockRole}`, email: `${mockRole}@example.com`, isGlobalAdmin: mockRole === "admin" } : null);

    if (!effectiveAuth) {
      console.info("[AUDIT] POST /v1/runs denied: no auth", { ip, timestamp });
      return apiFail(request, "Nao autorizado", {
        status: 401,
        code: "AUTH_REQUIRED",
        extra: { error: { message: "Nao autorizado" } },
      });
    }
    if (auth && !isCompanyUser(auth)) {
      console.info("[AUDIT] POST /v1/runs forbidden: not company user", { user: auth?.email, ip, timestamp });
      return apiFail(request, "Acesso proibido", {
        status: 403,
        code: "FORBIDDEN",
        extra: { error: { message: "Acesso proibido" } },
      });
    }
    if (!auth && mockRole && mockRole !== "company") {
      console.info("[AUDIT] POST /v1/runs forbidden: mockRole not company", { mockRole, ip, timestamp });
      return apiFail(request, "Acesso proibido", {
        status: 403,
        code: "FORBIDDEN",
        extra: { error: { message: "Acesso proibido" } },
      });
    }
    const role = auth ? await resolveRunRole(effectiveAuth) : mockRole ?? "user";
    if (!canCreateRun(role)) {
      console.info("[AUDIT] POST /v1/runs forbidden: cannot create run", { user: auth?.email, ip, timestamp, role });
      return apiFail(request, "Acesso proibido", {
        status: 403,
        code: "FORBIDDEN",
        extra: { error: { message: "Acesso proibido" } },
      });
    }

    const rec = asRecord(body) ?? {};
    const project = normalizeString(rec.project) || DEFAULT_PROJECT;
    const title = normalizeString(rec.title);
    const description = normalizeString(rec.description) || "";
    const customType = normalizeString(rec.custom_type);

    if (!project || !title) {
      console.info("[AUDIT] POST /v1/runs validation error: missing project or title", { user: auth?.email, ip, timestamp });
      return apiFail(request, "Missing project or title", {
        status: 400,
        code: "VALIDATION_ERROR",
        extra: { error: { message: "Missing project or title" } },
      });
    }

    if (!QASE_TOKEN) {
      console.info("[AUDIT] POST /v1/runs warning: QASE_API_TOKEN missing", { user: auth?.email, ip, timestamp });
      return apiFail(request, "QASE_API_TOKEN ausente", {
        status: 503,
        code: "ENV_MISSING",
        extra: { error: { message: "QASE_API_TOKEN ausente" } },
      });
    }

    const payload: Record<string, unknown> = {
      title,
      description,
    };
    if (customType) {
      payload.custom_fields = { custom_type: customType };
    }

    const res = await fetch(`${QASE_BASE_URL}/v1/run/${encodeURIComponent(project)}`, {
      method: "POST",
      headers: { Token: QASE_TOKEN, Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    const json = (await res.json().catch(() => null)) as unknown;
    if (!res.ok) {
      const message = asRecord(json)?.error && asRecord(asRecord(json)?.error)?.message;
      const msg = (message as string) || "Erro ao criar run";
      console.info("[AUDIT] POST /v1/runs upstream error", { user: auth?.email, ip, timestamp, status: res.status, msg });
      return apiFail(request, msg, {
        status: res.status,
        code: "UPSTREAM_ERROR",
        details: json,
        extra: { error: { message: msg } },
      });
    }

    const out = { data: asRecord(json)?.result ?? null };
    console.info("[AUDIT] POST /v1/runs success", { user: auth?.email, ip, timestamp, project, title });
    return apiOk(request, out, "OK", { extra: out });
  } catch (err) {
    console.error("[AUDIT] POST /v1/runs exception", { ip, timestamp, error: (err as Error)?.message });
    return apiFail(request, "Erro interno do servidor", {
      status: 500,
      code: "INTERNAL_ERROR",
      extra: { error: { message: "Erro interno do servidor" } },
    });
  }
}
