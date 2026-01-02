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
};

type NormalizedDefect = {
  id: string;
  runSlug: string;
  title: string;
  app: string;
  status: string;
  kanbanStatus: "aberto" | "bloqueado" | "reteste" | "aprovado" | "backlog";
  severity: string;
  link: string;
  created_at?: string;
};

type DefectResponse = {
  total: number;
  byStatus: Record<string, number>;
  byApplication: { name: string; count: number }[];
  items: NormalizedDefect[];
  error?: string;
};

const QASE_BASE_URL = process.env.QASE_BASE_URL || "https://api.qase.io";
const QASE_TOKEN = process.env.QASE_TOKEN || process.env.QASE_API_TOKEN || "";

// Mapeie slug -> projectCode do Qase
const PROJECT_MAP: Record<string, string> = {
  griaule: process.env.QASE_PROJECT_CODE || process.env.QASE_PROJECT || "",
};

function mapKanbanStatus(raw: string): NormalizedDefect["kanbanStatus"] {
  const st = raw.toLowerCase();
  if (st.includes("block")) return "bloqueado";
  if (st.includes("retest") || st.includes("retestar") || st.includes("in_progress")) return "reteste";
  if (st.includes("resolve") || st.includes("closed") || st.includes("done")) return "aprovado";
  if (st.includes("backlog") || st.includes("todo")) return "backlog";
  return "aberto";
}

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
      });
    });

    if (entities.length < limit) break;
    offset += limit;
  }

  return all;
}

function normalize(defects: QaseDefect[]): DefectResponse {
  const byStatus = new Map<string, number>();
  const byApp = new Map<string, number>();

  const items: NormalizedDefect[] = defects.map((d, idx) => {
    const kanban = mapKanbanStatus(d.status ?? "open");
    const app = d.tags?.[0] ?? "Sem aplicação";
    byStatus.set(kanban, (byStatus.get(kanban) ?? 0) + 1);
    byApp.set(app, (byApp.get(app) ?? 0) + 1);
    return {
      id: d.id ?? `defect-${idx}`,
      runSlug: d.run_id ? String(d.run_id) : "",
      title: d.title ?? "Defeito",
      app,
      status: d.status ?? "open",
      kanbanStatus: kanban,
      severity: d.severity ?? "medium",
      link: d.url ?? "#",
      created_at: d.created_at,
    };
  });

  return {
    total: defects.length,
    byStatus: Object.fromEntries(byStatus.entries()),
    byApplication: Array.from(byApp.entries()).map(([name, count]) => ({ name, count })),
    items,
  };
}

export async function GET(_: Request, context: { params: { slug: string } }) {
  const slug = context.params?.slug;
  const projectCode = PROJECT_MAP[slug];

  if (!slug || !projectCode) {
    return NextResponse.json(
      { defects: [], total: 0, byStatus: {}, byApplication: [], error: "Projeto Qase não configurado para esta empresa." },
      { status: 200 },
    );
  }

  if (!QASE_TOKEN) {
    return NextResponse.json(
      { defects: [], total: 0, byStatus: {}, byApplication: [], error: "QASE_TOKEN ausente." },
      { status: 200 },
    );
  }

  const defects = await fetchAllDefects(projectCode);
  const normalized = normalize(defects);

  // Mantém compatibilidade com a UI atual: envia defects em items e em defects.
  return NextResponse.json({ defects: normalized.items, ...normalized }, { status: 200 });
}
