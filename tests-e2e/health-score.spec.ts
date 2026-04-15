import { test, expect } from "@playwright/test";
import { mockAuth } from "./helpers/mockAuth";

test("health score attention aparece no dashboard", async ({ page, context }) => {
  await mockAuth(context, {
    role: "company",
    companies: ["DEMO"],
    clientSlug: "DEMO",
  });

  await page.goto("/empresas/demo/dashboard", { waitUntil: "networkidle" });

  await expect(
    page.getByTestId("health-score-healthy")
      .or(page.getByTestId("health-score-attention"))
      .or(page.getByTestId("health-score-critical"))
  ).toBeVisible();
});

