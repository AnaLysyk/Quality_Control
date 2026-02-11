import os from "node:os";
import path from "node:path";

export function getJsonStoreDir() {
  const override = process.env.JSON_STORE_DIR?.trim();
  if (override) return override;
  if (process.env.VERCEL) return path.join(os.tmpdir(), "painel-qa");
  return path.join(process.cwd(), "data");
}

export function getJsonStorePath(filename: string) {
  return path.join(getJsonStoreDir(), filename);
}
