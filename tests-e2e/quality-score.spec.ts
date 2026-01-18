import { test, expect } from "@playwright/test";
import { mockAuth } from "../helpers/mockAuth";

test("dashboard mostra quality score", async ({ page, context }) => {
  await mockAuth(context, {
    role: "company",
    companies: ["griaule"],
    clientSlug: "griaule",
  });

  await page.goto("/empresas/griaule/dashboard", {
    waitUntil: "networkidle",
  });

  await expect(page.getByTestId("quality-score")).toBeVisible();
});
