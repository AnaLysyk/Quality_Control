import { test, expect } from "@playwright/test";
import { mockAuth } from "./helpers/mockAuth";
import { expectCurrentDashboardReady } from "./utils/current-ui";

test("tendencia aparece no dashboard", async ({ page, context }) => {
  await mockAuth(context, {
    role: "company",
    companies: ["DEMO"],
    clientSlug: "DEMO",
  });

  await page.goto("/empresas/demo/dashboard", { waitUntil: "domcontentloaded" });

  await expectCurrentDashboardReady(page);
  await expect(page.getByText(/Risco elevado|qualidade melhorou|qualidade piorou|qualidade ficou estável/i).first()).toBeVisible();
});
