import { readFile } from "node:fs/promises";
import { test, expect } from "@playwright/test";
import { simularAutenticacao } from "../../../support/functions/interface/apoio/simular-autenticacao";
import { validarDashboardAtualPronto } from "../../../support/functions/interface/apoio/operar-dashboard-e-defeitos";

test("company consegue exportar CSV de qualidade", async ({ page, context }) => {
  await simularAutenticacao(context, {
    role: "company",
    companies: ["DEMO"],
    clientSlug: "DEMO",
  });

  await page.goto("/empresas/demo/dashboard", {
    waitUntil: "networkidle",
  });
  await validarDashboardAtualPronto(page);

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByTestId("export-quality").click(),
  ]);

  expect(download.suggestedFilename()).toContain("quality");
  const downloadPath = await download.path();
  if (!downloadPath) {
    throw new Error("Download path unavailable");
  }
  const csv = await readFile(downloadPath, "utf8");
  expect(csv).toContain("company,period,quality_score");
  expect(csv).toContain("id,title,origin,status,opened_at");
});
