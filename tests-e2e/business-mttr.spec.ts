import { test, expect } from "@playwright/test";
import { mockAuth } from "./helpers/mockAuth";
import { createManualDefect } from "./utils/current-ui";

test("mttr aparece apos fechar defeito manual no modal", async ({ page, context }) => {
  await mockAuth(context, {
    role: "company",
    companies: ["DEMO"],
    clientSlug: "DEMO",
  });

  await page.goto("/empresas/demo/defeitos", { waitUntil: "domcontentloaded" });

  await createManualDefect(page, "Defeito MTTR");
  await page.getByText("Defeito MTTR").first().click();
  await expect(page.getByTestId("defect-modal")).toBeVisible();

  await page.getByTestId("defect-status").selectOption("done");
  await page.getByTestId("defect-save").click();

  const mttr = page.getByTestId("metric-mttr");
  await expect(mttr).toBeVisible();
  await expect(mttr).not.toHaveText("-");
});
