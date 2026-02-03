import { NextResponse } from "next/server";
import { getAllReleases } from "@/release/data";
import { readManualReleaseStore } from "@/data/manualData";
import { appendQualityGateHistory } from "@/lib/qualityGateHistory";
import { sendQualityAlert } from "@/lib/qualityAlert";
import { calculateQualityScore } from "@/lib/qualityScore";
import { randomUUID } from "crypto";

// Helper: get all runs for a release (manual + Qase)
async function getRunsForRelease(releaseSlug: string, clientKey?: string | null) {
  // Manual runs
  const manualRuns = await readManualReleaseStore();
  const runs = manualRuns.filter((r) => r.slug === releaseSlug);
  if (runs.length) return runs;
  if (clientKey) {
    return manualRuns.filter((r) => (r.clientSlug ?? null) === clientKey);
  }
  // TODO: Add Qase runs if needed
  return runs;
}

export async function GET(req: Request) {
  const releases = await getAllReleases();
  const result = [];
  for (const rel of releases) {
    const companyKey = rel.clientId ?? rel.clientName ?? null;
    const runs = await getRunsForRelease(rel.slug, companyKey);
    const failedRuns = runs.filter((r: any) => {
      const failCount = Number(r?.stats?.fail ?? r?.metrics?.fail ?? 0);
      if (Number.isFinite(failCount) && failCount > 0) return true;
      if (!r.status) return false;
      const s = String(r.status).toLowerCase();
      return s === "fail" || s === "falha" || s === "failed";
    });
    let status: "ok" | "risk" | "blocked" = "ok";
    if (failedRuns.length > 0) status = "risk";
    // TODO: Add logic for "blocked" if needed

    // --- Quality Gate snapshot logic ---
    // Exemplo de metricas: mttr_hours, open_defects, fail_rate
    // (mock simples: valores ficticios, pois so temos runs)
    const mttr_hours = 24; // TODO: calcular real se disponivel
    const open_defects = 0; // TODO: calcular real se disponivel
    const totalRuns = runs.length;
    const fail_rate = totalRuns > 0 ? Math.round((failedRuns.length / totalRuns) * 100) : 0;
    let gate_status: "approved" | "warning" | "failed" = "approved";
    const reasons: string[] = [];
    if (status === "risk") {
      gate_status = "failed";
      reasons.push("Run falhou");
    }
    // Exemplo: warning se fail_rate > 0 mas nao "risk"
    // (ajuste conforme regras reais)

    // Salvar snapshot (imutavel)
    const snapshot = {
      id: randomUUID(),
      company_slug: rel.clientId || "griaule", // fallback
      release_slug: rel.slug,
      gate_status,
      mttr_hours,
      open_defects,
      fail_rate,
      reasons,
      evaluated_at: new Date().toISOString(),
    };
    await appendQualityGateHistory(snapshot);

    // Disparar alertas automaticos
    const companySlug = rel.clientId || "griaule";
    if (gate_status === "failed") {
      await sendQualityAlert({
        companySlug,
        type: "gate_failed",
        severity: "critical",
        message: `Quality Gate falhou na release ${rel.slug}`,
        metadata: { release: rel.slug, reasons },
        timestamp: new Date().toISOString(),
      });
    }
    if (snapshot.mttr_hours && snapshot.mttr_hours > 48) {
      await sendQualityAlert({
        companySlug,
        type: "mttr_exceeded",
        severity: "critical",
        message: `MTTR alto na release ${rel.slug}: ${snapshot.mttr_hours}h`,
        metadata: { release: rel.slug, mttr_hours: snapshot.mttr_hours },
        timestamp: new Date().toISOString(),
      });
    }
    if (fail_rate > 0) {
      await sendQualityAlert({
        companySlug,
        type: "run_failed",
        severity: "warning",
        message: `Runs com falha na release ${rel.slug} (fail rate ${fail_rate}%)`,
        metadata: { release: rel.slug, fail_rate },
        timestamp: new Date().toISOString(),
      });
    }

    const qualityScore = calculateQualityScore({
      gate_status,
      mttr_hours: snapshot.mttr_hours,
      open_defects: snapshot.open_defects,
      fail_rate,
    });

    result.push({
      releaseSlug: rel.slug,
      status,
      failedRunsCount: failedRuns.length,
      quality_score: qualityScore,
    });
  }
  return NextResponse.json({ releases: result });
}
