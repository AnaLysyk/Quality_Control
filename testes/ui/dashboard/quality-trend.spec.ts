import { test, expect } from "@playwright/test";
import { simularAutenticacao } from "../../../support/functions/interface/apoio/simular-autenticacao";
import { validarDashboardAtualPronto } from "../../../support/functions/interface/apoio/operar-dashboard-e-defeitos";

test("tendÃªncia improving aparece no dashboard", async ({ page, context }) => {
  await simularAutenticacao(context, {
    role: "company",
    companies: ["DEMO"],
    clientSlug: "DEMO",
  });

  await page.goto("/empresas/demo/dashboard", { waitUntil: "networkidle" });

  await validarDashboardAtualPronto(page);
  await expect(page.getByText(/Risco elevado|qualidade melhorou|qualidade piorou|qualidade ficou estável/i).first()).toBeVisible();
});
