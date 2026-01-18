import { NextResponse } from "next/server";
import { getAllReleases } from "@/release/data";
import { readManualReleaseStore } from "@/data/manualData";
import { appendQualityGateHistory } from "@/lib/qualityGateHistory";
import { randomUUID } from "crypto";

// Helper: get all runs for a release (manual + Qase)
async function getRunsForRelease(releaseSlug: string) {
  // Manual runs
  const manualRuns = await readManualReleaseStore();
  const runs = manualRuns.filter(r => r.slug === releaseSlug);
  // TODO: Add Qase runs if needed
  return runs;
}

export async function GET(req: Request) {
  const releases = await getAllReleases();
  const result = [];
  for (const rel of releases) {
    const runs = await getRunsForRelease(rel.slug);
    const failedRuns = runs.filter(r => {
      if (!r.status) return false;
      const s = String(r.status).toLowerCase();
      return s === "fail" || s === "falha" || s === "failed";
    });
    let status: "ok" | "risk" | "blocked" = "ok";
    if (failedRuns.length > 0) status = "risk";
    // TODO: Add logic for "blocked" if needed

    // --- Quality Gate snapshot logic ---
    // Exemplo de métricas: mttr_hours, open_defects, fail_rate
    // (mock simples: valores fictícios, pois só temos runs)
    const mttr_hours = 24; // TODO: calcular real se disponível
    const open_defects = 0; // TODO: calcular real se disponível
    const totalRuns = runs.length;
    const fail_rate = totalRuns > 0 ? Math.round((failedRuns.length / totalRuns) * 100) : 0;
    let gate_status: "approved" | "warning" | "failed" = "approved";
    let reasons: string[] = [];
    if (status === "risk") {
      gate_status = "failed";
      reasons.push("Run falhou");
    }
    // Exemplo: warning se fail_rate > 0 mas não "risk"
    // (ajuste conforme regras reais)

    // Salvar snapshot (imutável)
    await appendQualityGateHistory({
      id: randomUUID(),
      company_slug: rel.clientId || "griaule", // fallback
      release_slug: rel.slug,
      gate_status,
      mttr_hours,
      open_defects,
      fail_rate,
      reasons,
      evaluated_at: new Date().toISOString(),
    });

    result.push({
      releaseSlug: rel.slug,
      status,
      failedRunsCount: failedRuns.length,
    });
  }
  return NextResponse.json({ releases: result });
}
