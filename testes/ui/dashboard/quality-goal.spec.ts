import { test, expect } from "@playwright/test";
import { simularAutenticacao } from "../../../support/functions/ui/apoio/simular-autenticacao";
import { criarStatusMetaQualidade } from "../../../support/functions/banco-de-dados/geradores-dados/criar-dados-mttr-meta";
import { validarDashboardAtualPronto } from "../../../support/functions/ui/apoio/operar-dashboard-e-defeitos";

test("meta de qualidade mantém leitura executiva disponível", async ({ page, context }) => {
  await criarStatusMetaQualidade();
  await simularAutenticacao(context, {
    role: "company",
    companies: ["DEMO"],
    clientSlug: "DEMO",
  });

  await page.goto("/empresas/demo/dashboard", { waitUntil: "networkidle" });

  await validarDashboardAtualPronto(page);
  await expect(page.getByTestId("executive-stats").getByText(/Pass rate|Falhas|Defeitos/i).first()).toBeVisible();
});

