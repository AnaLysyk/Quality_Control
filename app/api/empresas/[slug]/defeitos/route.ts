import { NextResponse } from "next/server";

import { listQaseRuns } from "@/lib/qaseRuns";
import { getClientQaseSettings } from "@/lib/qaseConfig";

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
  runName?: string;
  title: string;
  app: string;
  status: string;
  kanbanStatus: "aberto" | "bloqueado" | "reteste" | "aprovado" | "backlog";
  severity: string;
  link: string;
  created_at?: string;
  origin: "automatico";
};

type DefectResponse = {
  total: number;
  byStatus: Record<string, number>;
  byApplication: { name: string; count: number }[];
  items: NormalizedDefect[];
  error?: string;
};

const QASE_BASE_URL = (process.env.QASE_BASE_URL || "https://api.qase.io").replace(/\/(v1|v2)\/?$/, "");
const FALLBACK_TOKEN = process.env.QASE_TOKEN || process.env.QASE_API_TOKEN || "";

const PROJECT_MAP: Record<string, string> = {
  griaule: process.env.QASE_PROJECT_CODE || process.env.QASE_PROJECT || "",
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function mapKanbanStatus(raw: string): NormalizedDefect["kanbanStatus"] {
  const st = raw.toLowerCase();
  if (st.includes("block")) return "bloqueado";
  if (st.includes("retest") || st.includes("retestar") || st.includes("in_progress")) return "reteste";
  if (st.includes("resolve") || st.includes("closed") || st.includes("done")) return "aprovado";
  if (st.includes("backlog") || st.includes("todo")) return "backlog";
  return "aberto";
}

async function fetchAllDefects(projectCode: string, token: string): Promise<QaseDefect[]> {
  if (!token || !projectCode) return [];

  const limit = 100;
  let offset = 0;
  const all: QaseDefect[] = [];

  while (true) {
    const res = await fetch(`${QASE_BASE_URL}/v1/defect/${projectCode}?limit=${limit}&offset=${offset}`, {
      headers: {
        Token: token,
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
      });
    });

    if (entities.length < limit) break;
    offset += limit;
  }

  return all;
}

function normalize(defects: QaseDefect[], runNames: Map<string, string>): DefectResponse {
  const byStatus = new Map<string, number>();
  const byApp = new Map<string, number>();

  const items: NormalizedDefect[] = defects.map((d, idx) => {
    const kanban = mapKanbanStatus(d.status ?? "open");
    const app = d.tags?.[0] ?? "Sem aplicacao";
    byStatus.set(kanban, (byStatus.get(kanban) ?? 0) + 1);
    byApp.set(app, (byApp.get(app) ?? 0) + 1);
    const runKey = d.run_id ? String(d.run_id) : "";
    const runName = runKey ? runNames.get(runKey) : undefined;
    return {
      id: d.id ?? `defect-${idx}`,
      runSlug: d.run_id ? String(d.run_id) : "",
      runName,
      title: d.title ?? "Defeito",
      app,
      status: d.status ?? "open",
      kanbanStatus: kanban,
      severity: d.severity ?? "medium",
      link: d.url ?? "#",
      created_at: d.created_at,
      origin: "automatico",
    };
  });

  return {
    total: defects.length,
    byStatus: Object.fromEntries(byStatus.entries()),
    byApplication: Array.from(byApp.entries()).map(([name, count]) => ({ name, count })),
    items,
  };
}

export async function GET(_: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const clientSettings = await getClientQaseSettings(slug);
  const projectCode = clientSettings?.projectCode ?? PROJECT_MAP[slug];
  const token = clientSettings?.token ?? FALLBACK_TOKEN;

  if (!slug || !projectCode) {
    return NextResponse.json(
      { defects: [], total: 0, byStatus: {}, byApplication: [], error: "Projeto Qase nao configurado para esta empresa." },
      { status: 200 }
    );
  }

  if (!token) {
    return NextResponse.json(
      { defects: [], total: 0, byStatus: {}, byApplication: [], error: "QASE_TOKEN ausente." },
      { status: 200 }
    );
  }

  const qaseRuns = await listQaseRuns(projectCode, token);
  const runNameMap = new Map<string, string>();
  qaseRuns.forEach((run) => {
    if (!run) return;
    const key = String(run.id);
    runNameMap.set(key, run.name ?? run.slug ?? `Run ${run.id}`);
  });

  const defects = await fetchAllDefects(projectCode, token);
  const normalized = normalize(defects, runNameMap);

  return NextResponse.json({ defects: normalized.items, ...normalized }, { status: 200 });
}
