import { defineConfig, devices } from "@playwright/test";
import { readFileSync } from "node:fs";

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";

function loadDotenv(path: string): Record<string, string> {
  try {
    const content = readFileSync(path, "utf8");
    return content.split(/\r?\n/).reduce<Record<string, string>>((acc, line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return acc;
      const [key, ...rest] = trimmed.split("=");
      if (!key) return acc;
      acc[key] = rest.join("=");
      return acc;
    }, {});
  } catch {
    return {};
  }
}

const dotenvEnv = loadDotenv(".env.local");
Object.assign(process.env, dotenvEnv);
const envOverrides = {
  PLAYWRIGHT_MOCK: "true",
  JWT_SECRET: "quality-control-e2e-secret",
  E2E_USE_JSON: process.env.E2E_USE_JSON || "1",
};
Object.assign(process.env, envOverrides);
const useExistingServer = process.env.PLAYWRIGHT_USE_EXISTING === "1" || process.env.PLAYWRIGHT_USE_EXISTING === "true";
export default defineConfig({
  testDir: "./tests-e2e",
  globalSetup: "./tests-e2e/global-setup.ts",
  timeout: 90 * 1000,
  expect: { timeout: 10000 },
  retries: 1,
  reporter: "list",
  workers: 1,
  use: {
    baseURL,
    trace: "on-first-retry",
    headless: true,
  },
  webServer: undefined, // Always use existing server at localhost:3000
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
