import { test, expect } from "@playwright/test";
import { simularAutenticacao } from "../../../support/functions/interface/apoio/simular-autenticacao";
import { criarDefeitoManual } from "../../../support/functions/interface/apoio/operar-dashboard-e-defeitos";

test("mttr aparece apos fechar defeito manual no modal", async ({ page, context }) => {
  await simularAutenticacao(context, {
    role: "company",
    companies: ["DEMO"],
    clientSlug: "DEMO",
  });

  await page.goto("/empresas/demo/defeitos", { waitUntil: "networkidle" });

  await criarDefeitoManual(page, "Defeito MTTR");
  await page.getByText("Defeito MTTR").first().click();
  await expect(page.getByTestId("defect-modal")).toBeVisible();

  await page.getByTestId("defect-status").selectOption("done");
  await page.getByTestId("defect-save").click();

  const mttr = page.getByTestId("metric-mttr");
  await expect(mttr).toBeVisible();
  await expect(mttr).not.toHaveText("-");

  const closedCount = page.getByTestId("metric-defects-closed");
  await expect(closedCount).toBeVisible();

  await page.goto("/empresas/demo/dashboard", { waitUntil: "networkidle" });
  const dashboardMttr = page.getByTestId("metric-mttr");
  await expect(dashboardMttr).toBeVisible();
  await expect(dashboardMttr).not.toHaveText("-");
});
