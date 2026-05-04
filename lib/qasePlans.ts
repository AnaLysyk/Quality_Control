import "server-only";

import { QaseClient, QaseError, createQaseClient } from "@/lib/qaseSdk";
import { buildQaseCaseLink, type TestPlanCase, type TestPlanCaseStep } from "@/lib/testPlanCases";

type RawPlan = {
  id?: number | string;
  title?: string;
  name?: string;
  description?: string | null;
  cases?: unknown[];
  cases_count?: number | string | null;
  casesCount?: number | string | null;
  created?: string | null;
  created_at?: string | null;
  updated?: string | null;
  updated_at?: string | null;
};

type AccessibleProject = {
  code: string;
  title?: string | null;
};

export type QasePlanCaseRef = TestPlanCase;

export type QasePlanRecord = {
  id: string;
  title: string;
  description?: string | null;
  casesCount: number;
  cases: QasePlanCaseRef[];
  createdAt?: string | null;
  updatedAt?: string | null;
  projectCode: string;
};

const ACCESSIBLE_PROJECTS_TTL_MS = 5 * 60 * 1000;

type GlobalState = {
  __qcQasePlansProjectsCache?: Map<string, { expiresAt: number; items: AccessibleProject[] }>;
};

function getProjectsCache() {
  const state = globalThis as GlobalState;
  if (!state.__qcQasePlansProjectsCache) {
    state.__qcQasePlansProjectsCache = new Map();
  }
  return state.__qcQasePlansProjectsCache;
}

function normalizeString(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
}

function normalizeProjectCode(value: unknown) {
  const normalized = normalizeString(value);
  return normalized ? normalized.toUpperCase() : null;
}

function toNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeCaseRef(raw: unknown): QasePlanCaseRef | null {
  if (typeof raw === "number" || typeof raw === "string") {
    const id = String(raw).trim();
    return id ? { id } : null;
  }

  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const id = String(record.case_id ?? record.caseId ?? record.id ?? "").trim();
  if (!id) return null;
  const title =
    normalizeString(record.title) ??
    normalizeString(record.name) ??
    normalizeString(record.case_title) ??
    null;
  return { id, title };
}

function normalizeCaseStep(raw: unknown, fallbackIndex = 0): TestPlanCaseStep | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const action =
    normalizeString(record.action) ??
    normalizeString(record.text) ??
    normalizeString(record.step) ??
    null;
  const expectedResult =
    normalizeString(record.expected_result) ??
    normalizeString(record.expectedResult) ??
    normalizeString(record.expected) ??
    null;
  const data = normalizeString(record.data);
  if (!action && !expectedResult && !data) return null;
  return {
    id: normalizeString(record.id) ?? `step_${fallbackIndex + 1}`,
    action,
    expectedResult,
    data,
  };
}

function normalizeSeverity(raw: unknown) {
  if (typeof raw === "string") return normalizeString(raw);
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  return (
    normalizeString(record.title) ??
    normalizeString(record.name) ??
    normalizeString(record.value) ??
    null
  );
}

function normalizePlan(raw: RawPlan, projectCode: string): QasePlanRecord | null {
  const id = String(raw.id ?? "").trim();
  if (!id) return null;
  const title = String(raw.title ?? raw.name ?? `Plano ${id}`).trim() || `Plano ${id}`;
  const cases = Array.isArray(raw.cases)
    ? raw.cases
        .map((item) => normalizeCaseRef(item))
        .filter((item): item is QasePlanCaseRef => item !== null)
    : [];

  return {
    id,
    title,
    description: typeof raw.description === "string" ? raw.description : null,
    casesCount: cases.length || toNumber(raw.cases_count ?? raw.casesCount),
    cases,
    createdAt:
      typeof raw.created_at === "string"
        ? raw.created_at
        : typeof raw.created === "string"
          ? raw.created
          : null,
    updatedAt:
      typeof raw.updated_at === "string"
        ? raw.updated_at
        : typeof raw.updated === "string"
          ? raw.updated
          : null,
    projectCode,
  };
}

function normalizeQaseCase(raw: unknown, projectCode: string): TestPlanCase | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const id = String(record.id ?? record.case_id ?? record.caseId ?? "").trim();
  if (!id) return null;
  const steps = Array.isArray(record.steps)
    ? record.steps
        .map((item, index) => normalizeCaseStep(item, index))
        .filter((item): item is TestPlanCaseStep => item !== null)
    : [];

  return {
    id,
    title: normalizeString(record.title) ?? normalizeString(record.name) ?? `Caso ${id}`,
    description: normalizeString(record.description),
    preconditions:
      normalizeString(record.preconditions) ?? normalizeString(record.precondition),
    postconditions:
      normalizeString(record.postconditions) ?? normalizeString(record.postcondition),
    severity:
      normalizeSeverity(record.severity) ??
      normalizeString(record.severity_name) ??
      normalizeString(record.priority),
    steps: steps.length ? steps : undefined,
    link: buildQaseCaseLink(projectCode, id),
  };
}

async function listAccessibleProjects(client: QaseClient, token: string, baseUrl: string) {
  const cacheKey = `${baseUrl}:${token}`;
  const cache = getProjectsCache();
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.items;
  }

  const all = new Map<string, AccessibleProject>();
  const limit = 100;
  let offset = 0;

  while (true) {
    const { data } = await client.getWithStatus<{ result?: { entities?: unknown[] } }>("/project", {
      params: { limit, offset },
      cache: "no-store",
    });
    const entities = Array.isArray(data?.result?.entities) ? data.result.entities : [];
    if (!entities.length) break;

    for (const entity of entities) {
      if (!entity || typeof entity !== "object") continue;
      const record = entity as Record<string, unknown>;
      const code = normalizeString(record.code);
      if (!code) continue;
      all.set(code, {
        code,
        title: normalizeString(record.title),
      });
    }

    if (entities.length < limit) break;
    offset += limit;
  }

  const items = Array.from(all.values());
  cache.set(cacheKey, {
    expiresAt: Date.now() + ACCESSIBLE_PROJECTS_TTL_MS,
    items,
  });
  return items;
}

export async function resolveQaseProjectCodeExact(
  client: QaseClient,
  token: string,
  baseUrl: string,
  projectCode: string,
) {
  const normalizedProject = normalizeProjectCode(projectCode);
  if (!normalizedProject) return null;

  const accessibleProjects = await listAccessibleProjects(client, token, baseUrl);
  const exact = accessibleProjects.find(
    (project) => normalizeProjectCode(project.code) === normalizedProject,
  );
  return exact?.code ?? projectCode;
}

export async function listQasePlans(input: {
  token: string;
  baseUrl?: string;
  projectCode: string;
}) {
  const client = createQaseClient({
    token: input.token,
    baseUrl: input.baseUrl,
    defaultFetchOptions: { cache: "no-store" },
  });
  const resolvedProjectCode = await resolveQaseProjectCodeExact(
    client,
    input.token,
    (input.baseUrl || process.env.QASE_BASE_URL || "https://api.qase.io").replace(/\/(v1|v2)\/?$/, ""),
    input.projectCode,
  );
  if (!resolvedProjectCode) return [];

  const all: QasePlanRecord[] = [];
  const limit = 100;
  let offset = 0;

  while (true) {
    const response = await client.listPlans(resolvedProjectCode, { limit, offset });
    const entities = Array.isArray(response?.result?.entities) ? response.result.entities : [];
    if (!entities.length) break;

    all.push(
      ...entities
        .map((item) => normalizePlan((item ?? {}) as RawPlan, resolvedProjectCode))
        .filter((item): item is QasePlanRecord => item !== null),
    );

    if (entities.length < limit) break;
    offset += limit;
  }

  return all;
}

export async function getQasePlan(input: {
  token: string;
  baseUrl?: string;
  projectCode: string;
  planId: string | number;
}) {
  const client = createQaseClient({
    token: input.token,
    baseUrl: input.baseUrl,
    defaultFetchOptions: { cache: "no-store" },
  });
  const baseUrl = (input.baseUrl || process.env.QASE_BASE_URL || "https://api.qase.io").replace(
    /\/(v1|v2)\/?$/,
    "",
  );
  const resolvedProjectCode = await resolveQaseProjectCodeExact(
    client,
    input.token,
    baseUrl,
    input.projectCode,
  );
  if (!resolvedProjectCode) return null;

  const { data } = await client.getWithStatus<{ result?: unknown }>(
    `/plan/${resolvedProjectCode}/${encodeURIComponent(String(input.planId))}`,
    { cache: "no-store" },
  );
  const result =
    data?.result && typeof data.result === "object" ? (data.result as Record<string, unknown>) : null;
  return normalizePlan((result ?? {}) as RawPlan, resolvedProjectCode);
}

export async function getQaseCase(input: {
  token: string;
  baseUrl?: string;
  projectCode: string;
  caseId: string | number;
}) {
  const client = createQaseClient({
    token: input.token,
    baseUrl: input.baseUrl,
    defaultFetchOptions: { cache: "no-store" },
  });
  const baseUrl = (input.baseUrl || process.env.QASE_BASE_URL || "https://api.qase.io").replace(
    /\/(v1|v2)\/?$/,
    "",
  );
  const resolvedProjectCode = await resolveQaseProjectCodeExact(
    client,
    input.token,
    baseUrl,
    input.projectCode,
  );
  if (!resolvedProjectCode) return null;

  const { data } = await client.getWithStatus<{ result?: unknown }>(
    `/case/${resolvedProjectCode}/${encodeURIComponent(String(input.caseId))}`,
    { cache: "no-store" },
  );
  const result =
    data?.result && typeof data.result === "object" ? (data.result as Record<string, unknown>) : null;
  return normalizeQaseCase(result, resolvedProjectCode);
}

export async function createQasePlan(input: {
  token: string;
  baseUrl?: string;
  projectCode: string;
  title: string;
  description?: string | null;
  cases: number[];
}) {
  const client = createQaseClient({
    token: input.token,
    baseUrl: input.baseUrl,
    defaultFetchOptions: { cache: "no-store" },
  });
  const baseUrl = (input.baseUrl || process.env.QASE_BASE_URL || "https://api.qase.io").replace(
    /\/(v1|v2)\/?$/,
    "",
  );
  const resolvedProjectCode = await resolveQaseProjectCodeExact(
    client,
    input.token,
    baseUrl,
    input.projectCode,
  );
  if (!resolvedProjectCode) throw new QaseError("Qase project not found", 404);

  const { data } = await client.postWithStatus<{ result?: { id?: number | string } }>(
    `/plan/${resolvedProjectCode}`,
    {
      title: input.title,
      description: input.description ?? null,
      cases: input.cases,
    },
  );
  const planId = String(data?.result?.id ?? "").trim();
  if (!planId) {
    throw new QaseError("Qase plan id missing", 500);
  }
  return getQasePlan({
    token: input.token,
    baseUrl: input.baseUrl,
    projectCode: resolvedProjectCode,
    planId,
  });
}

export async function updateQasePlan(input: {
  token: string;
  baseUrl?: string;
  projectCode: string;
  planId: string | number;
  title?: string;
  description?: string | null;
  cases?: number[];
}) {
  const client = createQaseClient({
    token: input.token,
    baseUrl: input.baseUrl,
    defaultFetchOptions: { cache: "no-store" },
  });
  const baseUrl = (input.baseUrl || process.env.QASE_BASE_URL || "https://api.qase.io").replace(
    /\/(v1|v2)\/?$/,
    "",
  );
  const resolvedProjectCode = await resolveQaseProjectCodeExact(
    client,
    input.token,
    baseUrl,
    input.projectCode,
  );
  if (!resolvedProjectCode) throw new QaseError("Qase project not found", 404);

  await client.patchWithStatus(
    `/plan/${resolvedProjectCode}/${encodeURIComponent(String(input.planId))}`,
    {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description ?? null } : {}),
      ...(input.cases !== undefined ? { cases: input.cases } : {}),
    },
  );

  return getQasePlan({
    token: input.token,
    baseUrl: input.baseUrl,
    projectCode: resolvedProjectCode,
    planId: input.planId,
  });
}

export async function deleteQasePlan(input: {
  token: string;
  baseUrl?: string;
  projectCode: string;
  planId: string | number;
}) {
  const client = createQaseClient({
    token: input.token,
    baseUrl: input.baseUrl,
    defaultFetchOptions: { cache: "no-store" },
  });
  const baseUrl = (input.baseUrl || process.env.QASE_BASE_URL || "https://api.qase.io").replace(
    /\/(v1|v2)\/?$/,
    "",
  );
  const resolvedProjectCode = await resolveQaseProjectCodeExact(
    client,
    input.token,
    baseUrl,
    input.projectCode,
  );
  if (!resolvedProjectCode) throw new QaseError("Qase project not found", 404);
  await client.deleteWithStatus(
    `/plan/${resolvedProjectCode}/${encodeURIComponent(String(input.planId))}`,
  );
}
