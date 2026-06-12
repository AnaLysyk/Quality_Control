import { test, expect } from "@playwright/test";
import { simularAutenticacao } from "../../../support/functions/interface/apoio/simular-autenticacao";
import { validarDashboardAtualPronto } from "../../../support/functions/interface/apoio/operar-dashboard-e-defeitos";

test("dashboard mostra qualidade por run", async ({ page, context }) => {
  await simularAutenticacao(context, {
    role: "admin",
    companies: ["DEMO"],
    clientSlug: "DEMO",
  });

  await page.goto("/empresas/demo/dashboard", {
    waitUntil: "networkidle",
  });

  await validarDashboardAtualPronto(page);
  await page.getByRole("button", { name: /Comparativos/i }).click();
  await expect(page.getByText(/Runs com mais impacto|Sem comparativos para exibir/i)).toBeVisible({ timeout: 10000 });
});
