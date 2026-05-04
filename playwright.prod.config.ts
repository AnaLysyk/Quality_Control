import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "https://quality-control-qwqs.onrender.com";

export default defineConfig({
  testDir: "./tests-e2e",
  timeout: 90 * 1000,
  expect: { timeout: 10000 },
  retries: 0,
  reporter: "list",
  workers: 1,
  use: {
    baseURL,
    trace: "on-first-retry",
    headless: true,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
