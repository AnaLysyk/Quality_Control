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

  await expect(page.getByTestId("defect-modal")).toBeVisible();
  await expect(page.getByRole("button", { name: /Selecionar run vinculada/i })).toBeVisible();
});
