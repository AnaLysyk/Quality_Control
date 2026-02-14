export function shouldUseJsonStore() {
  const raw = String(process.env.E2E_USE_JSON || process.env.USE_JSON_STORE || "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

