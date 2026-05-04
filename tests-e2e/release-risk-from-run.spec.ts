import { test, expect } from "@playwright/test";
import { mockAuth } from "./helpers/mockAuth";
import { expectCurrentDashboardReady } from "./utils/current-ui";

const DASHBOARD = "/empresas/demo/dashboard";

test("run falha aparece como risco no dashboard", async ({ page, context }) => {
  await mockAuth(context, {
    role: "company",
    companies: ["DEMO"],
    clientSlug: "DEMO",
  });

  await page.goto(DASHBOARD, { waitUntil: "domcontentloaded" });

  await expectCurrentDashboardReady(page);
  await expect(page.getByText(/Risco|Falhas|Defeitos/i).first()).toBeVisible({ timeout: 10000 });
});
