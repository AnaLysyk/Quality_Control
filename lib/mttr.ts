
/**
 * Calcula o MTTR (Mean Time To Resolution) em milissegundos.
 * Retorna null se alguma data for inválida ou ausente.
 * @param openedAt Data/hora de abertura (ISO string)
 * @param closedAt Data/hora de fechamento (ISO string ou null)
 * @returns Diferença em ms ou null
 */
export function calcMTTR(openedAt?: string, closedAt?: string | null): number | null {
  if (!openedAt || !closedAt) return null;
  const start = new Date(openedAt).getTime();
  const end = new Date(closedAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  return Math.max(0, end - start); // ms
}
