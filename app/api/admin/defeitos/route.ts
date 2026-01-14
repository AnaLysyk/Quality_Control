import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { requireGlobalAdmin } from "@/lib/rbac/requireGlobalAdmin";

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

// Supabase is accessed via server-only client `getSupabaseServer()`.

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normalizeSlug(value: unknown): string | null {
  const s = normalizeString(value);
  return s ? s.toLowerCase() : null;
}

// Admin access is enforced via `requireGlobalAdmin(req)`.

type ProjectEntry = { slug: string; projectCode: string };

function parseProjectMapFromEnv(): ProjectEntry[] {
  const raw =
    process.env.QASE_PROJECT_MAP ||
    process.env.QASE_PROJECTS ||
    process.env.NEXT_PUBLIC_QASE_PROJECT_MAP ||
    "";

  const trimmed = raw.trim();
  if (!trimmed) return [];

  // Option A: JSON array of {slug, projectCode}
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

  // Option B: "slug:CODE,slug2:CODE2"
  const out: ProjectEntry[] = [];
  const parts = trimmed.split(",").map((p) => p.trim()).filter(Boolean);
  for (const part of parts) {
    const [slugRaw, codeRaw] = part.split(":").map((p) => p.trim());
    const slug = normalizeSlug(slugRaw);
    const projectCode = normalizeString(codeRaw);
    if (slug && projectCode) out.push({ slug, projectCode });
  }
  return out;
}

function extractProjectCodeFromRow(row: Record<string, unknown>): string | null {
  return (
    normalizeString(row.qase_project_code ?? null) ||
    normalizeString(row.qase_project ?? null) ||
    normalizeString(row.project_code ?? null) ||
    normalizeString(row.project ?? null) ||
    normalizeString(row.projectCode ?? null) ||
    normalizeString(row.projectKey ?? null)
  );
}

async function loadProjectMapFromSupabase(): Promise<ProjectEntry[]> {
  try {
    const service = getSupabaseServer();
    const out: ProjectEntry[] = [];

    for (const table of ["cliente", "clients"] as const) {
      const { data, error } = await service.from(table).select("*").limit(500);
      if (error || !Array.isArray(data)) continue;
      for (const rowAny of data) {
        const row = asRecord(rowAny);
        if (!row) continue;
        const slug = normalizeSlug(row.slug);
        const projectCode = extractProjectCodeFromRow(row);
        if (slug && projectCode) out.push({ slug, projectCode });
      }
    }

    return out;
  } catch {
    return [];
  }
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
    const app = d.tags?.[0] ?? "Sem aplicação";
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
  const admin = await requireGlobalAdmin(req);
  if (!admin) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 403 });
  }

  if (!QASE_TOKEN) {
    return NextResponse.json(
      {
        error:
          "QASE_TOKEN ausente. Configure QASE_TOKEN (e QASE_PROJECT_MAP ou cadastre qase_project_code nas empresas).",
        total: 0,
        byApplication: [],
        byRun: [],
        byCompany: [],
        byStatus: [],
        timeline: [],
        items: [],
      },
      { status: 200 },
    );
  }

  const envMap = parseProjectMapFromEnv();
  const legacyCode = normalizeString(process.env.QASE_PROJECT_CODE || process.env.QASE_PROJECT || "");
  const legacy = legacyCode ? ([{ slug: "griaule", projectCode: legacyCode }] satisfies ProjectEntry[]) : [];
  const combined = [...envMap, ...legacy];
  const projectMap = combined.length ? combined : await loadProjectMapFromSupabase();

  const projectCodeToSlug = new Map<string, string>();
  for (const entry of projectMap) {
    if (entry.projectCode && entry.slug) projectCodeToSlug.set(entry.projectCode, entry.slug);
  }

  const uniqueProjects = Array.from(new Set(projectMap.map((p) => p.projectCode).filter(Boolean)));

  if (!uniqueProjects.length) {
    return NextResponse.json(
      {
        error:
          "Nenhum projeto Qase configurado. Configure QASE_PROJECT_MAP (ex: griaule:GRIAULE,acme:ACME) ou preencha qase_project_code nas empresas (Supabase).",
        total: 0,
        byApplication: [],
        byRun: [],
        byCompany: [],
        byStatus: [],
        timeline: [],
        items: [],
      },
      { status: 200 },
    );
  }

  const allDefects: QaseDefect[] = [];
  for (const projectCode of uniqueProjects) {
    const defects = await fetchAllDefects(projectCode);
    allDefects.push(...defects);
  }

  const aggregated = aggregate(allDefects, projectCodeToSlug);
  return NextResponse.json(aggregated, { status: 200 });
}
