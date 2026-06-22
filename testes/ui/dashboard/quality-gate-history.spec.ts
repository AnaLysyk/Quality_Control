import { test, expect } from "@playwright/test";
import { simularAutenticacao } from "../../../support/functions/ui/apoio/simular-autenticacao";

test("histÃ³rico de quality gate Ã© registrado", async ({ page, context }) => {
  await simularAutenticacao(context, {
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

  await expect(page.getByTestId("run-timeline").or(page.getByTestId("quality-gate-history-list")).first()).toBeVisible();
});
