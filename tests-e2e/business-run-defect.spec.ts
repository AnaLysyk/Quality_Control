import { test, expect } from "@playwright/test";
import { mockAuth } from "./helpers/mockAuth";

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_{2,}/g, "_");
}

test("empresa cria run e defeito com vinculo basico", async ({ page, context }) => {
  await mockAuth(context, {
    role: "company",
    companies: ["griaule"],
    clientSlug: "griaule",
  });

  const runTitle = "Run E2E Negocio";
  const runSlug = slugify(runTitle);
  const defectTitle = "Defeito encontrado na run";

  await page.goto("/empresas/griaule/runs", { waitUntil: "networkidle" });

  await page.getByTestId("run-create").click();
  await page.getByTestId("run-title").fill(runTitle);
  await page.getByTestId("run-submit").click();

  await page.waitForURL(new RegExp(`/empresas/griaule/runs/${runSlug}`));
  await expect(page.getByText(runTitle)).toBeVisible();

  await page.goto("/empresas/griaule/defeitos", { waitUntil: "domcontentloaded" });

  await page.getByTestId("defect-title").fill(defectTitle);
  await page.getByTestId("defect-run-select").fill(runSlug);
  await page.getByTestId("defect-create").click();

  const defectItem = page.getByTestId(`defect-item-manual-${runSlug}`);
  await expect(defectItem).toBeVisible();
  await expect(defectItem).toContainText(defectTitle);
  await expect(defectItem).toContainText(runSlug);

  await page.reload();
  await expect(defectItem).toBeVisible();
});
