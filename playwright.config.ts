import { defineConfig } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createQualityProjects } from "./playwright.projects";

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3100";

function isTruthy(value?: string | null) {
  return value === "1" || value?.toLowerCase() === "true" || value?.toLowerCase() === "yes";
}

function isFalsey(value?: string | null) {
  return value === "0" || value?.toLowerCase() === "false" || value?.toLowerCase() === "no";
}

function numberFromEnv(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

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
  AUTH_STORE: "json",
  E2E_ADMIN_PASSWORD: process.env.E2E_ADMIN_PASSWORD || "Griaule@123",
  E2E_COMPANY_PASSWORD: process.env.E2E_COMPANY_PASSWORD || "Griaule@123",
  E2E_NO_COMPANY_PASSWORD: process.env.E2E_NO_COMPANY_PASSWORD || "Griaule@123",
  E2E_USER_PASSWORD: process.env.E2E_USER_PASSWORD || "Griaule@123",
  PLAYWRIGHT_MOCK: "true",
  PLAYWRIGHT_INTERNAL_PLAN_ID: process.env.PLAYWRIGHT_INTERNAL_PLAN_ID || "plan_tc_auto_playwright",
  PLAYWRIGHT_INTERNAL_PLAN_NAME:
    process.env.PLAYWRIGHT_INTERNAL_PLAN_NAME || "Testing Company - Regressão automatizada Playwright",
  PLAYWRIGHT_INTERNAL_RUN_APP: process.env.PLAYWRIGHT_INTERNAL_RUN_APP || "automation-workspace",
  PLAYWRIGHT_INTERNAL_RUN_COMPANY: process.env.PLAYWRIGHT_INTERNAL_RUN_COMPANY || "testing-company",
  PLAYWRIGHT_INTERNAL_RUN_SYNC: process.env.PLAYWRIGHT_INTERNAL_RUN_SYNC || "true",
  JWT_SECRET: "quality-control-e2e-secret",
  NEXT_DIST_DIR: process.env.NEXT_DIST_DIR || ".next-e2e",
  E2E_USE_JSON: process.env.E2E_USE_JSON || "1",
};
Object.assign(process.env, envOverrides);
const useExistingServer = process.env.PLAYWRIGHT_USE_EXISTING === "1" || process.env.PLAYWRIGHT_USE_EXISTING === "true";
const headed = isTruthy(process.env.PLAYWRIGHT_HEADED) || isFalsey(process.env.PLAYWRIGHT_HEADLESS);
const browserChannel = process.env.PLAYWRIGHT_CHANNEL?.trim();
const slowMo = numberFromEnv(process.env.PLAYWRIGHT_SLOW_MO, headed ? 150 : 0);
const traceMode =
  (process.env.PLAYWRIGHT_TRACE as "off" | "on" | "retain-on-failure" | "on-first-retry" | undefined) ??
  "on-first-retry";
const videoMode =
  (process.env.PLAYWRIGHT_VIDEO as "off" | "on" | "retain-on-failure" | "on-first-retry" | undefined) ??
  "retain-on-failure";
const screenshotMode =
  (process.env.PLAYWRIGHT_SCREENSHOT as "off" | "on" | "only-on-failure" | undefined) ??
  "only-on-failure";

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
    trace: traceMode,
    video: videoMode,
    screenshot: screenshotMode,
    headless: !headed,
    ...(slowMo > 0 ? { launchOptions: { slowMo } } : {}),
  },
  webServer: useExistingServer
    ? undefined
    : {
      command: "npm run dev",
        url: baseURL,
        reuseExistingServer: true,
        timeout: 300 * 1000,
        env: {
          ...dotenvEnv,
          AUTH_STORE: envOverrides.AUTH_STORE,
          E2E_ADMIN_PASSWORD: envOverrides.E2E_ADMIN_PASSWORD,
          E2E_COMPANY_PASSWORD: envOverrides.E2E_COMPANY_PASSWORD,
          E2E_NO_COMPANY_PASSWORD: envOverrides.E2E_NO_COMPANY_PASSWORD,
          E2E_USER_PASSWORD: envOverrides.E2E_USER_PASSWORD,
          PLAYWRIGHT_MOCK: "true",
          PLAYWRIGHT_INTERNAL_PLAN_ID: envOverrides.PLAYWRIGHT_INTERNAL_PLAN_ID,
          PLAYWRIGHT_INTERNAL_PLAN_NAME: envOverrides.PLAYWRIGHT_INTERNAL_PLAN_NAME,
          PLAYWRIGHT_INTERNAL_RUN_APP: envOverrides.PLAYWRIGHT_INTERNAL_RUN_APP,
          PLAYWRIGHT_INTERNAL_RUN_COMPANY: envOverrides.PLAYWRIGHT_INTERNAL_RUN_COMPANY,
          PLAYWRIGHT_INTERNAL_RUN_SYNC: envOverrides.PLAYWRIGHT_INTERNAL_RUN_SYNC,
          E2E_USE_JSON: envOverrides.E2E_USE_JSON,
          NODE_ENV: "test",
          JWT_SECRET: envOverrides.JWT_SECRET,
          NEXT_DIST_DIR: envOverrides.NEXT_DIST_DIR,
          PORT: "3100",
          HOSTNAME: "127.0.0.1",
          NEXT_PUBLIC_SITE_URL: baseURL,
          NEXT_PUBLIC_BASE_URL: baseURL,
        },
      },
  projects: createQualityProjects(browserChannel),
});
