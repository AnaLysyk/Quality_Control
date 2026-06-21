import { test, expect } from "@playwright/test";
import { simularAutenticacao } from "../../../support/functions/ui/apoio/simular-autenticacao";
import { criarDefeitoManual } from "../../../support/functions/ui/apoio/operar-dashboard-e-defeitos";

const DEFECTS_URL = "/empresas/demo/defeitos";

test("MTTR Ã© calculado ao fechar defeito manual", async ({ page, context }) => {
  await simularAutenticacao(context, {
    role: "company",
    companies: ["DEMO"],
    clientSlug: "DEMO",
  });
  await page.goto(DEFECTS_URL, { waitUntil: "domcontentloaded" });

  await criarDefeitoManual(page, "Defeito MTTR manual");
  await page.getByText("Defeito MTTR manual").first().click();
  await expect(page.getByTestId("defect-modal")).toBeVisible();

  await page.getByTestId("defect-status").selectOption("done");
  await page.getByTestId("defect-save").click();
  // MTTR aparece
  const mttr = page.getByTestId("defect-mttr");
  await expect(mttr).not.toHaveText("â€”");
  // reload nÃ£o perde MTTR
  await page.reload();
  await expect(mttr).not.toHaveText("â€”");
});
