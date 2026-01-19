import { test, expect } from "@playwright/test";
import { mockAuth } from "./helpers/mockAuth";

test("meta de qualidade aparece como em risco/violada/atendida", async ({ page, context }) => {
  await mockAuth(context, {
    role: "company",
    companies: ["griaule"],
    clientSlug: "griaule",
  });

  await page.goto("/empresas/griaule/dashboard", { waitUntil: "networkidle" });

  await expect(page.getByTestId("quality-goal-item")).toBeVisible();
  await expect(page.getByTestId("quality-goal-status")).toHaveText(/Atendida|risco|Violada/i);
});
