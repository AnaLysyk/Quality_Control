import { test, expect } from "@playwright/test";
import { simularAutenticacao } from "../../../support/functions/ui/apoio/simular-autenticacao";
import { criarDefeitoManual } from "../../../support/functions/ui/apoio/operar-dashboard-e-defeitos";

const URL = "/empresas/demo/defeitos";

test("vincula defeito manual a uma run", async ({ page, context }) => {
  await simularAutenticacao(context, {
    role: "company",
    companies: ["DEMO"],
    clientSlug: "DEMO",
  });

  await page.goto(URL, { waitUntil: "domcontentloaded" });

  await criarDefeitoManual(page, "Defeito com run");
  await page.getByText("Defeito com run").first().click();

  const defect = page.locator('[data-testid^="defect-item-"]').first();

  await defect.getByTestId("defect-link-run").click();

  await page.getByTestId("defect-run-input").fill("run-001");
  await page.getByTestId("run-option-run-001").click();

  await page.getByTestId("defect-save").click();

  // garante persistÃƒÂªncia visual
  await expect(defect).toContainText("run-001");

  // reload prova persistÃƒÂªncia real
  await page.reload({ waitUntil: "networkidle" });

  const defectAfter = page.locator('[data-testid^="defect-item-"]').first();
  await expect(defectAfter).toContainText("run-001");
});

