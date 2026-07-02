import { test, expect } from "@playwright/test";
import { criarRunManualPorApi } from "../../../support/functions/api/runs/criar-run-manual";
import { validarDashboardAtualPronto } from "../../../support/functions/ui/apoio/operar-dashboard-e-defeitos";
import { autenticarPerfilRuns, rotaDashboardEmpresa } from "../../../support/functions/ui/runs/rotas-runs";

test("run falha aparece como risco no dashboard", async ({ page, context }) => {
  await autenticarPerfilRuns(context, "empresa");
  await criarRunManualPorApi(page.request, {
    titulo: "Run Risco Dashboard",
    pass: 10,
    fail: 70,
    blocked: 10,
    notRun: 10,
  });

  await page.goto(rotaDashboardEmpresa(), { waitUntil: "domcontentloaded" });

  await validarDashboardAtualPronto(page);
  await expect(page.getByText(/Risco Dashboard/i).first()).toBeVisible({ timeout: 10000 });
  await expect(page.getByText(/Cr.tico|Falhas|Defeitos/i).first()).toBeVisible({ timeout: 10000 });
});

