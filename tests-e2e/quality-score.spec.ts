import { test, expect } from "@playwright/test";
import { mockAuth } from "./helpers/mockAuth";

test("release exibe quality score", async ({ page, context }) => {
  await mockAuth(context, {
    role: "company",
    companies: ["griaule"],
    clientSlug: "griaule",
  });

  await page.goto("/empresas/griaule/dashboard", { waitUntil: "networkidle" });

  const score = page.getByTestId("quality-score");

  await expect(score).toBeVisible();
  await expect(score).toHaveText(/\d{2,3}/);
});
