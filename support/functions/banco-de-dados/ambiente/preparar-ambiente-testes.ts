import { execSync } from "node:child_process";

async function warmupApp() {
  const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3100";
  const warmups = [
    "/admin/clients",
    "/admin/access-requests",
    "/admin/users",
    "/api/health",
    "/api/support/access-request",
    "/api/admin/access-requests",
    "/api/admin/users",
    "/api/auth/login",
  ];

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4 * 60 * 1000);

    for (const path of warmups) {
      const url = `${baseURL}${path}`;
      try {
        const res = await fetch(url, {
          method: "GET",
          signal: controller.signal,
          headers: { "cache-control": "no-store" },
        });
        console.log(`[e2e] warmup ${path} -> ${res.status}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[e2e] warmup ${path} failed: ${msg}`);
      }
    }

    clearTimeout(timeout);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[e2e] warmup skipped: ${msg}`);
  }
}

export default async function globalSetup() {
  const useJson =
    process.env.E2E_USE_JSON === "1" ||
    process.env.E2E_USE_JSON === "true";

  const skipDbSetup =
    process.env.SKIP_DB_SETUP === "1" ||
    process.env.SKIP_DB_SETUP === "true";

  if (useJson) {
    console.log("[e2e] JSON mode enabled: skipping prisma db push and seed.");
    await warmupApp();
    return;
  }

  if (skipDbSetup) {
    console.log("[e2e] SKIP_DB_SETUP enabled: using database mode without prisma db push and seed.");
    await warmupApp();
    return;
  }

  execSync("npx prisma db push", { stdio: "inherit" });
  execSync("npm run seed:all", { stdio: "inherit" });
}
