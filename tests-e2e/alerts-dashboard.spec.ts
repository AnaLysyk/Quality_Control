import { test, expect } from "@playwright/test";
import { mockAuth } from "./helpers/mockAuth";
import { expectCurrentDashboardReady } from "./utils/current-ui";

test("dashboard mostra leitura executiva e alertas quando existem", async ({ page, context }) => {
  await mockAuth(context, {
    role: "company",
    companies: ["DEMO"],
    clientSlug: "DEMO",
  });

  await page.goto("/empresas/demo/dashboard", {
    waitUntil: "domcontentloaded",
  });

  await expectCurrentDashboardReady(page);
  await expect(page.getByText(/Leitura executiva|Insights|Alertas recentes/i).first()).toBeVisible();
});
