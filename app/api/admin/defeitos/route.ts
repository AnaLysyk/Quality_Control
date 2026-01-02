import { NextResponse } from "next/server";

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

const QASE_BASE_URL = process.env.QASE_BASE_URL || "https://api.qase.io";
const QASE_TOKEN = process.env.QASE_TOKEN || process.env.QASE_API_TOKEN || "";

// Ajuste este mapa para cada empresa/projeto que quiser agregar no admin.
// projectCode = código do projeto no Qase (ex.: GRIAULE, TMETRIC, etc).
const PROJECT_MAP: { slug: string; projectCode: string }[] = [
  { slug: "griaule", projectCode: process.env.QASE_PROJECT_CODE || process.env.QASE_PROJECT || "" },
];

async function fetchAllDefects(projectCode: string): Promise<QaseDefect[]> {
  if (!QASE_TOKEN || !projectCode) return [];

  const limit = 100;
  let offset = 0;
  const all: QaseDefect[] = [];

  while (true) {
    const res = await fetch(`${QASE_BASE_URL}/v2/defect/${projectCode}?limit=${limit}&offset=${offset}`, {
      headers: {
        Token: QASE_TOKEN,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) break;
    const json: any = await res.json().catch(() => null);
    const entities: any[] = json?.result?.entities ?? [];
    if (!Array.isArray(entities) || entities.length === 0) break;

    entities.forEach((d) => {
      all.push({
        id: String(d.id ?? d.defect_id ?? `defect-${offset}`),
        title: d.title ?? d.name ?? "Defeito",
        status: String(d.status ?? "open"),
        severity: d.severity ?? d.severity_name ?? "medium",
        run_id: d.run_id ?? d.run ?? null,
        tags: Array.isArray(d.tags) ? d.tags : [],
        created_at: d.created_at ?? d.created ?? undefined,
        updated_at: d.updated_at ?? d.updated ?? undefined,
        url: d.url ?? d.link ?? d.web_url ?? undefined,
        projectCode,
      });
    });

    if (entities.length < limit) break;
    offset += limit;
  }

  return all;
}

function aggregate(defects: QaseDefect[]): Aggregated {
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

    const company = d.projectCode || "Projeto";
    byCompany.set(company, (byCompany.get(company) ?? 0) + 1);

    const st = d.status ?? "open";
    byStatus.set(st, (byStatus.get(st) ?? 0) + 1);

    const monthKey = d.created_at ? new Date(d.created_at).toISOString().slice(0, 7) : "sem-data";
    timeline.set(monthKey, (timeline.get(monthKey) ?? 0) + 1);
  });

  return {
    total: defects.length,
    byApplication: Array.from(byApplication.entries()).map(([name, count]) => ({ name, count })),
    byRun: Array.from(byRun.entries()).map(([runId, { count, app }]) => ({ runId, count, app })),
    byCompany: Array.from(byCompany.entries()).map(([name, count]) => ({ name, count, slug: undefined })),
    byStatus: Array.from(byStatus.entries()).map(([status, count]) => ({ status, count })),
    timeline: Array.from(timeline.entries()).map(([month, count]) => ({ month, count })),
    items: defects,
  };
}

export async function GET() {
  if (!QASE_TOKEN) {
    return NextResponse.json(
      {
        error: "QASE_TOKEN ausente. Configure QASE_TOKEN/QASE_PROJECT_CODE.",
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

  const projectCodes = PROJECT_MAP.map((p) => p.projectCode).filter(Boolean);
  const uniqueProjects = Array.from(new Set(projectCodes));

  const allDefects: QaseDefect[] = [];
  for (const projectCode of uniqueProjects) {
    const defects = await fetchAllDefects(projectCode);
    allDefects.push(...defects);
  }

  const aggregated = aggregate(allDefects);
  return NextResponse.json(aggregated, { status: 200 });
}
