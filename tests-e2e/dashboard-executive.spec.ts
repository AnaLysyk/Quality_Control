import { test, expect } from "@playwright/test";
import { mockAuth } from "./helpers/mockAuth";

test("company loads the new dashboard shell and key summary blocks", async ({ page, context }) => {
  await mockAuth(context, {
    role: "company",
    companies: ["griaule"],
    clientSlug: "griaule",
  });

  await page.goto("/empresas/griaule/dashboard", {
    waitUntil: "networkidle",
  });

  await expect(page).toHaveURL(/\/empresas\/griaule\/dashboard/);
  await expect(page.getByRole("heading", { name: /Griaule/i })).toBeVisible({ timeout: 30000 });
  await expect(page.getByText("Runs totais", { exact: true })).toBeVisible({ timeout: 30000 });
  await expect(page.getByText("Concluidas", { exact: true })).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole("link", { name: /Ver lista completa/i })).toBeVisible({ timeout: 30000 });
});
