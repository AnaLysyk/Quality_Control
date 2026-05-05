import { test, expect } from "@playwright/test";
import { mockAuth } from "./helpers/mockAuth";
import { createManualDefect } from "./utils/current-ui";

function slugify(value: string) {
  return value
    .replace(/^run\s+/i, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_{2,}/g, "_");
}

test.setTimeout(120000);

test("empresa cria run e defeito com vinculo basico", async ({ page, context }) => {
  await mockAuth(context, {
    role: "company",
    companies: ["DEMO"],
    clientSlug: "DEMO",
  });

  const runTitle = "Run E2E Negocio";
  const runSlug = slugify(runTitle);
  const defectTitle = "Defeito encontrado na run";

  await page.goto("/empresas/demo/runs", { waitUntil: "domcontentloaded" });

  await page.getByTestId("run-create").click();
  await page.getByTestId("run-title").fill(runTitle);
  await page.getByTestId("run-submit").click();

  await page.waitForURL(new RegExp(`/empresas/demo/runs/${runSlug}`), { timeout: 60000 });
  await expect(page.getByText(/E2E Negocio/i)).toBeVisible();

  await page.goto("/empresas/demo/defeitos", { waitUntil: "domcontentloaded" });
  await createManualDefect(page, defectTitle, { runSlug });

  await expect(page.getByText(defectTitle).first()).toBeVisible({ timeout: 10000 });

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByText(defectTitle).first()).toBeVisible({ timeout: 30000 });
});
