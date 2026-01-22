import { NextResponse } from "next/server";
import { listQaseRuns } from "@/lib/qaseRuns";
import { getClientQaseSettings } from "@/lib/qaseConfig";
import { readManualReleaseStore } from "@/data/manualData";
import { calcMTTR } from "@/lib/mttr";
import { normalizeDefectStatus, resolveClosedAt, resolveOpenedAt } from "@/lib/defectNormalization";
import { externalFailure, externalSuccess, type ExternalServiceResult } from "@/lib/external";

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
  projectCode?: string;
};

// Contrato único de Defect
export type Defect = {
  id: string;
  title: string;
  status: "open" | "in_progress" | "done";
  openedAt: string;
  closedAt: string | null;
  mttrMs: number | null;
  origin: "manual" | "qase";
  runSlug?: string;
  app?: string;
  severity?: string;
  link?: string;
  created_at?: string;
  updated_at?: string;
};

type DefectResponse = {
  total: number;
  items: Defect[];
  error?: string;
};

const QASE_BASE_URL = (process.env.QASE_BASE_URL || "https://api.qase.io").replace(/\/(v1|v2)\/?$/, "");
const FALLBACK_TOKEN = process.env.QASE_TOKEN || process.env.QASE_API_TOKEN || "";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function normalizeQaseStatus(status: string): "open" | "in_progress" | "done" {
  const st = status.toLowerCase();
  if (st.includes("done") || st.includes("closed") || st.includes("aprovado")) return "done";
  if (st.includes("progress") || st.includes("retest")) return "in_progress";
  return "open";
}

async function fetchAllDefects(projectCode: string, token: string): Promise<ExternalServiceResult<QaseDefect[]>> {
  if (!token || !projectCode) return externalFailure("Qase nao configurado (token/projeto ausente)", []);

  const limit = 100;
  let offset = 0;
  const all: QaseDefect[] = [];

  try {
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

    return externalSuccess(all);
  } catch (error) {
    console.error(`[QASE][DEFECTS] Falha ao listar defeitos para projeto ${projectCode}:`, error);
    return externalFailure("Falha ao listar defeitos no Qase", []);
  }
}

function normalizeQaseDefects(defects: QaseDefect[]): Defect[] {
  return defects.map((d, idx) => {
    const normalizedStatus = normalizeQaseStatus(d.status ?? "open");
    const openedAt = resolveOpenedAt(d.created_at ?? d.updated_at);
    const closedAt = resolveClosedAt(normalizedStatus, (d as any).closed_at, d.updated_at ?? null);
    return {
      id: d.id ?? `defect-${idx}`,
      title: d.title ?? "Defeito",
      status: normalizedStatus,
      openedAt,
      closedAt,
      mttrMs: calcMTTR(openedAt, closedAt),
      origin: "qase",
      runSlug: d.run_id ? String(d.run_id) : undefined,
    };
  });
}

function normalizeManualDefects(releases: any[]): Defect[] {
  return releases.map((r, idx) => {
    const status = normalizeDefectStatus(r.status);
    const openedAt = resolveOpenedAt((r as any).openedAt ?? r.createdAt);
    const closedAt = resolveClosedAt(status, r.closedAt ?? null, r.updatedAt ?? null);
    return {
      id: r.slug ?? r.id ?? `manual-${idx}`,
      title: r.name ?? r.title ?? "Defeito manual",
      status,
      openedAt,
      closedAt,
      mttrMs: calcMTTR(openedAt, closedAt),
      origin: "manual",
      runSlug: (r as any).runSlug ? String((r as any).runSlug) : r.runId ? String(r.runId) : undefined,
    };
  });
}

export async function GET(req: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const url = new URL(req.url);
  const runFilter = url.searchParams.get("run");
  const clientSettings = await getClientQaseSettings(slug);
  const token = clientSettings?.token ?? FALLBACK_TOKEN;
  const projectCodesSet = new Set<string>();
  const settingsCodes = clientSettings?.projectCodes ?? [];
  settingsCodes.forEach((code) => {
    const normalized = typeof code === "string" ? code.trim().toUpperCase() : "";
    if (normalized) projectCodesSet.add(normalized);
  });
  if (!projectCodesSet.size && clientSettings?.projectCode) {
    const normalized = clientSettings.projectCode.trim().toUpperCase();
    if (normalized) projectCodesSet.add(normalized);
  }
  const projectCodes = Array.from(projectCodesSet);

  if (!slug || !projectCodes.length) {
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

  // Qase defects
  const allQaseDefects: QaseDefect[] = [];
  const allQaseRuns: any[] = [];
  const warnings: string[] = [];
  for (const code of projectCodes) {
    const runsResult = await listQaseRuns(code, token);
    if (runsResult.ok) {
      runsResult.data.forEach((run) => {
        const key = `${code}:${String(run.id)}`;
        allQaseRuns.push({
          id: key,
          name: run.name ?? run.slug ?? `Run ${run.id}`,
          status: run.status ?? "",
          createdAt: run.createdAt,
        });
      });
    } else if (runsResult.warning) {
      warnings.push(`[${code}] ${runsResult.warning}`);
    }

    const defectsResult = await fetchAllDefects(code, token);
    if (defectsResult.ok) {
      defectsResult.data.forEach((d) => {
        d.projectCode = code;
      });
      defectsResult.data.forEach((d) => {
        if (d.run_id == null) return;
        (d as any).run_id = `${code}:${String(d.run_id)}`;
      });
      allQaseDefects.push(...defectsResult.data);
    } else if (defectsResult.warning) {
      warnings.push(`[${code}] ${defectsResult.warning}`);
    }
  }

  // Manual defects
  const manualReleases = await readManualReleaseStore();
  const manualDefects = normalizeManualDefects(manualReleases);

  // Releases
  const { getAllReleases } = await import("@/release/data");
  const allReleases = await getAllReleases();

  // Unify
  let allDefects: Defect[] = [
    ...manualDefects,
    ...normalizeQaseDefects(allQaseDefects),
  ];
  allDefects = allDefects.filter((d) => d.openedAt).sort((a, b) => String(b.openedAt).localeCompare(String(a.openedAt)));
  if (runFilter) {
    allDefects = allDefects.filter((d) => d.runSlug === runFilter);
  }
  const closed = allDefects.filter((d) => d.mttrMs != null);
  const avgMttrMs = closed.length ? closed.reduce((acc, d) => acc + (d.mttrMs || 0), 0) / closed.length : null;

  // Enriquecer cada defeito com run e release
  const items = allDefects.map((defect) => {
    // Run
    let run = undefined;
    if (defect.runSlug) {
      run =
        allQaseRuns.find((r) => r.id === defect.runSlug) ||
        manualReleases.find(
          (r) =>
            String(r.runId) === defect.runSlug ||
            (r as any).runSlug === defect.runSlug ||
            r.slug === defect.runSlug,
        );
      if (run) {
        run = {
          id: run.id || run.slug || run.runId,
          name: run.name || run.title,
          status: run.status,
        };
      }
    }
    // Release
    let release = undefined;
    if (defect.runSlug) {
      release = allReleases.find((rel) => String(rel.runId) === defect.runSlug);
      if (release) {
        release = {
          id: release.slug,
          version: release.title,
          status: release.status,
        };
      }
    }
    return {
      ...defect,
      run,
      release,
    };
  });

  const responseBody: Record<string, unknown> = { total: items.length, items, avgMttrMs };
  if (warnings.length) responseBody.warnings = warnings;

  return NextResponse.json(responseBody, { status: 200 });
}
