import { NextResponse } from "next/server";
import { getClientQaseSettings } from "@/lib/qaseConfig";
import { readManualReleaseStore } from "../../../../data/manualData";
import { calcMTTR } from "@/lib/mttr";
import { normalizeDefectStatus, resolveClosedAt, resolveOpenedAt } from "@/lib/defectNormalization";

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val));
}

function getStatus(score: number) {
  if (score >= 80) return { status: "healthy" };
  if (score >= 60) return { status: "attention" };
  return { status: "risk" };
}

export async function GET(req: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  // Manual defects
  const manualReleases = await readManualReleaseStore();
  const manualDefects = manualReleases.map((r: any) => {
    const status = normalizeDefectStatus(r.status);
    const openedAt = resolveOpenedAt((r as any).openedAt ?? r.createdAt);
    const closedAt = resolveClosedAt(status, r.closedAt ?? null, r.updatedAt ?? null);
    return {
      run: r.runSlug ?? r.slug ?? r.id ?? "manual",
      status,
      openedAt,
      closedAt,
      mttrMs: calcMTTR(openedAt, closedAt),
      origin: "manual",
    };
  });

  // Qase defects
  const clientSettings = await getClientQaseSettings(slug);
  const token = clientSettings?.token || process.env.QASE_TOKEN || process.env.QASE_API_TOKEN || "";
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

  let qaseDefects: any[] = [];
  for (const code of projectCodes) {
    const defects = await fetch(`https://api.qase.io/v1/defect/${code}?limit=1000`, {
      headers: { Token: token, Accept: "application/json" },
      cache: "no-store",
    })
      .then((res) => res.json())
      .then((json) => Array.isArray(json?.result?.entities) ? json.result.entities : [])
      .catch(() => []);
    qaseDefects.push(
      ...defects.map((d: any) => {
        const status = normalizeDefectStatus(d.status ?? "open");
        const openedAt = resolveOpenedAt(d.created_at ?? d.updated_at);
        const closedAt = resolveClosedAt(status, d.closed_at ?? null, d.updated_at ?? null);
        return {
          run: d.run_slug ?? d.run_id ?? "qase",
          status,
          openedAt,
          closedAt,
          mttrMs: calcMTTR(openedAt, closedAt),
          origin: "qase",
        };
      })
    );
  }

  // Agrupar por run
  const allDefects = [...manualDefects, ...qaseDefects].filter((d) => d.run);
  const runsMap = new Map<string, any[]>();
  for (const defect of allDefects) {
    if (!runsMap.has(defect.run)) runsMap.set(defect.run, []);
    runsMap.get(defect.run)!.push(defect);
  }

  // Calcular métricas por run
  const runs = Array.from(runsMap.entries()).map(([run, defects]) => {
    const defectCount = defects.length;
    const openCount = defects.filter((d) => d.status !== "done").length;
    const overSlaCount = defects.filter((d) => {
      const opened = new Date(d.openedAt).getTime();
      return Number.isFinite(opened) && (!d.closedAt) && Date.now() - opened > 172800000;
    }).length;
    const closed = defects.filter((d) => d.closedAt && d.mttrMs != null);
    const mttr = closed.length ? Math.round(closed.reduce((acc, d) => acc + (d.mttrMs || 0), 0) / closed.length / 60000) / 60 : null;
    // Score: penaliza overSla e mttr alto
    let score = 100;
    if (overSlaCount > 0) score -= overSlaCount * 10;
    if (mttr && mttr > 24) score -= 5;
    score = clamp(score, 0, 100);
    const { status } = getStatus(score);
    return { run, defectCount, openCount, overSlaCount, mttr, score, status };
  });
  runs.sort((a, b) => a.score - b.score);
  return NextResponse.json({ runs }, { status: 200 });
}
