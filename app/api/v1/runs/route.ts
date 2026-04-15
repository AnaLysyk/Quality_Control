import { authenticateRequest } from "@/lib/jwtAuth";
import { apiFail, apiOk } from "@/lib/apiResponse";
import { canCreateRun, getRunMockRole, resolveRunRole } from "@/lib/rbac/runs";
import { isCompanyUser } from "@/lib/rbac/companyAccess";
import { getClientQaseSettings } from "@/lib/qaseConfig";
import { listApplications } from "@/lib/applicationsStore";

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

type QaseRunResponsible = {
  id: number;
  name: string | null;
  email: string | null;
};

function normalizeNumericId(value: unknown): number | null {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value.trim())
        : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function extractRunResponsibleIds(entities: unknown[]) {
  return Array.from(
    new Set(
      entities
        .map((entity) => {
          const record = asRecord(entity);
          return normalizeNumericId(record?.user_id ?? record?.userId);
        })
        .filter((value): value is number => value !== null),
    ),
  );
}

function parseQaseRunResponsible(value: unknown, fallbackId: number): QaseRunResponsible | null {
  const record = asRecord(value);
  if (!record) return null;

  return {
    id: normalizeNumericId(record.id) ?? fallbackId,
    name: normalizeString(record.name),
    email: normalizeString(record.email),
  };
}

async function fetchQaseRunResponsibles(baseUrl: string, token: string, userIds: number[]) {
  const uniqueIds = Array.from(new Set(userIds.filter((value) => Number.isFinite(value) && value > 0)));
  if (!uniqueIds.length) return new Map<number, QaseRunResponsible>();

  const entries = await Promise.all(
    uniqueIds.map(async (userId) => {
      try {
        const response = await fetch(`${baseUrl}/v1/user/${encodeURIComponent(String(userId))}`, {
          headers: { Token: token, Accept: "application/json" },
          cache: "no-store",
        });
        if (!response.ok) return null;

        const payload = (await response.json().catch(() => null)) as unknown;
        const responsible = parseQaseRunResponsible(asRecord(payload)?.result, userId);
        return responsible ? ([userId, responsible] as const) : null;
      } catch {
        return null;
      }
    }),
  );

  return new Map<number, QaseRunResponsible>(
    entries.filter((entry): entry is readonly [number, QaseRunResponsible] => entry !== null),
  );
}

function normalizeRunEntity(
  entity: unknown,
  projectCode: string,
  companySlug: string | null,
  responsiblesById: Map<number, QaseRunResponsible> = new Map(),
) {
  const record = asRecord(entity) ?? {};
  const rawId = record.id;
  const parsedId = typeof rawId === "number" ? rawId : Number(String(rawId ?? "").trim());
  const runId = Number.isFinite(parsedId) && parsedId > 0 ? parsedId : null;
  const rawSlug = normalizeString(record.slug);
  const responsibleUserId = normalizeNumericId(record.user_id ?? record.userId);
  const responsible = responsibleUserId ? responsiblesById.get(responsibleUserId) ?? null : null;
  const responsibleName =
    responsible?.name ??
    normalizeString(record.responsibleName) ??
    normalizeString(record.createdByName);
  const responsibleEmail =
    responsible?.email ??
    normalizeString(record.responsibleEmail) ??
    normalizeString(record.createdByEmail);
  const responsibleLabel = responsibleName || responsibleEmail || null;
  const title =
    normalizeString(record.title) ||
    normalizeString(record.name) ||
    (runId ? `Run ${runId}` : rawSlug) ||
    `Run ${projectCode}`;
  const createdAt = normalizeString(record.created_at) || normalizeString(record.createdAt) || normalizeString(record.start_time);
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
    responsibleUserId,
    responsibleName,
    responsibleEmail,
    responsibleLabel,
    createdByName: responsibleName,
    createdByEmail: responsibleEmail,
  };
}

async function fetchAllProjectRuns(
  baseUrl: string,
  token: string,
  project: string,
  pageSize: number,
  timeRange?: { fromStartTime?: number; toStartTime?: number },
) {
  const normalizedPageSize = Math.max(10, Math.min(100, Number.isFinite(pageSize) ? pageSize : 100));
  const maxPages = 50;
  const entities: unknown[] = [];

  for (let page = 0; page < maxPages; page += 1) {
    const offset = page * normalizedPageSize;
    let url = `${baseUrl}/v1/run/${encodeURIComponent(project)}?limit=${encodeURIComponent(String(normalizedPageSize))}&offset=${encodeURIComponent(String(offset))}`;
    if (timeRange?.fromStartTime) url += `&from_start_time=${encodeURIComponent(String(timeRange.fromStartTime))}`;
    if (timeRange?.toStartTime) url += `&to_start_time=${encodeURIComponent(String(timeRange.toStartTime))}`;
    const response = await fetch(url, {
      headers: { Token: token, Accept: "application/json" },
      cache: "no-store",
    });
    const payload = (await response.json().catch(() => null)) as unknown;

    if (!response.ok) {
      return {
        ok: false as const,
        status: response.status,
        details: payload,
        entities,
      };
    }

    const pageEntities = (asRecord(asRecord(payload)?.result)?.entities as unknown[]) || [];
    entities.push(...pageEntities);

    if (pageEntities.length < normalizedPageSize) {
      break;
    }
  }

  return {
    ok: true as const,
    status: 200,
    details: null,
    entities,
  };
}

async function fetchAllQaseProjectCodes(baseUrl: string, token: string) {
  const pageSize = 100;
  const maxPages = 20;
  const projectCodes: string[] = [];

  for (let page = 0; page < maxPages; page += 1) {
    const offset = page * pageSize;
    const url = `${baseUrl}/v1/project?limit=${encodeURIComponent(String(pageSize))}&offset=${encodeURIComponent(String(offset))}`;
    const response = await fetch(url, {
      headers: { Token: token, Accept: "application/json" },
      cache: "no-store",
    });

    if (!response.ok) break;

    const payload = (await response.json().catch(() => null)) as unknown;
    const entities = (asRecord(asRecord(payload)?.result)?.entities as unknown[]) || [];
    projectCodes.push(
      ...entities
        .map((project) => normalizeProjectCode(asRecord(project)?.code))
        .filter((code): code is string => Boolean(code)),
    );

    if (entities.length < pageSize) {
      break;
    }
  }

  return normalizeProjectList(projectCodes);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requestedCompanySlug = normalizeString(url.searchParams.get("companySlug")) || null;

  const auth = await authenticateRequest(request);
  const mockRole = await getRunMockRole();
  if (!auth && !mockRole) {
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
  const fromStartTimeParam = Number(url.searchParams.get("from_start_time") ?? 0) || 0;
  const toStartTimeParam = Number(url.searchParams.get("to_start_time") ?? 0) || 0;
  const timeRange = (fromStartTimeParam || toStartTimeParam)
    ? { fromStartTime: fromStartTimeParam || undefined, toStartTime: toStartTimeParam || undefined }
    : undefined;
  const diag = String(url.searchParams.get("diag") ?? "").toLowerCase() === "true";
  const companySlug =
    auth?.isGlobalAdmin && requestedCompanySlug
      ? requestedCompanySlug
      : auth?.companySlug ?? null;
  const qaseSettings = companySlug ? await getClientQaseSettings(companySlug) : null;
  const tokenToUse = (qaseSettings && qaseSettings.token) ? qaseSettings.token : QASE_TOKEN;
  const baseUrl = (qaseSettings?.baseUrl || QASE_BASE_URL).replace(/\/+$/, "");

  // Load project codes from linked applications to ensure ALL linked projects are fetched
  let linkedAppProjectCodes: string[] = [];
  if (companySlug) {
    try {
      const linkedApps = await listApplications({ companySlug });
      linkedAppProjectCodes = linkedApps
        .map((app) => normalizeProjectCode(app.qaseProjectCode))
        .filter((code): code is string => Boolean(code));
    } catch {
      // Best-effort: proceed without app project codes
    }
  }

  const configuredProjects = normalizeProjectList([
    ...(Array.isArray(qaseSettings?.projectCodes) ? qaseSettings.projectCodes : []),
    qaseSettings?.projectCode,
    DEFAULT_PROJECT,
    ...linkedAppProjectCodes,
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
  if (all) {
    // Only discover Qase projects when no projects are already configured — avoids
    // fetching the entire project list on every page load when settings are present.
    let discoveredProjects: string[] = [];
    if (configuredProjects.length === 0) {
      try {
        discoveredProjects = await fetchAllQaseProjectCodes(baseUrl, tokenToUse);
      } catch {
        // Ignore — keep configured projects only
      }
    }

    const projects = normalizeProjectList([...configuredProjects, ...discoveredProjects]);

    if (projects.length === 0) {
      const out = { data: [], warning: "Nenhum projeto Qase configurado" };
      return apiOk(request, out, "OK", { extra: out });
    }

    const fetches = projects.map(async (proj) => {
      try {
        const result = await fetchAllProjectRuns(baseUrl, tokenToUse, proj, limitParam, timeRange);
        return { project: proj, ok: result.ok, status: result.status, details: result.details, entities: result.entities };
      } catch (e) {
        return { project: proj, ok: false, status: 500, details: e, entities: [] as unknown[] };
      }
    });

    const results = await Promise.all(fetches);
    const responsiblesById = await fetchQaseRunResponsibles(
      baseUrl,
      tokenToUse,
      results.flatMap((result) => extractRunResponsibleIds(result.entities)),
    );
    const combined: unknown[] = [];
    const seen = new Set<string>();
    for (const r of results) {
      for (const e of r.entities.map((entity) => normalizeRunEntity(entity, r.project, companySlug, responsiblesById))) {
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
  let singleUrl = `${baseUrl}/v1/run/${encodeURIComponent(effectiveProject)}?limit=${encodeURIComponent(String(limitParam))}`;
  if (timeRange?.fromStartTime) singleUrl += `&from_start_time=${encodeURIComponent(String(timeRange.fromStartTime))}`;
  if (timeRange?.toStartTime) singleUrl += `&to_start_time=${encodeURIComponent(String(timeRange.toStartTime))}`;
  const res = await fetch(singleUrl, {
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
  const responsiblesById = await fetchQaseRunResponsibles(
    baseUrl,
    tokenToUse,
    extractRunResponsibleIds(entities),
  );
  const out = { data: entities.map((entity) => normalizeRunEntity(entity, effectiveProject, companySlug, responsiblesById)) };
  return apiOk(request, out, "OK", { extra: out });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as unknown;

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
  const planId = normalizeNumericId(rec.plan_id ?? rec.planId);

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
  if (planId) {
    payload.plan_id = planId;
  }
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
