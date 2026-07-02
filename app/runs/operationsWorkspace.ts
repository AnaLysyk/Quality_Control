export type OperationModuleKey =
  | "dashboard"
  | "runs"
  | "applications"
  | "test-plans"
  | "defects"
  | "support"
  | "metrics";

export type RunStats = {
  pass: number;
  fail: number;
  blocked: number;
  notRun: number;
  total: number;
};

export type QaseStatuses = Record<string, number | null | undefined>;

export type RunStatsInput = Partial<RunStats> & {
  not_run?: number | null;
  passed?: number | null;
  failed?: number | null;
  untested?: number | null;
  skipped?: number | null;
  retest?: number | null;
  in_progress?: number | null;
  invalid?: number | null;
  statuses?: QaseStatuses | null;
};

export type RunStatusKey =
  | "completed"
  | "in_progress"
  | "blocked"
  | "at_risk"
  | "pending"
  | "unknown";

export type ApplicationMatchKeys = {
  fuzzy: Set<string>;
  projectCodes: Set<string>;
};

export function normalizeText(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export function normalizeKey(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalizeProjectCode(value: unknown) {
  const normalized = normalizeText(value);
  return normalized ? normalized.toUpperCase() : null;
}

export function normalizeOperationModuleKey(value: unknown): OperationModuleKey {
  const normalized = normalizeKey(value);
  if (normalized === "applications" || normalized === "aplicacoes" || normalized === "aplicacoes") {
    return "applications";
  }
  if (normalized === "runs") return "runs";
  if (normalized === "test-plans" || normalized === "planos-de-teste" || normalized === "planos-teste") {
    return "test-plans";
  }
  if (normalized === "defects" || normalized === "defeitos") return "defects";
  if (normalized === "support" || normalized === "chamados" || normalized === "suporte") return "support";
  if (normalized === "metrics" || normalized === "metricas" || normalized === "metricas") return "metrics";
  return "dashboard";
}

export function buildApplicationMatchKeys(input: {
  slug?: string | null;
  name?: string | null;
  projectCode?: string | null;
  companySlug?: string | null;
}): ApplicationMatchKeys {
  const fuzzy = new Set<string>();
  const projectCodes = new Set<string>();

  for (const value of [input.slug, input.name, input.companySlug]) {
    const normalized = normalizeKey(value);
    if (normalized) fuzzy.add(normalized);
  }

  const projectCode = normalizeProjectCode(input.projectCode);
  if (projectCode) {
    projectCodes.add(projectCode);
    fuzzy.add(normalizeKey(projectCode));
  }

  return { fuzzy, projectCodes };
}

export function matchesApplicationKeys(keys: ApplicationMatchKeys | null, values: unknown[]) {
  if (!keys) return true;

  for (const value of values) {
    const projectCode = normalizeProjectCode(value);
    if (projectCode && keys.projectCodes.has(projectCode)) {
      return true;
    }

    const fuzzyKey = normalizeKey(value);
    if (fuzzyKey && keys.fuzzy.has(fuzzyKey)) {
      return true;
    }
  }

  return false;
}

export function computeRunStats(input: RunStatsInput | null | undefined): RunStats {
  const statuses = input?.statuses ?? {};
  const pass = Math.max(0, Number(input?.pass ?? input?.passed ?? statuses.passed ?? 0));
  const fail = Math.max(0, Number(input?.fail ?? input?.failed ?? statuses.failed ?? 0));
  const blocked = Math.max(0, Number(input?.blocked ?? statuses.blocked ?? 0));
  const skipped = Math.max(0, Number(input?.skipped ?? statuses.skipped ?? 0));
  const retest = Math.max(0, Number(input?.retest ?? statuses.retest ?? 0));
  const inProgress = Math.max(0, Number(input?.in_progress ?? statuses.in_progress ?? 0));
  const invalid = Math.max(0, Number(input?.invalid ?? statuses.invalid ?? 0));
  const notRun = Math.max(0, Number(input?.notRun ?? input?.not_run ?? input?.untested ?? statuses.untested ?? 0));

  return {
    pass,
    fail,
    blocked,
    notRun: notRun + skipped + retest + inProgress + invalid,
    total: pass + fail + blocked + notRun + skipped + retest + inProgress + invalid,
  };
}

export function computePassRate(stats: RunStats) {
  return stats.total > 0 ? Math.round((stats.pass / stats.total) * 100) : null;
}

export function classifyRunStatus(value: unknown): RunStatusKey {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return "unknown";
  if (["1", "done", "closed", "finalized", "finalizada"].includes(normalized)) return "completed";
  if (["0", "running", "in_progress", "em_andamento", "open", "active", "aberta"].includes(normalized)) {
    return "in_progress";
  }
  if (["blocked", "bloqueada"].includes(normalized)) return "blocked";
  if (["2", "abort", "aborted", "failed", "fail", "erro", "error", "falha", "violated"].includes(normalized)) {
    return "at_risk";
  }
  if (["draft", "saved", "pending", "pendente"].includes(normalized)) return "pending";
  return "unknown";
}

