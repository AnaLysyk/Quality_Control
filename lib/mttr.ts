// Utility to calculate MTTR (Mean Time To Resolution) in milliseconds
// Returns null if either date is missing or invalid
export function calcMTTR(openedAt?: string, closedAt?: string | null): number | null {
  if (!openedAt || !closedAt) return null;
  const start = new Date(openedAt).getTime();
  const end = new Date(closedAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  return Math.max(0, end - start); // ms
}
