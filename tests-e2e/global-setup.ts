import { execSync } from "node:child_process";

export default async function globalSetup() {
  const useJson =
    process.env.E2E_USE_JSON === "1" ||
    process.env.E2E_USE_JSON === "true" ||
    process.env.SKIP_DB_SETUP === "1" ||
    process.env.SKIP_DB_SETUP === "true";

  if (useJson) {
    console.log("[e2e] JSON mode enabled: skipping prisma db push and seed.");
    return;
  }

  execSync("npx prisma db push", { stdio: "inherit" });
  execSync("npm run seed:all", { stdio: "inherit" });
}
