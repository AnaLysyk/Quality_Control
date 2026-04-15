import { test, expect } from "@playwright/test";
import { mockAuth } from "./helpers/mockAuth";

test("dashboard mostra tendÃªncia de MTTR", async ({ page, context }) => {
  await mockAuth(context, {
    role: "company",
    companies: ["DEMO"],
    clientSlug: "DEMO",
  });

  await page.goto("/empresas/demo/dashboard", {
    waitUntil: "networkidle",
  });

  await page.waitForTimeout(300);
  await expect(page.getByTestId("mttr-trend")).toBeVisible({ timeout: 10000 });
});

