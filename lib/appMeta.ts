const APP_META: Record<string, { label: string; color: string }> = {
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

const APP_COLOR_CLASS: Record<string, string> = {
  sfq: "app-color-smart",
  smart: "app-color-smart",
  print: "app-color-print",
  booking: "app-color-booking",
  cds: "app-color-cds",
  trust: "app-color-trust",
  "cidadao-smart": "app-color-cidadao",
  gmt: "app-color-gmt",
  "mobile-griaule": "app-color-gmt",
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

export function getAppColorClass(key: string) {
  const normalized = key?.toLowerCase?.() ?? "";
  return APP_COLOR_CLASS[normalized] ?? "app-color-default";
}

export type AppMeta = ReturnType<typeof getAppMeta>;
