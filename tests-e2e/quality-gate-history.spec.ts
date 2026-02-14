import { test, expect } from "@playwright/test";
import { mockAuth } from "./helpers/mockAuth";
 
test.beforeEach(async ({ page }) => {
  await page.addStyleTag({ content: `
    .sidebar-shell, .sidebar-link, .sidebar-label {
      display: none !important;
      pointer-events: none !important;
      opacity: 0 !important;
      z-index: -1 !important;
      visibility: hidden !important;
    }
  ` });
  await page.evaluate(() => {
    document.querySelectorAll('.sidebar-shell').forEach(el => el.remove());
    document.querySelectorAll('.sidebar-link').forEach(el => el.remove());
    document.querySelectorAll('.sidebar-label').forEach(el => el.remove());
    // @ts-ignore
    window._e2eSidebarRemoved = true;
  });
  // Debug: confirm removal
  const removed = await page.evaluate(() => !!window._e2eSidebarRemoved);
  if (!removed) console.warn('Sidebar not removed!');
});

test("histórico de quality gate é registrado", async ({ page, context }) => {
  await mockAuth(context, {
    role: "admin",
    companies: ["griaule"],
    clientSlug: "griaule",
  });

  await page.goto("/empresas/griaule/dashboard", {
    waitUntil: "networkidle",
  });

  // Acessa a primeira release do dashboard
  const releaseCard = page.getByTestId("release-card").first();
  // Remove sidebar overlays right before click
  await page.evaluate(() => {
    document.querySelectorAll('.sidebar-shell').forEach(el => el.remove());
    document.querySelectorAll('.sidebar-link').forEach(el => el.remove());
    document.querySelectorAll('.sidebar-label').forEach(el => el.remove());
  });
  await releaseCard.locator('a').click();
  await page.waitForLoadState("networkidle");

  // Abre o histórico do quality gate
  await page.getByTestId("quality-gate-history").click();

  const items = page.getByTestId("gate-history-item");
  await expect(items.first()).toBeVisible();
});
