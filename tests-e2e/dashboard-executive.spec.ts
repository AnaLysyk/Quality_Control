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
    waitUntil: "networkidle",
  });

  await expect(page).toHaveURL(/\/empresas\/demo\/dashboard/);
  await expect(page.getByRole("heading", { name: /demo/i })).toBeVisible({ timeout: 30000 });
  await expect(page.getByText("Runs totais", { exact: true })).toBeVisible({ timeout: 30000 });
  await expect(page.getByText("Concluidas", { exact: true })).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole("link", { name: /Ver lista completa/i })).toBeVisible({ timeout: 30000 });
});


