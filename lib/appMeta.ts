const APP_META: Record<string, { label: string; color: string; description?: string }> = {
  sfq: { label: "SMART", color: "#2563eb" },
  smart: { label: "SMART", color: "#2563eb" },
  print: { label: "PRINT", color: "#9333ea" },
  booking: { label: "BOOKING", color: "#0ea5e9" },
  cds: { label: "CDS", color: "#22c55e" },
  trust: { label: "TRUST", color: "#f59e0b" },
  "cidadao-smart": { label: "CIDADAO SMART", color: "#ef4444" },
  gmt: { label: "GMT", color: "#4f46e5" },
  "mobile-griaule": { label: "GMT", color: "#4f46e5" },
};

export function getAppMeta(key: string, fallback?: string) {
  const normalized = key?.toLowerCase?.() ?? "";
  const meta = APP_META[normalized];
  if (meta) return meta;
  return {
    label: (fallback || key || "").toUpperCase(),
    color: "#0b1a3c",
  };
}

export type AppMeta = ReturnType<typeof getAppMeta>;
