import { authenticateRequest } from "@/lib/jwtAuth";
import { apiFail, apiOk } from "@/lib/apiResponse";
import { canCreateRun, getRunMockRole, resolveRunRole } from "@/lib/rbac/runs";
import { isCompanyUser } from "@/lib/rbac/companyAccess";
import { getClientQaseSettings } from "@/lib/qaseConfig";

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

function normalizeProjectCode(value: unknown): string | null {
  const normalized = normalizeString(value);
  return normalized ? normalized.toUpperCase() : null;
}

function normalizeProjectList(values: unknown[]): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => normalizeProjectCode(value))
        .filter((value): value is string => Boolean(value)),
    ),
  );
}

function normalizeRunEntity(entity: unknown, projectCode: string, companySlug: string | null) {
  const record = asRecord(entity) ?? {};
  const rawId = record.id;
  const parsedId = typeof rawId === "number" ? rawId : Number(String(rawId ?? "").trim());
  const runId = Number.isFinite(parsedId) && parsedId > 0 ? parsedId : null;
  const rawSlug = normalizeString(record.slug);
  const title =
    normalizeString(record.title) ||
    normalizeString(record.name) ||
    (runId ? `Run ${runId}` : rawSlug) ||
    `Run ${projectCode}`;
  const createdAt = normalizeString(record.created_at) || normalizeString(record.createdAt);
  const slug = runId ? `qase-${projectCode.toLowerCase()}-${runId}` : rawSlug || `${projectCode.toLowerCase()}-${title.toLowerCase()}`;

  return {
    ...record,
    id: runId ?? rawSlug ?? title,
    runId,
    slug,
    title,
    name: title,
    createdAt,
    created_at: createdAt,
    source: "QASE",
    app: projectCode,
    project: projectCode,
    qaseProject: projectCode,
    clientId: companySlug,
    clientName: companySlug,
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requestedCompanySlug = normalizeString(url.searchParams.get("companySlug")) || null;

  const auth = await authenticateRequest(request);
  const mockRole = await getRunMockRole();
  if (!auth && !mockRole) {
    return apiFail(request, "Nao autorizado", {
      status: 401,
      code: "AUTH_REQUIRED",
      extra: { error: { message: "Nao autorizado" } },
    });
  }
  if (auth && !auth.isGlobalAdmin && !isCompanyUser(auth)) {
    return apiFail(request, "Acesso proibido", {
      status: 403,
      code: "FORBIDDEN",
      extra: { error: { message: "Acesso proibido" } },
    });
  }
  if (!auth && mockRole && mockRole !== "company") {
    return apiFail(request, "Acesso proibido", {
      status: 403,
      code: "FORBIDDEN",
      extra: { error: { message: "Acesso proibido" } },
    });
  }

  const project = normalizeString(url.searchParams.get("project")) || null;
  const allParam = String(url.searchParams.get("all") ?? "").toLowerCase();
  const all = allParam === "1" || allParam === "true";
  const limitParam = Number(url.searchParams.get("limit") ?? 50) || 50;
  const diag = String(url.searchParams.get("diag") ?? "").toLowerCase() === "true";
  const companySlug =
    auth?.isGlobalAdmin && requestedCompanySlug
      ? requestedCompanySlug
      : auth?.companySlug ?? null;
  const qaseSettings = companySlug ? await getClientQaseSettings(companySlug) : null;
  const tokenToUse = (qaseSettings && qaseSettings.token) ? qaseSettings.token : QASE_TOKEN;
  const baseUrl = (qaseSettings?.baseUrl || QASE_BASE_URL).replace(/\/+$/, "");
  const configuredProjects = normalizeProjectList([
    ...(Array.isArray(qaseSettings?.projectCodes) ? qaseSettings.projectCodes : []),
    qaseSettings?.projectCode,
    DEFAULT_PROJECT,
  ]);
  const effectiveProject = normalizeProjectCode(project) || configuredProjects[0] || null;

  if (!effectiveProject && !all) {
    return apiFail(request, "Missing project", {
      status: 400,
      code: "VALIDATION_ERROR",
      extra: { error: { message: "Missing project" } },
    });
  }

  if (!tokenToUse) {
    const out = { data: [], warning: "QASE_API_TOKEN ausente" };
    return apiOk(request, out, "OK", { extra: out });
  }

  // If requested, aggregate runs across all configured projects for this company
  if (all && configuredProjects.length > 0) {
    const projects = configuredProjects;
    const fetches = projects.map(async (proj) => {
      try {
        const r = await fetch(`${baseUrl}/v1/run/${encodeURIComponent(proj)}?limit=${encodeURIComponent(String(limitParam))}`, {
          headers: { Token: tokenToUse, Accept: "application/json" },
          cache: "no-store",
        });
        const j = (await r.json().catch(() => null)) as unknown;
        if (!r.ok) {
          return { project: proj, ok: false, status: r.status, details: j, entities: [] as unknown[] };
        }
        const ents = (asRecord(asRecord(j)?.result)?.entities as unknown[]) || [];
        const normalized = ents.map((entity) => normalizeRunEntity(entity, proj, companySlug));
        return { project: proj, ok: true, status: 200, details: j, entities: normalized };
      } catch (e) {
        return { project: proj, ok: false, status: 500, details: e, entities: [] as unknown[] };
      }
    });

    const results = await Promise.all(fetches);
    const combined: unknown[] = [];
    const seen = new Set<string>();
    for (const r of results) {
      for (const e of (r.entities as unknown[])) {
        const entityRecord = asRecord(e);
        const id = String(
          entityRecord?.runId ??
            entityRecord?.id ??
            entityRecord?.slug ??
            entityRecord?.uid ??
            JSON.stringify(e),
        );
        if (!id) continue;
        const dedupeKey = `${r.project}:${id}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);
        combined.push(e);
      }
    }

    const out: Record<string, unknown> = { data: combined };
    if (diag) {
      out.projects = results.map((r) => ({ project: r.project, ok: r.ok, status: r.status, count: (r.entities || []).length }));
    }
    return apiOk(request, out, "OK", { extra: out });
  }

  if (!effectiveProject) {
    const out = { data: [], warning: "Nenhum projeto Qase configurado" };
    return apiOk(request, out, "OK", { extra: out });
  }

  // Default: single-project fetch
  const res = await fetch(`${baseUrl}/v1/run/${encodeURIComponent(effectiveProject)}?limit=${encodeURIComponent(String(limitParam))}`, {
    headers: { Token: tokenToUse, Accept: "application/json" },
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
  const out = { data: entities.map((entity) => normalizeRunEntity(entity, effectiveProject, companySlug)) };
  return apiOk(request, out, "OK", { extra: out });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as unknown;

  const auth = await authenticateRequest(request);
  const mockRole = await getRunMockRole();
  const effectiveAuth =
    auth ?? (mockRole ? { id: `mock-${mockRole}`, email: `${mockRole}@example.com`, isGlobalAdmin: mockRole === "admin" } : null);

  if (!effectiveAuth) {
    return apiFail(request, "Nao autorizado", {
      status: 401,
      code: "AUTH_REQUIRED",
      extra: { error: { message: "Nao autorizado" } },
    });
  }
  if (auth && !auth.isGlobalAdmin && !isCompanyUser(auth)) {
    return apiFail(request, "Acesso proibido", {
      status: 403,
      code: "FORBIDDEN",
      extra: { error: { message: "Acesso proibido" } },
    });
  }
  if (!auth && mockRole && mockRole !== "company") {
    return apiFail(request, "Acesso proibido", {
      status: 403,
      code: "FORBIDDEN",
      extra: { error: { message: "Acesso proibido" } },
    });
  }
  const role = auth ? await resolveRunRole(effectiveAuth) : mockRole ?? "user";
  if (!canCreateRun(role)) {
    return apiFail(request, "Acesso proibido", {
      status: 403,
      code: "FORBIDDEN",
      extra: { error: { message: "Acesso proibido" } },
    });
  }

  const rec = asRecord(body) ?? {};
  const project = normalizeString(rec.project) || null;
  const title = normalizeString(rec.title);
  const description = normalizeString(rec.description) || "";
  const customType = normalizeString(rec.custom_type);

  if (!project && !DEFAULT_PROJECT) {
    return apiFail(request, "Missing project or title", {
      status: 400,
      code: "VALIDATION_ERROR",
      extra: { error: { message: "Missing project or title" } },
    });
  }

  const companySlug = auth?.companySlug ?? null;
  const qaseSettings = companySlug ? await getClientQaseSettings(companySlug) : null;
  const tokenToUse = (qaseSettings && qaseSettings.token) ? qaseSettings.token : QASE_TOKEN;
  const baseUrl = (qaseSettings?.baseUrl || QASE_BASE_URL).replace(/\/+$/, "");
  const effectiveProject =
    normalizeProjectCode(project) ||
    normalizeProjectCode(qaseSettings?.projectCode) ||
    normalizeProjectCode(DEFAULT_PROJECT);

  if (!effectiveProject || !title) {
    return apiFail(request, "Missing project or title", {
      status: 400,
      code: "VALIDATION_ERROR",
      extra: { error: { message: "Missing project or title" } },
    });
  }

  if (!tokenToUse) {
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

  const res = await fetch(`${baseUrl}/v1/run/${encodeURIComponent(effectiveProject)}`, {
    method: "POST",
    headers: { Token: tokenToUse, Accept: "application/json", "Content-Type": "application/json" },
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
