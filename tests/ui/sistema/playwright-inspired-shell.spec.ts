import { test, expect } from "@playwright/test";
import { simularAutenticacao } from "../../../tools/functions/ui/apoio/simular-autenticacao";

test.describe("Playwright-inspired shell", () => {
  test("desktop sidebar is clean, searchable and ready for local validation", async ({ page, context }) => {
    await simularAutenticacao(context, {
      role: "admin",
      companies: ["quality-control"],
      clientSlug: "quality-control",
    });

    await page.setViewportSize({ width: 1366, height: 820 });
    await page.goto("/admin/dashboard", { waitUntil: "domcontentloaded" });

    const shell = page.getByTestId("sidebar-docs-shell");
    await expect(shell).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId("sidebar-nav-search")).toBeVisible();

    const backgroundColor = await shell.evaluate((element) => getComputedStyle(element).backgroundColor);
    expect(backgroundColor).toMatch(/rgb\(255, 255, 255\)|rgba\(255, 255, 255/);

    await page.getByTestId("sidebar-nav-search").fill("Brain");
    await expect(page.getByTestId("nav-brain")).toBeVisible();
    await expect(page.getByTestId("nav-automation")).toHaveCount(0);
  });

  test("mobile menu keeps the clean shell available", async ({ page, context }) => {
    await simularAutenticacao(context, {
      role: "admin",
      companies: ["quality-control"],
      clientSlug: "quality-control",
    });

    await page.setViewportSize({ width: 390, height: 820 });
    await page.goto("/admin/dashboard", { waitUntil: "domcontentloaded" });

    const menuButton = page.locator('button[aria-label="Abrir menu"], button[aria-label="Open menu"]').first();
    await expect(menuButton).toBeVisible({ timeout: 10000 });
    await menuButton.click();

    await expect(page.locator("#app-shell-mobile-sidebar")).toBeVisible({ timeout: 8000 });
    await expect(page.getByTestId("sidebar-docs-shell")).toBeVisible();
  });
});

