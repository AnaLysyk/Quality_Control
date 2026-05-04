import { NextRequest } from "next/server";
import { requireGlobalAdminWithStatus } from "@/lib/rbac/requireGlobalAdmin";
import { apiFail, apiOk } from "@/lib/apiResponse";

type QaseDefect = {
  id: string;
  title: string;
  status: string;
  severity?: string;
  run_id?: string | number | null;
  tags?: string[];
  created_at?: string;
  updated_at?: string;
  url?: string;
  projectCode: string;
  companySlug?: string | null;
};

type Aggregated = {
  total: number;
  byApplication: { name: string; count: number }[];
  byRun: { runId: string; count: number; app: string }[];
  byCompany: { name: string; count: number; slug?: string | null }[];
  byStatus: { status: string; count: number }[];
  timeline: { month: string; count: number }[];
  items: QaseDefect[];
};

const QASE_BASE_URL = (process.env.QASE_BASE_URL || "https://api.qase.io").replace(/\/(v1|v2)\/?$/, "");
const QASE_TOKEN = process.env.QASE_TOKEN || process.env.QASE_API_TOKEN || "";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normalizeEnvString(value: unknown): string {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return "";
  const unquoted =
    (raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))
      ? raw.slice(1, -1).trim()
      : raw;
  return unquoted;
}

function normalizeSlug(value: unknown): string | null {
  const s = normalizeString(value);
  return s ? s.toLowerCase() : null;
}

type ProjectEntry = { slug: string; projectCode: string };

function parseProjectCodesFromEnv(): string[] {
  const raw = normalizeEnvString(
    process.env.QASE_PROJECT_CODES || process.env.QASE_PROJECTS_CODES || process.env.QASE_PROJECT_KEYS || ""
  );

  const trimmed = raw;
  if (!trimmed) return [];

  return trimmed
    .split(/[,;\s|]+/g)
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean);
}

function parseProjectMapFromEnv(): ProjectEntry[] {
  const raw = normalizeEnvString(
    process.env.QASE_PROJECT_MAP || process.env.QASE_PROJECTS || process.env.NEXT_PUBLIC_QASE_PROJECT_MAP || ""
  );

  const trimmed = raw;
  if (!trimmed) return [];

  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (!Array.isArray(parsed)) return [];
      const out: ProjectEntry[] = [];
      for (const item of parsed) {
        const rec = asRecord(item);
        const slug = normalizeSlug(rec?.slug);
        const projectCode = normalizeString(rec?.projectCode ?? rec?.project ?? rec?.code);
        if (slug && projectCode) out.push({ slug, projectCode });
      }
      return out;
    } catch {
      return [];
    }
  }

  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      const rec = asRecord(parsed);
      if (!rec) return [];
      const out: ProjectEntry[] = [];
      for (const [slugRaw, codeRaw] of Object.entries(rec)) {
        const slug = normalizeSlug(slugRaw);
        const projectCode = normalizeString(codeRaw);
        if (slug && projectCode) out.push({ slug, projectCode });
      }
      return out;
    } catch {
      return [];
    }
  }

  const out: ProjectEntry[] = [];
  const parts = trimmed.split(",").map((p) => p.trim()).filter(Boolean);
  for (const part of parts) {
    const [slugRaw, codeRaw] = part.split(/[:=]/).map((p) => p.trim());
    const slug = normalizeSlug(slugRaw);
    const projectCode = normalizeString(codeRaw);
    if (slug && projectCode) out.push({ slug, projectCode });
  }
  return out;
}

async function fetchAllDefects(projectCode: string): Promise<QaseDefect[]> {
  if (!QASE_TOKEN || !projectCode) return [];

  const limit = 100;
  let offset = 0;
  const all: QaseDefect[] = [];

  while (true) {
    const res = await fetch(`${QASE_BASE_URL}/v1/defect/${projectCode}?limit=${limit}&offset=${offset}`, {
      headers: {
        Token: QASE_TOKEN,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) break;
    const json = (await res.json().catch(() => null)) as unknown;
    const result = asRecord(asRecord(json)?.result);
    const entities = Array.isArray(result?.entities) ? (result?.entities as unknown[]) : [];
    if (!Array.isArray(entities) || entities.length === 0) break;

    entities.forEach((d) => {
      const rec = asRecord(d) ?? {};
      all.push({
        id: String(rec.id ?? rec.defect_id ?? `defect-${offset}`),
        title: (typeof rec.title === "string" ? rec.title : null) ?? (typeof rec.name === "string" ? rec.name : null) ?? "Defeito",
        status: String(rec.status ?? "open"),
        severity: (typeof rec.severity === "string" ? rec.severity : null) ?? (typeof rec.severity_name === "string" ? rec.severity_name : null) ?? "medium",
        run_id: (rec.run_id as string | number | null | undefined) ?? (rec.run as string | number | null | undefined) ?? null,
        tags: Array.isArray(rec.tags) ? (rec.tags as string[]) : [],
        created_at: (typeof rec.created_at === "string" ? rec.created_at : null) ?? (typeof rec.created === "string" ? rec.created : null) ?? undefined,
        updated_at: (typeof rec.updated_at === "string" ? rec.updated_at : null) ?? (typeof rec.updated === "string" ? rec.updated : null) ?? undefined,
        url:
          (typeof rec.url === "string" ? rec.url : null) ??
          (typeof rec.link === "string" ? rec.link : null) ??
          (typeof rec.web_url === "string" ? rec.web_url : null) ??
          undefined,
        projectCode,
      });
    });

    if (entities.length < limit) break;
    offset += limit;
  }

  return all;
}

function aggregate(defects: QaseDefect[], projectCodeToSlug: Map<string, string>): Aggregated {
  const byApplication = new Map<string, number>();
  const byRun = new Map<string, { count: number; app: string }>();
  const byCompany = new Map<string, number>();
  const byStatus = new Map<string, number>();
  const timeline = new Map<string, number>();

  defects.forEach((d) => {
    const app = d.projectCode || d.tags?.[0] || "Sem aplicação";
    byApplication.set(app, (byApplication.get(app) ?? 0) + 1);

    const runKey = d.run_id ? String(d.run_id) : "sem-run";
    const current = byRun.get(runKey) ?? { count: 0, app };
    current.count += 1;
    byRun.set(runKey, current);

    const companySlug = projectCodeToSlug.get(d.projectCode) ?? null;
    const companyKey = companySlug ?? (d.projectCode || "Projeto");
    byCompany.set(companyKey, (byCompany.get(companyKey) ?? 0) + 1);

    const st = d.status ?? "open";
    byStatus.set(st, (byStatus.get(st) ?? 0) + 1);

    const monthKey = d.created_at ? new Date(d.created_at).toISOString().slice(0, 7) : "sem-data";
    timeline.set(monthKey, (timeline.get(monthKey) ?? 0) + 1);
  });

  return {
    total: defects.length,
    byApplication: Array.from(byApplication.entries()).map(([name, count]) => ({ name, count })),
    byRun: Array.from(byRun.entries()).map(([runId, { count, app }]) => ({ runId, count, app })),
    byCompany: Array.from(byCompany.entries()).map(([name, count]) => {
      const slug = projectCodeToSlug.get(name) ?? (name && !name.includes(" ") ? name : null);
      return { name, count, slug };
    }),
    byStatus: Array.from(byStatus.entries()).map(([status, count]) => ({ status, count })),
    timeline: Array.from(timeline.entries()).map(([month, count]) => ({ month, count })),
    items: defects,
  };
}

export async function GET(req: NextRequest) {
  const { admin, status } = await requireGlobalAdminWithStatus(req);
  if (!admin) {
    const msg = status === 401 ? "Não autenticado" : "Sem permissão";
    return apiFail(req, msg, { status, code: status === 401 ? "AUTH_REQUIRED" : "FORBIDDEN", extra: { error: msg } });
  }

  if (!QASE_TOKEN) {
    const payload = {
      error: "QASE_TOKEN ausente. Configure QASE_TOKEN e o mapeamento de projetos.",
      total: 0,
      byApplication: [],
      byRun: [],
      byCompany: [],
      byStatus: [],
      timeline: [],
      items: [],
    };
    return apiOk(req, payload, "OK", { extra: payload });
  }

  const envMap = parseProjectMapFromEnv();
  const rawMap = normalizeEnvString(
    process.env.QASE_PROJECT_MAP || process.env.QASE_PROJECTS || process.env.NEXT_PUBLIC_QASE_PROJECT_MAP || ""
  );
  const hadRawMap = !!rawMap;
  const legacyCode = normalizeString(process.env.QASE_PROJECT_CODE || process.env.QASE_PROJECT || "");
  const legacy = legacyCode ? ([{ slug: "default", projectCode: legacyCode }] satisfies ProjectEntry[]) : [];
  const projectMap = [...envMap, ...legacy];
  const envProjectCodes = parseProjectCodesFromEnv();

  const url = new URL(req.url);
  const companyFilter = normalizeSlug(url.searchParams.get("company") ?? url.searchParams.get("empresa"));
  const projectFilter = normalizeString(url.searchParams.get("project"));

  const projectCodeToSlug = new Map<string, string>();
  for (const entry of projectMap) {
    if (entry.projectCode && entry.slug) projectCodeToSlug.set(entry.projectCode, entry.slug);
  }

  let uniqueProjects = Array.from(
    new Set([
      ...projectMap.map((p) => p.projectCode).filter(Boolean),
      ...envProjectCodes,
    ])
  );

  if (companyFilter) {
    const scoped = projectMap
      .filter((p) => p.slug === companyFilter)
      .map((p) => p.projectCode)
      .filter(Boolean);
    uniqueProjects = Array.from(new Set(scoped));
  }

  if (projectFilter) {
    uniqueProjects = [projectFilter.toUpperCase()];
  }

  if (!uniqueProjects.length) {
    const error = hadRawMap && !envMap.length
      ? "QASE_PROJECT_MAP definido, mas não foi possível interpretar. Use slug:CODE ou JSON."
      : "Nenhum projeto Qase configurado. Defina QASE_PROJECT_MAP ou QASE_PROJECT_CODES.";

    const payload = {
      error,
      diagnostics: {
        hasQaseToken: !!QASE_TOKEN,
        qaseBaseUrl: QASE_BASE_URL,
        env: {
          hasQaseProjectMap: hadRawMap,
          parsedProjectMapEntries: envMap.length,
          parsedProjectCodes: envProjectCodes.length,
          hasLegacyProjectCode: !!legacyCode,
        },
      },
      total: 0,
      byApplication: [],
      byRun: [],
      byCompany: [],
      byStatus: [],
      timeline: [],
      items: [],
    };
    return apiOk(req, payload, "OK", { extra: payload });
  }

  const allDefects: QaseDefect[] = [];
  for (const projectCode of uniqueProjects) {
    const defects = await fetchAllDefects(projectCode);
    defects.forEach((d) => {
      d.companySlug = projectCodeToSlug.get(projectCode) ?? null;
    });
    allDefects.push(...defects);
  }

  const aggregated = aggregate(allDefects, projectCodeToSlug);
  return apiOk(req, aggregated, "OK", { extra: aggregated });
}
