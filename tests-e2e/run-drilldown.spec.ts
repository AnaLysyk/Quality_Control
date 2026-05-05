import { test, expect } from "@playwright/test";
import { mockAuth } from "./utils/mockAuth";
import { expectCurrentDashboardReady } from "./utils/current-ui";

test.describe("Drill-down de Run", () => {
  test("navega da base detalhada para a run", async ({ page, context }) => {
    await mockAuth(context, {
      role: "admin",
      companies: ["demo"],
      clientSlug: "DEMO",
    });

    await page.goto("/empresas/demo/dashboard", { waitUntil: "domcontentloaded" });
    await expectCurrentDashboardReady(page);

    await page.getByRole("button", { name: /Drilldown/i }).click();

    const drilldownLink = page.getByRole("link", { name: /Drilldown/i }).first();
    if (await drilldownLink.isVisible().catch(() => false)) {
      await drilldownLink.click();
      await expect(page).toHaveURL(/\/(empresas\/[^/]+\/runs|runs|release)\//, { timeout: 10000 });
    } else {
      await expect(page.getByText(/Sem linhas detalhadas|Nenhuma linha disponível/i)).toBeVisible();
    }
  });
});
