import { test, expect } from "@playwright/test";
import { mockAuth } from "./helpers/mockAuth";

test("dashboard indica defeitos fora do SLA", async ({ page, context }) => {
  await mockAuth(context, {
    role: "company",
    companies: ["griaule"],
    clientSlug: "griaule",
  });

  await page.goto("/empresas/griaule/dashboard", {
    waitUntil: "networkidle",
  });

  const slaCard = page.getByTestId("sla-card");
  await page.waitForTimeout(300);
  await expect(slaCard).toBeVisible({ timeout: 10000 });
});
