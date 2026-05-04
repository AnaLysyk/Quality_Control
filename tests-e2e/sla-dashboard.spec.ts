import { test, expect } from "@playwright/test";
import { mockAuth } from "./helpers/mockAuth";
import { expectCurrentDashboardReady } from "./utils/current-ui";

test("dashboard indica defeitos e sinais de SLA", async ({ page, context }) => {
  await mockAuth(context, {
    role: "company",
    companies: ["DEMO"],
    clientSlug: "DEMO",
  });

  await page.goto("/empresas/demo/dashboard", {
    waitUntil: "domcontentloaded",
  });

  await expectCurrentDashboardReady(page);
  await expect(page.getByText("Defeitos", { exact: true }).first()).toBeVisible({ timeout: 10000 });
});
