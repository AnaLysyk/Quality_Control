import { test, expect } from "@playwright/test";
import { simularAutenticacao } from "../../../support/functions/interface/apoio/simular-autenticacao";
import { validarDashboardAtualPronto } from "../../../support/functions/interface/apoio/operar-dashboard-e-defeitos";

test.setTimeout(120000);

test("release com risco aparece na leitura executiva", async ({ page, context }) => {
  await simularAutenticacao(context, {
    role: "company",
    companies: ["DEMO"],
    clientSlug: "DEMO",
  });

  await page.goto("/empresas/demo/dashboard", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(500);
  await expect(page.getByTestId("release-quality-risk")).toBeVisible({ timeout: 20000 });
});
