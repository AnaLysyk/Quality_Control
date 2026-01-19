type GoalStatus = "met" | "risk" | "violated";
type Trend = "improving" | "stable" | "degrading";
type ReleaseStatus = "ok" | "risk" | "violated";

export type HealthInput = {
  goals: GoalStatus[];
  trend: Trend | null;
  releases: ReleaseStatus[];
};

export type HealthOutput = {
  score: number;
  status: "healthy" | "attention" | "critical";
  reasons: string[];
};

function classify(score: number): "healthy" | "attention" | "critical" {
  if (score >= 80) return "healthy";
  if (score >= 50) return "attention";
  return "critical";
}

export function calculateHealthScore(input: HealthInput): HealthOutput {
  let score = 100;
  const reasons: string[] = [];

  // Goals
  input.goals.forEach((g) => {
    if (g === "violated") {
      score -= 30;
      reasons.push("Meta violada");
    } else if (g === "risk") {
      score -= 15;
      reasons.push("Meta em risco");
    }
  });

  // Trend
  if (input.trend === "degrading") {
    score -= 20;
    reasons.push("Tendência degradando");
  }

  // Releases (última release conta)
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
