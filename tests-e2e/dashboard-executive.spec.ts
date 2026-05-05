import { test, expect } from "@playwright/test";
import { mockAuth } from "./helpers/mockAuth";
import { expectCurrentDashboardReady } from "./utils/current-ui";

test("company loads the current dashboard shell and key summary blocks", async ({ page, context }) => {
  await mockAuth(context, {
    role: "company",
    companies: ["DEMO"],
    clientSlug: "DEMO",
  });

  await page.goto("/empresas/demo/dashboard", {
    waitUntil: "domcontentloaded",
  });

  await expect(page).toHaveURL(/\/empresas\/demo\/dashboard/);
  await expect(page.getByText(/Dashboard Demo/i)).toBeVisible({ timeout: 30000 });
  await expectCurrentDashboardReady(page);
  await expect(page.getByRole("button", { name: /Exportar CSV/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Drilldown/i })).toBeVisible();
});
