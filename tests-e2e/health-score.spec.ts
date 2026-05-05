import { test, expect } from "@playwright/test";
import { mockAuth } from "./helpers/mockAuth";
import { expectCurrentDashboardReady } from "./utils/current-ui";

test("health score attention aparece no dashboard", async ({ page, context }) => {
  await mockAuth(context, {
    role: "company",
    companies: ["DEMO"],
    clientSlug: "DEMO",
  });

  await page.goto("/empresas/demo/dashboard", { waitUntil: "domcontentloaded" });

  await expectCurrentDashboardReady(page);
  await expect(page.getByText(/Risco elevado|Atenção|Estável|melhorou|piorou|ficou estável/i).first()).toBeVisible();
});
