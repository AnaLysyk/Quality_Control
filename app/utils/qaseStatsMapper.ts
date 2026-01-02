type RawStats = Record<string, unknown> | null | undefined;

const toNumber = (value: unknown) => {
  const n = Number(value ?? 0);
  return Number.isNaN(n) ? 0 : n;
};

export function mapStats(stats: RawStats) {
  const source = stats ?? {};
  return {
    pass: toNumber((source as Record<string, unknown>).passed ?? (source as Record<string, unknown>).pass),
    fail: toNumber((source as Record<string, unknown>).failed ?? (source as Record<string, unknown>).fail),
    blocked: toNumber((source as Record<string, unknown>).blocked),
    notRun: toNumber((source as Record<string, unknown>).untested ?? (source as Record<string, unknown>).notRun),
  };
}
