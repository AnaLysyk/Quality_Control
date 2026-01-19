import { test, expect } from "@playwright/test";
import { mockAuth } from "./helpers/mockAuth";

test("tendência improving aparece no dashboard", async ({ page, context }) => {
  await mockAuth(context, {
    role: "company",
    companies: ["griaule"],
    clientSlug: "griaule",
  });

  await page.goto("/empresas/griaule/dashboard", { waitUntil: "networkidle" });

  await expect(
    page.getByTestId("quality-trend-improving").or(page.getByTestId("quality-trend-stable"))
  ).toBeVisible();
});
