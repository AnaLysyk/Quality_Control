import { test, expect } from "@playwright/test";
import { simularAutenticacao } from "../../../tools/functions/ui/apoio/simular-autenticacao";
import { validarDashboardAtualPronto } from "../../../tools/functions/ui/apoio/operar-dashboard-e-defeitos";

test("release exibe quality score", async ({ page, context }) => {
  await simularAutenticacao(context, {
    role: "company",
    companies: ["DEMO"],
    clientSlug: "DEMO",
  });

  await page.goto("/empresas/demo/dashboard", { waitUntil: "networkidle" });

  await validarDashboardAtualPronto(page);
  await expect(page.getByText("Pass rate", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/\d{1,3}%/).first()).toBeVisible();
});

