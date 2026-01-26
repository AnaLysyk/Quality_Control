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
  SUPABASE_MOCK: "true",
  NEXT_PUBLIC_SUPABASE_URL: "http://localhost",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key-test",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-test",
};
Object.assign(process.env, envOverrides);
export default defineConfig({
  testDir: "./tests-e2e",
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
  webServer: {
    command: "npm run build && npm run start",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 300 * 1000,
    env: {
      ...dotenvEnv,
      SUPABASE_MOCK: "true",
      NODE_ENV: "test",
      NEXT_PUBLIC_SUPABASE_URL: "http://localhost",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key-test",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-test",
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
