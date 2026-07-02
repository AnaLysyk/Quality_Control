import { test, expect } from "@playwright/test";
import { simularAutenticacao } from "../../../support/functions/ui/apoio/simular-autenticacao";
import { criarDadosDashboardMttr } from "../../../support/functions/banco-de-dados/geradores-dados/criar-dados-mttr-meta";
import { validarDashboardAtualPronto } from "../../../support/functions/ui/apoio/operar-dashboard-e-defeitos";

test("dashboard exibe MTTR mÃƒÂ©dio", async ({ page, context }) => {
  await simularAutenticacao(context, {
    role: "company",
    companies: ["DEMO"],
    clientSlug: "DEMO",
  });
  await criarDadosDashboardMttr();
  await page.goto("/empresas/demo/dashboard", {
    waitUntil: "networkidle",
  });
  // Aguarda o seed refletir e a pÃƒÂ¡gina estabilizar
  await page.waitForTimeout(500);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="mttr-card"]', { timeout: 10000 });
  const card = page.getByTestId("mttr-card");
  await expect(card).toBeVisible();
  await expect(card).not.toHaveText("Ã¢â‚¬â€");
});

