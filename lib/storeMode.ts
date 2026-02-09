export function shouldUseJsonStore() {
  const raw = process.env.E2E_USE_JSON || process.env.USE_JSON_STORE || "";
  return raw === "1" || raw.toLowerCase() === "true";
}

