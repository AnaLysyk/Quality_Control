import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "https://quality-control-qwqs.onrender.com";

export default defineConfig({
  testDir: "./testes",
  timeout: 90 * 1000,
  expect: { timeout: 10000 },
  retries: 0,
  reporter: [
    ["list"],
    ["html", { open: "always" }],
  ],
  workers: 1,
  use: {
    baseURL,
    trace: "on-first-retry",
    headless: process.env.CI ? true : false,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});

