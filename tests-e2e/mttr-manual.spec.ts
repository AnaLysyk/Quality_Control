import { test, expect } from "@playwright/test";
import { mockAuth } from "./helpers/mockAuth";
import { createManualDefect } from "./utils/current-ui";

const DEFECTS_URL = "/empresas/demo/defeitos";

test("MTTR e calculado ao fechar defeito manual", async ({ page, context }) => {
  await mockAuth(context, {
    role: "company",
    companies: ["DEMO"],
    clientSlug: "DEMO",
  });
  await page.goto(DEFECTS_URL, { waitUntil: "domcontentloaded" });

  await createManualDefect(page, "Defeito MTTR manual");
  await page.getByText("Defeito MTTR manual").first().click();
  await expect(page.getByTestId("defect-modal")).toBeVisible();

  await page.getByTestId("defect-status").selectOption("done");
  await page.getByTestId("defect-save").click();

  await expect(page.getByTestId("metric-mttr")).not.toHaveText("-");
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("metric-mttr")).not.toHaveText("-");
});
