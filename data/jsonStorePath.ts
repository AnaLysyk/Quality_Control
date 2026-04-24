import path from "node:path";

function getJsonStoreOverride() {
  return process.env.JSON_STORE_DIR?.trim();
}

function getWorkerStoreName() {
  const worker = process.env.PLAYWRIGHT_WORKER_INDEX?.trim();
  return worker ? `e2e-worker-${worker}` : null;
}

export function getJsonStoreDir() {
  const override = getJsonStoreOverride();
  if (override) return override;
  // When running Playwright in parallel, use a per-worker subdir to avoid
  // cross-test interference when the app falls back to file-backed JSON.
  const workerStoreName = getWorkerStoreName();
  if (workerStoreName) {
    return path.join(/*turbopackIgnore: true*/ process.cwd(), "data", workerStoreName);
  }
  return path.join(/*turbopackIgnore: true*/ process.cwd(), "data");
}

export function getJsonStorePath(filename: string) {
  const override = getJsonStoreOverride();
  if (override) {
    return path.join(/*turbopackIgnore: true*/ override, filename);
  }

  const workerStoreName = getWorkerStoreName();
  if (workerStoreName) {
    return path.join(/*turbopackIgnore: true*/ process.cwd(), "data", workerStoreName, filename);
  }

  return path.join(/*turbopackIgnore: true*/ process.cwd(), "data", filename);
}
