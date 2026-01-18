import { test, expect } from "@playwright/test";
import { mockAuth } from "./helpers/mockAuth";

test("company vê score, mttr e releases no dashboard", async ({ page, context }) => {
  await mockAuth(context, {
    role: "company",
    companies: ["griaule"],
    clientSlug: "griaule",
  });

  await page.goto("/empresas/griaule/dashboard", {
    waitUntil: "networkidle",
  });

  await expect(page.getByTestId("quality-score")).toBeVisible();
  await expect(page.getByTestId("mttr")).toBeVisible();
  await expect(page.getByTestId("releases-status")).toBeVisible();
});
