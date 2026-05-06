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

  // Wait for React hydration: the button must have a __reactFiber key before clicking
  await page.waitForFunction(() => {
    const b = document.querySelector('button[aria-label="Open menu"], button[aria-label="Abrir menu"]');
    return !!b && !!Object.keys(b).find(k => k.startsWith("__reactFiber") || k.startsWith("__reactProps"));
  }, { timeout: 15000 });

  await btn.first().click();

  await expect(page.locator("#app-shell-mobile-sidebar")).toBeVisible({ timeout: 8000 });
});
