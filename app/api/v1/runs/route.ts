import { authenticateRequest } from "@/lib/jwtAuth";
import { apiFail, apiOk } from "@/lib/apiResponse";
import { canCreateRun, getRunMockRole, resolveRunRole } from "@/lib/rbac/runs";

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
  const auth = await authenticateRequest(request);
  const mockRole = await getRunMockRole();
  if (!auth && !mockRole) {
    return apiFail(request, "Nao autorizado", {
      status: 401,
      code: "AUTH_REQUIRED",
      extra: { error: { message: "Nao autorizado" } },
    });
  }

  const url = new URL(request.url);
  const project = normalizeString(url.searchParams.get("project")) || DEFAULT_PROJECT;
  if (!project) {
    return apiFail(request, "Missing project", {
      status: 400,
      code: "VALIDATION_ERROR",
      extra: { error: { message: "Missing project" } },
    });
  }

  if (!QASE_TOKEN) {
    const out = { data: [], warning: "QASE_API_TOKEN ausente" };
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
    return apiFail(request, msg, {
      status: res.status,
      code: "UPSTREAM_ERROR",
      details: json,
      extra: { error: { message: msg } },
    });
  }

  const entities = (asRecord(asRecord(json)?.result)?.entities as unknown[]) || [];
  const out = { data: entities };
  return apiOk(request, out, "OK", { extra: out });
}

export async function POST(request: Request) {
  const auth = await authenticateRequest(request);
  const mockRole = await getRunMockRole();
  const effectiveAuth = auth ?? (mockRole ? { id: `mock-${mockRole}`, email: `${mockRole}@example.com`, isGlobalAdmin: mockRole === "admin" } : null);

  if (!effectiveAuth) {
    return apiFail(request, "Nao autorizado", {
      status: 401,
      code: "AUTH_REQUIRED",
      extra: { error: { message: "Nao autorizado" } },
    });
  }
  const role = mockRole ?? (await resolveRunRole(effectiveAuth));
  if (!canCreateRun(role)) {
    return apiFail(request, "Acesso proibido", {
      status: 403,
      code: "FORBIDDEN",
      extra: { error: { message: "Acesso proibido" } },
    });
  }

  const body = (await request.json().catch(() => null)) as unknown;
  const rec = asRecord(body) ?? {};
  const project = normalizeString(rec.project) || DEFAULT_PROJECT;
  const title = normalizeString(rec.title);
  const description = normalizeString(rec.description) || "";
  const customType = normalizeString(rec.custom_type);

  if (!project || !title) {
    return apiFail(request, "Missing project or title", {
      status: 400,
      code: "VALIDATION_ERROR",
      extra: { error: { message: "Missing project or title" } },
    });
  }

  if (!QASE_TOKEN) {
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
    return apiFail(request, msg, {
      status: res.status,
      code: "UPSTREAM_ERROR",
      details: json,
      extra: { error: { message: msg } },
    });
  }

  const out = { data: asRecord(json)?.result ?? null };
  return apiOk(request, out, "OK", { extra: out });
}
