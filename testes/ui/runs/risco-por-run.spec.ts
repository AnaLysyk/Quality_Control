import { test, expect } from "@playwright/test";
import { simularAutenticacao } from "../../../support/functions/ui/apoio/simular-autenticacao";
import { validarDashboardAtualPronto } from "../../../support/functions/ui/apoio/operar-dashboard-e-defeitos";

const DASHBOARD = "/empresas/demo/dashboard";

test("run falha aparece como risco no dashboard", async ({ page, context }) => {
  await simularAutenticacao(context, {
    role: "company",
    companies: ["DEMO"],
    clientSlug: "DEMO",
  });

  await page.goto(DASHBOARD, { waitUntil: "domcontentloaded" });

  await validarDashboardAtualPronto(page);
  await expect(page.getByTestId("executive-stats").getByText(/Risco|Falhas|Defeitos/i).first()).toBeVisible({ timeout: 10000 });
});
