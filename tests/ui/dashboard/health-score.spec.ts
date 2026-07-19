import { test, expect } from "@playwright/test";
import { simularAutenticacao } from "../../../tools/functions/ui/apoio/simular-autenticacao";
import { validarDashboardAtualPronto } from "../../../tools/functions/ui/apoio/operar-dashboard-e-defeitos";

test("health score attention aparece no dashboard", async ({ page, context }) => {
  await simularAutenticacao(context, {
    role: "company",
    companies: ["DEMO"],
    clientSlug: "DEMO",
  });

  await page.goto("/empresas/demo/dashboard", { waitUntil: "networkidle" });

  await validarDashboardAtualPronto(page);
  await expect(page.getByText(/Risco elevado|Atenção|Estável|melhorou|piorou|ficou estável/i).first()).toBeVisible();
});

