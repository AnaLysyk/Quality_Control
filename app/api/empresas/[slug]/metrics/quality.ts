import { NextResponse } from "next/server";
import { getClientQaseSettings } from "@/lib/qaseConfig";
import { readManualReleaseStore } from "../../../../data/manualData";
import { normalizeDefectStatus, resolveOpenedAt } from "@/lib/defectNormalization";

const SLA_MS = 172800000; // 48h

export async function GET(req: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;

  // Manual defects
  const manualReleases = await readManualReleaseStore();
  const manualDefects = manualReleases.map((r: any) => ({
    id: r.slug ?? r.id ?? "",
    title: r.name ?? r.title ?? "Defeito manual",
    status: normalizeDefectStatus(r.status),
    openedAt: resolveOpenedAt((r as any).openedAt ?? r.createdAt),
    origin: "manual",
  }));

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

  let qaseDefects: { id: string; title: string; status: string; openedAt: string; origin: "qase" }[] = [];
  for (const code of projectCodes) {
    const defects = await fetch(`https://api.qase.io/v1/defect/${code}?limit=1000`, {
      headers: { Token: token, Accept: "application/json" },
      cache: "no-store",
    })
      .then((res) => res.json())
      .then((json) => Array.isArray(json?.result?.entities) ? json.result.entities : [])
      .catch(() => []);
    qaseDefects.push(
      ...defects.map((d: any) => ({
        id: d.id ?? d.defect_id ?? "",
        title: d.title ?? d.name ?? "Defeito Qase",
        status: normalizeDefectStatus(d.status ?? "open"),
        openedAt: resolveOpenedAt(d.created_at ?? d.updated_at),
        origin: "qase" as const,
      }))
    );
  }

  // Merge and filter
  const all = [...manualDefects, ...qaseDefects].filter((d) => d.openedAt);
  const openDefects = all.filter((d) => d.status !== "done");
  const now = Date.now();
  const overSlaDefects = openDefects.filter((d) => {
    const opened = new Date(d.openedAt).getTime();
    return Number.isFinite(opened) && now - opened > SLA_MS;
  });

  return NextResponse.json({
    slaMs: SLA_MS,
    openCount: openDefects.length,
    overSlaCount: overSlaDefects.length,
    overSlaDefects: overSlaDefects.map((d) => ({ id: d.id, title: d.title, origin: d.origin })),
  }, { status: 200 });
}
