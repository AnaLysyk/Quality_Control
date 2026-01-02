export const STATUS_COLORS = {
  pass: "#22c55e",
  fail: "#ef4444",
  blocked: "#facc15",
  notRun: "#64748b",
  total: "#0f172a",
} as const;

export type StatusKey = keyof typeof STATUS_COLORS;

export const STATUS_LABELS: Record<StatusKey, string> = {
  pass: "Pass",
  fail: "Fail",
  blocked: "Blocked",
  notRun: "Not Run",
  total: "Total",
};
