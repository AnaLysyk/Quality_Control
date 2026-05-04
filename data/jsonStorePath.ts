import path from "node:path";

export function getJsonStoreDir() {
  const override = process.env.JSON_STORE_DIR?.trim();
  if (override) return override;
  // When running Playwright in parallel, use a per-worker subdir to avoid
  // cross-test interference when the app falls back to file-backed JSON.
  const base = path.join(process.cwd(), "data");
  const worker = process.env.PLAYWRIGHT_WORKER_INDEX;
  if (worker && worker.trim() !== "") {
    return path.join(base, `e2e-worker-${worker}`);
  }
  return base;
}

export function getJsonStorePath(filename: string) {
  return path.join(getJsonStoreDir(), filename);
}
