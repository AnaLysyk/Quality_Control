import { test, expect } from "@playwright/test";
import { mockAuth } from "./helpers/mockAuth";

test("histÃ³rico de quality gate Ã© registrado", async ({ page, context }) => {
  await mockAuth(context, {
    role: "admin",
    companies: ["DEMO"],
    clientSlug: "DEMO",
  });

  await page.goto("/empresas/demo/dashboard", {
    waitUntil: "networkidle",
  });

  // Acessa a primeira release do dashboard
  const releaseCard = page.getByTestId("release-card").first();
  await releaseCard.locator('a').click();
  await page.waitForLoadState("networkidle");

  // Abre o histÃ³rico do quality gate
  await page.getByTestId("quality-gate-history").click();

  const items = page.getByTestId("gate-history-item");
  await expect(items.first()).toBeVisible();
});

