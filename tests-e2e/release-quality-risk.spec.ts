import { test, expect } from "@playwright/test";
import { mockAuth } from "./helpers/mockAuth";
import { expectCurrentDashboardReady } from "./utils/current-ui";

test.setTimeout(120000);

test("release com risco aparece na leitura executiva", async ({ page, context }) => {
  await mockAuth(context, {
    role: "company",
    companies: ["DEMO"],
    clientSlug: "DEMO",
  });

  await page.goto("/empresas/demo/dashboard", { waitUntil: "domcontentloaded" });
  await expectCurrentDashboardReady(page);
  await expect(page.getByText(/Risco|Crítico|Atenção/i).first()).toBeVisible({ timeout: 20000 });
});
