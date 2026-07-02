import { NextRequest, NextResponse } from "next/server";
import type { CompanyDashboardData } from "@/empresas/[slug]/dashboard/companyDashboardData";

export const maxDuration = 30;
export const runtime = "nodejs";

export interface ExecutiveAnalysisRequest {
  companySlug: string;
  companyName: string;
  runs: CompanyDashboardData["runs"];
  defects: CompanyDashboardData["defects"];
  applications: CompanyDashboardData["applications"];
  filters: {
    periodPreset: string;
    applicationFilter: string;
    riskFilter: string;
    sourceFilter: string;
  };
}

export interface ExecutiveAnalysisResponse {
  summary: string;
  keyFindings: string[];
  riskAssessment: {
    level: "critical" | "warning" | "stable";
    description: string;
  };
  recommendations: string[];
  technicalMetrics: {
    coverageVariation: number;
    defectConcentration: number;
    regressionRate: number;
    blockageRate: number;
  };
  generatedAt: string;
}

async function generateExecutiveAnalysis(req: ExecutiveAnalysisRequest): Promise<ExecutiveAnalysisResponse> {
  // CÃ¡lculos de mÃ©tricas tÃ©cnicas
  const totalRuns = req.runs.length;
  const totalCases = req.runs.reduce((sum, r) => sum + r.stats.total, 0);
  const totalPass = req.runs.reduce((sum, r) => sum + r.stats.pass, 0);
  const passRate = totalCases > 0 ? (totalPass / totalCases) * 100 : 0;

  const defectsByApp = new Map<string, number>();
  for (const defect of req.defects) {
    defectsByApp.set(defect.applicationKey, (defectsByApp.get(defect.applicationKey) ?? 0) + 1);
  }

  const atRiskApplicationKeys = new Set(
    req.runs
      .filter((r) => r.statusTone === "critical" || r.statusTone === "warning")
      .map((r) => r.applicationKey),
  );
  const appsAtRisk = atRiskApplicationKeys.size;

  const regressions = req.runs.filter((r) => {
    const marker = `${r.statusRaw ?? ""} ${r.statusLabel}`.toLowerCase();
    return marker.includes("regress");
  }).length;
  const blocked = req.runs.reduce((sum, r) => sum + (r.stats.blocked ?? 0), 0);
  const blockageRate = totalCases > 0 ? (blocked / totalCases) * 100 : 0;

  // Gera insights baseados em thresholds
  const keyFindings: string[] = [];
  const recommendations: string[] = [];
  let riskLevel: "critical" | "warning" | "stable" = "stable";

  // AnÃ¡lise 1: Pass rate crÃ­tico
  if (passRate < 70) {
    riskLevel = "critical";
    keyFindings.push(`Pass rate abaixo do esperado em ${passRate.toFixed(1)}%`);
    recommendations.push("Priorizar correÃ§Ã£o de falhas crÃ­ticas em execuÃ§Ãµes recentes");
  } else if (passRate < 80) {
    riskLevel = "warning";
    keyFindings.push(`Pass rate em zona de atenÃ§Ã£o: ${passRate.toFixed(1)}%`);
    recommendations.push("Revisar testes com maior taxa de falha");
  } else {
    keyFindings.push(`Pass rate saudÃ¡vel em ${passRate.toFixed(1)}%`);
  }

  // AnÃ¡lise 2: RegressÃµes
  if (regressions > 0) {
    const regressionRate = (regressions / totalRuns) * 100;
    if (regressionRate > 20) {
      riskLevel = riskLevel === "critical" ? "critical" : "warning";
      keyFindings.push(`Alta taxa de regressÃµes: ${regressions} em ${totalRuns} runs (${regressionRate.toFixed(1)}%)`);
      recommendations.push("Implementar testes de regressÃ£o automatizados para aplicaÃ§Ãµes crÃ­ticas");
    }
  }

  // AnÃ¡lise 3: Bloqueios
  if (blockageRate > 5) {
    riskLevel = riskLevel === "critical" ? "critical" : "warning";
    keyFindings.push(`Taxa de bloqueios elevada: ${blockageRate.toFixed(1)}% dos casos`);
    recommendations.push("Investigar causas de bloqueios recorrentes");
  }

  // AnÃ¡lise 4: ConcentraÃ§Ã£o de defeitos
  if (defectsByApp.size > 0) {
    const maxDefects = Math.max(...Array.from(defectsByApp.values()));
    const totalDefects = Array.from(defectsByApp.values()).reduce((a, b) => a + b, 0);
    const concentration = (maxDefects / totalDefects) * 100;
    if (concentration > 50) {
      keyFindings.push(`Defeitos concentrados: ${concentration.toFixed(1)}% em uma aplicaÃ§Ã£o`);
      recommendations.push("Focar recursos em aplicaÃ§Ã£o com concentraÃ§Ã£o de defeitos");
    }
  }

  // AnÃ¡lise 5: AplicaÃ§Ãµes em risco
  if (appsAtRisk > 0) {
    const riskRatio = (appsAtRisk / req.applications.length) * 100;
    if (riskRatio > 30) {
      riskLevel = riskLevel === "critical" ? "critical" : "warning";
      keyFindings.push(`${appsAtRisk} aplicaÃ§Ã£o(Ãµes) em risco (${riskRatio.toFixed(1)}%)`);
      recommendations.push("Revisar roadmap de estabilizaÃ§Ã£o por aplicaÃ§Ã£o");
    }
  }

  // Gera resumo executivo
  const summary =
    totalRuns === 0
      ? "Nenhum dado disponÃ­vel para o filtro selecionado. Ajuste o perÃ­odo ou filtros para visualizar anÃ¡lises."
      : `Executado anÃ¡lise de ${totalRuns} runs envolvendo ${req.applications.length} aplicaÃ§Ã£o(Ãµes) com pass rate de ${passRate.toFixed(1)}%. ${regressions > 0 ? `Detectadas ${regressions} regressÃ£o(Ãµes)` : "Sem regressÃµes detectadas"}.`;

  // Calcula mÃ©tricas tÃ©cnicas normalizadas
  const coverageVariation = totalRuns > 1
    ? ((req.runs.reduce((sum, r) => sum + r.stats.total, 0) / totalRuns - req.runs.reduce((sum, r) => sum + r.stats.pass, 0) / totalRuns) / 100) * 100
    : 0;
  const defectConcentration = defectsByApp.size > 0 ? (Math.max(...Array.from(defectsByApp.values())) / Array.from(defectsByApp.values()).reduce((a, b) => a + b, 0)) * 100 : 0;
  const regressionRate = totalRuns > 0 ? (regressions / totalRuns) * 100 : 0;

  return {
    summary,
    keyFindings: keyFindings.length > 0 ? keyFindings : ["AnÃ¡lise concluÃ­da com sucesso"],
    riskAssessment: {
      level: riskLevel,
      description:
        riskLevel === "critical"
          ? "IntervenÃ§Ã£o imediata recomendada para mitigar riscos de qualidade"
          : riskLevel === "warning"
            ? "AtenÃ§Ã£o necessÃ¡ria em Ã¡reas de risco identificadas"
            : "Qualidade em nÃ­veis aceitÃ¡veis para o recorte atual",
    },
    recommendations: recommendations.length > 0 ? recommendations : ["Continuidade com monitoramento regular"],
    technicalMetrics: {
      coverageVariation,
      defectConcentration,
      regressionRate,
      blockageRate,
    },
    generatedAt: new Date().toISOString(),
  };
}

export async function POST(req: NextRequest) {
  let body: ExecutiveAnalysisRequest;

  try {
    body = (await req.json()) as ExecutiveAnalysisRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    if (!body.companySlug || !body.runs || !body.applications) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const analysis = await generateExecutiveAnalysis(body);
    return NextResponse.json(analysis);
  } catch (error) {
    console.error("[executive-analysis] Error:", error);
    return NextResponse.json({ error: "Failed to generate analysis" }, { status: 500 });
  }
}

