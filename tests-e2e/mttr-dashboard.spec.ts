import { test, expect } from "@playwright/test";
import { mockAuth } from "./helpers/mockAuth";
import { seedMTTRDashboard } from "./utils/seed-mttr-goal";

test("dashboard exibe MTTR mÃ©dio", async ({ page, context }) => {
  await mockAuth(context, {
    role: "company",
    companies: ["DEMO"],
    clientSlug: "DEMO",
  });
  await seedMTTRDashboard();
  await page.goto("/empresas/demo/dashboard", {
    waitUntil: "networkidle",
  });
  // Aguarda o seed refletir e a pÃ¡gina estabilizar
  await page.waitForTimeout(500);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="mttr-card"]', { timeout: 10000 });
  const card = page.getByTestId("mttr-card");
  await expect(card).toBeVisible();
  await expect(card).not.toHaveText("â€”");
});

