import path from "path";

const USE_E2E_STORAGE =
  process.env.PLAYWRIGHT_MOCK === "true" ||
  process.env.E2E_USE_JSON === "1" ||
  process.env.E2E_USE_JSON === "true" ||
  process.env.NODE_ENV === "test";

const BASE_DIR = USE_E2E_STORAGE
  ? path.join(process.cwd(), ".tmp", "e2e")
  : path.join(process.cwd(), "data");

export function resolveSeedPath(fileName: string) {
  return path.join(BASE_DIR, fileName);
}
