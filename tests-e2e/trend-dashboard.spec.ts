import { test, expect } from "@playwright/test";
import { mockAuth } from "./helpers/mockAuth";

test("dashboard mostra tendência de MTTR", async ({ page, context }) => {
  await mockAuth(context, {
    role: "company",
    companies: ["griaule"],
    clientSlug: "griaule",
  });

  await page.goto("/empresas/griaule/dashboard", {
    waitUntil: "networkidle",
  });

  await page.waitForTimeout(300);
  await expect(page.getByTestId("mttr-trend")).toBeVisible({ timeout: 10000 });
});
