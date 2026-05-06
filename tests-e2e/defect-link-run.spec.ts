import { test, expect } from "@playwright/test";
import { mockAuth } from "./helpers/mockAuth";
import { createManualDefect } from "./utils/current-ui";

const URL = "/empresas/demo/defeitos";

test("vincula defeito manual a uma run", async ({ page, context }) => {
  await mockAuth(context, {
    role: "company",
    companies: ["DEMO"],
    clientSlug: "DEMO",
  });

  await page.goto(URL, { waitUntil: "domcontentloaded" });

  await createManualDefect(page, "Defeito com run");
  await page.getByText("Defeito com run").first().click();

  const defect = page.locator('[data-testid^="defect-item-"]').first();

  await defect.getByTestId("defect-link-run").click();

  await page.getByTestId("defect-run-input").fill("run-001");
  await page.getByTestId("run-option-run-001").click();

  await page.getByTestId("defect-save").click();

  // garante persistÃªncia visual
  await expect(defect).toContainText("run-001");

  // reload prova persistÃªncia real
  await page.reload({ waitUntil: "networkidle" });

  const defectAfter = page.locator('[data-testid^="defect-item-"]').first();
  await expect(defectAfter).toContainText("run-001");
});

