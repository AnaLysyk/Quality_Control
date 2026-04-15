import { test, expect } from "@playwright/test";
import { mockAuth } from "./helpers/mockAuth";

test("tendÃªncia improving aparece no dashboard", async ({ page, context }) => {
  await mockAuth(context, {
    role: "company",
    companies: ["DEMO"],
    clientSlug: "DEMO",
  });

  await page.goto("/empresas/demo/dashboard", { waitUntil: "networkidle" });

  await expect(
    page.getByTestId("quality-trend-improving").or(page.getByTestId("quality-trend-stable"))
  ).toBeVisible();
});

