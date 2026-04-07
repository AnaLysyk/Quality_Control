import "server-only";

import { getCompanyDefects } from "@/lib/companyDefects";

type CompanyQualitySummary = {
  companyName: string;
  qualityScore: number;
  totalDefects: number;
  openDefects: number;
  closedDefects: number;
  mttrAvg: number | null;
  slaOverdue: number;
};

export async function getCompanyQualitySummary(slug: string, _period: string = "30d"): Promise<CompanyQualitySummary> {
  void _period;
  const defectsPayload = await getCompanyDefects(slug);
  const all = defectsPayload.items.filter((defect) => Boolean(defect.openedAt));
  const openDefects = all.filter((defect) => defect.normalizedStatus !== "done");
  const closedDefects = all.filter((defect) => defect.normalizedStatus === "done");
  const totalDefects = all.length;
  const mttrClosed = closedDefects.filter((defect) => defect.mttrMs != null);
  const mttrAvg =
    mttrClosed.length > 0
      ? Math.round((mttrClosed.reduce((acc, defect) => acc + (defect.mttrMs || 0), 0) / mttrClosed.length) / 360000) / 10
      : null;
  const SLA_MS = 172800000;
  const now = Date.now();
  const slaOverdue = openDefects.filter((defect) => {
    const opened = defect.openedAt ? new Date(defect.openedAt).getTime() : Number.NaN;
    return Number.isFinite(opened) && now - opened > SLA_MS;
  }).length;

  let qualityScore = 100;
  if (slaOverdue > 0) qualityScore -= slaOverdue * 10;
  if (mttrAvg != null && mttrAvg > 48) qualityScore -= 5;
  qualityScore = Math.max(0, Math.min(qualityScore, 100));

  return {
    companyName: slug,
    qualityScore,
    totalDefects,
    openDefects: openDefects.length,
    closedDefects: closedDefects.length,
    mttrAvg,
    slaOverdue,
  };
}

export async function getCompanyDefectsExport(slug: string, _period: string = "30d") {
  void _period;
  const defectsPayload = await getCompanyDefects(slug);
  const all = defectsPayload.items.filter((defect) => Boolean(defect.openedAt));
  return all.map((defect) => ({
    id: defect.id,
    title: defect.title,
    origin: defect.origin,
    status: defect.normalizedStatus,
    openedAt: defect.openedAt,
    closedAt: defect.closedAt,
    mttrHours: defect.mttrMs != null ? Math.round((defect.mttrMs / 360000)) / 10 : "",
    run: defect.runSlug || "",
    severity: defect.severity || "",
    app: defect.projectCode || "",
    kanbanStatus: defect.normalizedStatus === "done" ? "aprovado" : defect.normalizedStatus === "in_progress" ? "em_andamento" : "aberto",
    externalUrl: defect.externalUrl || "",
  }));
}
