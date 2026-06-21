import { test, expect } from "@playwright/test";
import { env } from "node:process";

const email = env.PLAYWRIGHT_EMAIL || "";
const password = env.PLAYWRIGHT_PASSWORD || "";

test.describe("Prod smoke", () => {
  test("login and dashboard loads", async ({ page }) => {
    test.skip(!email || !password, "PLAYWRIGHT_EMAIL/PASSWORD not set");

    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Senha").fill(password);
    await page.getByRole("button", { name: /entrar/i }).click();

    await page.waitForURL(/\/dashboard/, { timeout: 60000 });
    await expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible();
    await expect(page.locator("text=Modo mock")).toHaveCount(0);
  });
});
