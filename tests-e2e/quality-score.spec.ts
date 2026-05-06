import { test, expect } from "@playwright/test";
import { mockAuth } from "./helpers/mockAuth";
import { expectCurrentDashboardReady } from "./utils/current-ui";

test("release exibe quality score", async ({ page, context }) => {
  await mockAuth(context, {
    role: "company",
    companies: ["DEMO"],
    clientSlug: "DEMO",
  });

  await page.goto("/empresas/demo/dashboard", { waitUntil: "networkidle" });

  await expectCurrentDashboardReady(page);
  await expect(page.getByText("Pass rate", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/\d{1,3}%/).first()).toBeVisible();
});

