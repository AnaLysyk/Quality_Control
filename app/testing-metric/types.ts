export type RiskCategory = "stable" | "attention" | "risk";

export interface Company {
  id: string;
  name: string;
  logoUrl?: string | null;
  passRate: number; // 0-100
  runsOpen: number;
  criticalDefects: number;
  releasesActive: number;
  trendPercent: number; // positive up, negative down
  qualityGate?: "approved" | "attention" | "failed" | "no-data";
  lastUpdated?: string; // ISO
}

export interface RiskInputs {
  gateFailed?: boolean;
  negativeTrendPercent?: number; // positive number meaning decline
  runsOpenDays?: number; // days open
  missingData?: boolean;
  passRateBelowMinimum?: boolean;
}

export interface RiskResult {
  score: number; // 0..100
  category: RiskCategory;
  reasons: string[];
}

/**
 * Compute risk score using official model:
 * Gate failed -> +40
 * Trend negative -> +20 (scaled by magnitude)
 * Runs open > X days -> +15
 * Missing data -> +15
 * Pass rate below minimum -> +10
 */
export function computeRiskFromInputs(inputs: RiskInputs): RiskResult {
  let score = 0;
  const reasons: string[] = [];

  if (inputs.gateFailed) {
    score += 40;
    reasons.push("Quality gate failed");
  }

  if (inputs.negativeTrendPercent && inputs.negativeTrendPercent > 0) {
    // scale up to 20 points for a large drop (e.g., 20%+)
    const add = Math.min(20, (inputs.negativeTrendPercent / 20) * 20);
    score += add;
    reasons.push(`Negative trend ${inputs.negativeTrendPercent}%`);
  }

  if (typeof inputs.runsOpenDays === "number") {
    // threshold example: > 7 days
    if (inputs.runsOpenDays > 7) {
      score += 15;
      reasons.push(`Runs open ${inputs.runsOpenDays}d`);
    }
  }

  if (inputs.missingData) {
    score += 15;
    reasons.push("Missing data");
  }

  if (inputs.passRateBelowMinimum) {
    score += 10;
    reasons.push("Pass rate below minimum");
  }

  // clamp
  score = Math.max(0, Math.min(100, Math.round(score)));

  const category: RiskCategory = score <= 20 ? "stable" : score <= 50 ? "attention" : "risk";

  return { score, category, reasons };
}

/**
 * Example API contracts (suggested endpoints):
 * GET /api/governance/summary -> { monitored: number, inRisk: number, inAttention: number, releasesActive, runsOpen, criticals }
 * GET /api/governance/company/:id -> Company + recent metrics
 * GET /api/governance/trends?company=:id&period=7|30 -> [{ date, passRate }]
 * GET /api/governance/risk-score?company=:id -> RiskResult
 */
