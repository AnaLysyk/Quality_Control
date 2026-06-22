import { test, expect } from "@playwright/test";
import { criarRunManualPorApi } from "../../../support/functions/api/runs/criar-run-manual";
import { validarDashboardAtualPronto } from "../../../support/functions/ui/apoio/operar-dashboard-e-defeitos";
import { autenticarPerfilRuns, rotaDashboardEmpresa } from "../../../support/functions/ui/runs/rotas-runs";

test("dashboard mostra qualidade por run", async ({ page, context }) => {
  await autenticarPerfilRuns(context, "admin");
  await criarRunManualPorApi(page.request, {
    titulo: "Run Qualidade Dashboard",
    pass: 90,
    fail: 5,
    blocked: 0,
    notRun: 5,
  });

  await page.goto(rotaDashboardEmpresa(), {
    waitUntil: "domcontentloaded",
  });

  await validarDashboardAtualPronto(page);
  await expect(page.getByRole("heading", { name: /Runs com mais impacto/i })).toBeVisible({ timeout: 10000 });
  await expect(page.getByText(/Qualidade Dashboard/i).first()).toBeVisible({ timeout: 10000 });
});
