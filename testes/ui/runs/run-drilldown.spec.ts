import { test, expect } from "@playwright/test";
import { criarRunManualPorApi } from "../../../support/functions/api/runs/criar-run-manual";
import { validarDashboardAtualPronto } from "../../../support/functions/ui/apoio/operar-dashboard-e-defeitos";
import {
  autenticarPerfilRuns,
  EMPRESA_CLIENTE_E2E,
  rotaDashboardEmpresa,
} from "../../../support/functions/ui/runs/rotas-runs";

test.describe("drill-down de run", () => {
  test("exibe link da base detalhada para o detalhe da run", async ({ page, context }) => {
    await autenticarPerfilRuns(context, "admin");
    const { slug } = await criarRunManualPorApi(page.request, {
      titulo: "Run Drilldown Dashboard",
      pass: 85,
      fail: 10,
      blocked: 0,
      notRun: 5,
    });

    await page.goto(rotaDashboardEmpresa(), { waitUntil: "domcontentloaded" });
    await validarDashboardAtualPronto(page);

    await expect(page.getByRole("heading", { name: /Base detalhada/i })).toBeVisible({ timeout: 10000 });
    const runRow = page
      .getByRole("row")
      .filter({
        hasText: /Drilldown Dashboard/i,
        has: page.getByRole("link", { name: /Drilldown/i }),
      })
      .first();
    await expect(runRow).toBeVisible({ timeout: 10000 });
    const runLink = runRow.getByRole("link", { name: /Drilldown/i });
    await expect(runLink).toHaveAttribute("href", `/${EMPRESA_CLIENTE_E2E.slug}/runs/${slug}`);
  });
});
