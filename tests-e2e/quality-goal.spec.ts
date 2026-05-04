import { test, expect } from "@playwright/test";
import { mockAuth } from "./helpers/mockAuth";
import { seedQualityGoalStatus } from "./utils/seed-mttr-goal";

test("meta de qualidade aparece como em risco/violada/atendida", async ({ page, context }) => {
  await seedQualityGoalStatus();
  await mockAuth(context, {
    role: "company",
    companies: ["DEMO"],
    clientSlug: "DEMO",
  });

  await page.goto("/empresas/demo/dashboard", { waitUntil: "networkidle" });

  const items = await page.locator('[data-testid="quality-goal-item"]').all();
  expect(items.length).toBeGreaterThan(0);
  for (const item of items) {
    await expect(item).toBeVisible();
    const status = await item.locator('[data-testid="quality-goal-status"]').textContent();
    expect(status).toMatch(/Atendida|risco|Violada/i);
  }
});

