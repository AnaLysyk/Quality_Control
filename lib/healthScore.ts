
/**
 * Status de meta de qualidade.
 * - met: atingida
 * - risk: em risco
 * - violated: violada
 */
type GoalStatus = "met" | "risk" | "violated";

/**
 * Tendência de evolução dos indicadores.
 */
type Trend = "improving" | "stable" | "degrading";

/**
 * Status de release.
 */
type ReleaseStatus = "ok" | "risk" | "violated";


/**
 * Parâmetros de entrada para cálculo do health score.
 */
export type HealthInput = {
  goals: GoalStatus[];
  trend: Trend | null;
  releases: ReleaseStatus[];
};


/**
 * Resultado do cálculo do health score.
 */
export type HealthOutput = {
  score: number;
  status: "healthy" | "attention" | "critical";
  reasons: string[];
};


// Classifica o score em status de saúde
function classify(score: number): "healthy" | "attention" | "critical" {
  if (score >= 80) return "healthy";
  if (score >= 50) return "attention";
  return "critical";
}


/**
 * Calcula o health score de uma empresa/produto baseado em metas, tendência e releases.
 * Penaliza metas violadas, risco, tendência negativa e última release ruim.
 * @param input HealthInput
 * @returns HealthOutput
 */
export function calculateHealthScore(input: HealthInput): HealthOutput {
  let score = 100;
  const reasons: string[] = [];

  // Penaliza metas violadas ou em risco
  input.goals.forEach((g) => {
    if (g === "violated") {
      score -= 30;
      reasons.push("Meta violada");
    } else if (g === "risk") {
      score -= 15;
      reasons.push("Meta em risco");
    }
  });

  // Penaliza tendência degradando
  if (input.trend === "degrading") {
    score -= 20;
    reasons.push("Tendência degradando");
  }

  // Penaliza última release ruim
  const lastRelease = input.releases[0];
  if (lastRelease === "violated") {
    score -= 25;
    reasons.push("Última release violada");
  } else if (lastRelease === "risk") {
    score -= 10;
    reasons.push("Última release em risco");
  }

  const finalScore = Math.max(0, score);
  return {
    score: finalScore,
    status: classify(finalScore),
    reasons,
  };
}
