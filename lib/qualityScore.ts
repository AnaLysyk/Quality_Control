/**
 * Parâmetros de entrada para cálculo do Quality Score.
 */
export type QualityScoreInput = {
  gate_status?: "approved" | "warning" | "failed" | string | null;
  mttr_hours?: number | null;
  open_defects?: number | null;
  fail_rate?: number | null;
};

function clamp(num: number, min: number, max: number) {
  return Math.max(min, Math.min(max, num));
}

function scoreGate(status?: string | null) {
  const s = (status ?? "").toLowerCase();
  if (s === "approved") return 100;
  if (s === "warning") return 60;
  if (s === "failed") return 0;
  return 50;
}

function scoreMttr(mttr?: number | null) {
  if (mttr == null) return 70; // sem dado: meio termo
  if (mttr <= 24) return 100;
  if (mttr <= 48) return 70;
  return 30;
}

function scoreOpenDefects(open?: number | null) {
  const val = open == null ? 0 : open;
  if (val <= 0) return 100;
  if (val <= 2) return 70;
  return 30;
}

function scoreFailRate(rate?: number | null) {
  const val = rate == null ? 0 : rate;
  if (val <= 0) return 100;
  if (val <= 10) return 70;
  return 30;
}

/**
 * Calcula o Quality Score ponderado de acordo com gate, MTTR, defeitos abertos e fail rate.
 * @param input Parâmetros de entrada
 * @returns Score de 0 a 100
 */
export function calculateQualityScore(input: QualityScoreInput): number {
  const gateWeight = 0.4;
  const mttrWeight = 0.25;
  const defectsWeight = 0.2;
  const failRateWeight = 0.15;

  const gateScore = scoreGate(input.gate_status);
  const mttrScore = scoreMttr(input.mttr_hours ?? null);
  const defectsScore = scoreOpenDefects(input.open_defects ?? null);
  const failScore = scoreFailRate(input.fail_rate ?? null);

  const total =
    gateScore * gateWeight +
    mttrScore * mttrWeight +
    defectsScore * defectsWeight +
    failScore * failRateWeight;

  return Math.round(clamp(total, 0, 100));
}
