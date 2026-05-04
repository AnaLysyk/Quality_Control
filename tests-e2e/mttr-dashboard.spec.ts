import { test, expect } from "@playwright/test";
import { mockAuth } from "./helpers/mockAuth";
import { seedMTTRDashboard } from "./utils/seed-mttr-goal";
import { expectCurrentDashboardReady } from "./utils/current-ui";

test("dashboard exibe resumo de defeitos e qualidade", async ({ page, context }) => {
  await mockAuth(context, {
    role: "company",
    companies: ["DEMO"],
    clientSlug: "DEMO",
  });
  await seedMTTRDashboard();
  await page.goto("/empresas/demo/dashboard", {
    waitUntil: "domcontentloaded",
  });

  await expectCurrentDashboardReady(page);
  await expect(page.getByText("Defeitos", { exact: true }).first()).toBeVisible({ timeout: 10000 });
});
