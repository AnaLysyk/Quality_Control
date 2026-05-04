import { test, expect } from "@playwright/test";
import { mockAuth } from "./helpers/mockAuth";

test("mobile menu opens on small viewport", async ({ page, context }) => {
  await mockAuth(context, {
    role: "admin",
    companies: ["DEMO"],
    clientSlug: "DEMO",
  });
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/admin/dashboard", { waitUntil: "domcontentloaded" });

  const btn = page
    .locator('button[aria-label="Abrir menu"]')
    .or(page.locator('button[aria-label="Open menu"]'));
  await expect(btn.first()).toBeVisible();
  await btn.first().click();

  await expect(page.locator("#app-shell-mobile-sidebar")).toBeVisible({ timeout: 2000 });
});
