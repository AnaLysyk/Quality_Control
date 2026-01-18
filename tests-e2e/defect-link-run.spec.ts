import { test, expect } from "@playwright/test";
import { mockAuth } from "./helpers/mockAuth";

const URL = "/empresas/griaule/defeitos";

test("vincula defeito manual a uma run", async ({ page, context }) => {
  await mockAuth(context, {
    role: "company",
    companies: ["griaule"],
    clientSlug: "griaule",
  });

  await page.goto(URL, { waitUntil: "networkidle" });

  // cria defeito manual
  await page.getByTestId("defect-title").fill("Defeito com run");
  await page.getByTestId("defect-create").click();

  const defect = page.locator('[data-testid^="defect-item-"]').first();

  await defect.getByTestId("defect-link-run").click();

  await page.getByTestId("defect-run-input").fill("run-001");
  await page.getByTestId("run-option-run-001").click();

  await page.getByTestId("defect-save").click();

  // garante persistência visual
  await expect(defect).toContainText("run-001");

  // reload prova persistência real
  await page.reload({ waitUntil: "networkidle" });

  const defectAfter = page.locator('[data-testid^="defect-item-"]').first();
  await expect(defectAfter).toContainText("run-001");
});
