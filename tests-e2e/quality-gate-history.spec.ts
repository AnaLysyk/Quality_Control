import { test, expect } from "@playwright/test";
import { mockAuth } from "./helpers/mockAuth";

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
  await releaseCard.locator('a').click();
  await page.waitForLoadState("networkidle");

  // Abre o histórico do quality gate
  await page.getByTestId("quality-gate-history").click();

  const items = page.getByTestId("gate-history-item");
  await expect(items.first()).toBeVisible();
});
