import { test, expect } from "@playwright/test";
import { mockAuth } from "./helpers/mockAuth";
import { seedQualityGoalStatus } from "./utils/seed-mttr-goal";
import { expectCurrentDashboardReady } from "./utils/current-ui";

test("meta de qualidade mantém leitura executiva disponível", async ({ page, context }) => {
  await seedQualityGoalStatus();
  await mockAuth(context, {
    role: "company",
    companies: ["DEMO"],
    clientSlug: "DEMO",
  });

  await page.goto("/empresas/demo/dashboard", { waitUntil: "domcontentloaded" });

  await expectCurrentDashboardReady(page);
  await expect(page.getByTestId("executive-stats").getByText(/Pass rate|Falhas|Defeitos/i).first()).toBeVisible();
});
