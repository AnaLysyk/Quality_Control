import { test, expect } from "@playwright/test";
import { mockAuth } from "./helpers/mockAuth";

test("dashboard exibe MTTR médio", async ({ page, context }) => {
  await mockAuth(context, {
    role: "company",
    companies: ["griaule"],
    clientSlug: "griaule",
  });

  await page.goto("/empresas/griaule/dashboard", {
    waitUntil: "networkidle",
  });

  const card = page.getByTestId("mttr-card");
  await expect(card).toBeVisible();

  await expect(card).not.toHaveText("—");
});
