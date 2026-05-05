import { test, expect } from "@playwright/test";
import { mockAuth } from "./helpers/mockAuth";
import { expectCurrentDashboardReady } from "./utils/current-ui";

test("dashboard mostra tendencia de qualidade", async ({ page, context }) => {
  await mockAuth(context, {
    role: "company",
    companies: ["DEMO"],
    clientSlug: "DEMO",
  });

  await page.goto("/empresas/demo/dashboard", {
    waitUntil: "domcontentloaded",
  });

  await expectCurrentDashboardReady(page);
  await expect(page.getByText(/Tendência|Risco elevado|qualidade/i).first()).toBeVisible({ timeout: 10000 });
});
