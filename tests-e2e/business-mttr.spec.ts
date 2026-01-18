import { test, expect } from "@playwright/test";
import { mockAuth } from "./helpers/mockAuth";

test("mttr aparece apos fechar defeito manual no modal", async ({ page, context }) => {
  await mockAuth(context, {
    role: "company",
    companies: ["griaule"],
    clientSlug: "griaule",
  });

  await page.goto("/empresas/griaule/defeitos", { waitUntil: "networkidle" });

  await page.getByTestId("defect-title").fill("Defeito MTTR");
  await page.getByTestId("defect-create").click();

  const editButton = page.getByTestId("defect-edit").first();
  await expect(editButton).toBeVisible();
  await editButton.click();

  await page.getByTestId("defect-status").selectOption("done");
  await page.getByTestId("defect-save").click();

  const mttr = page.getByTestId("metric-mttr");
  await expect(mttr).toBeVisible();
  await expect(mttr).not.toHaveText("-");

  const closedCount = page.getByTestId("metric-defects-closed");
  await expect(closedCount).toBeVisible();

  await page.goto("/empresas/griaule/dashboard", { waitUntil: "networkidle" });
  const dashboardMttr = page.getByTestId("metric-mttr");
  await expect(dashboardMttr).toBeVisible();
  await expect(dashboardMttr).not.toHaveText("-");
});
