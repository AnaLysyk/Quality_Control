import { defineConfig, devices } from "@playwright/test";
import { readFileSync } from "node:fs";

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3100";

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
  timeout: 60 * 1000,
  expect: { timeout: 5000 },
  retries: 0,
  reporter: "list",
  workers: 1,
  use: {
    baseURL,
    trace: "on-first-retry",
    headless: true,
  },
  webServer: useExistingServer
    ? undefined
    : {
      command: "npm run dev:ci",
        url: baseURL,
        reuseExistingServer: true,
        timeout: 300 * 1000,
        env: {
          ...dotenvEnv,
          PLAYWRIGHT_MOCK: "true",
          E2E_USE_JSON: envOverrides.E2E_USE_JSON,
          NODE_ENV: "test",
          JWT_SECRET: envOverrides.JWT_SECRET,
          PORT: "3100",
          HOSTNAME: "127.0.0.1",
          NEXT_PUBLIC_SITE_URL: baseURL,
          NEXT_PUBLIC_BASE_URL: baseURL,
        },
      },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
