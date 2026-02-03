import { test, expect } from "@playwright/test";
import { mockAuth } from "./helpers/mockAuth";

test.setTimeout(120000);

test("release com MTTR alto aparece como risk", async ({ page, context }) => {
  await mockAuth(context, {
    role: "company",
    companies: ["griaule"],
    clientSlug: "griaule",
  });

  await page.goto("/empresas/griaule/dashboard", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(500);
  await expect(page.getByTestId("release-quality-risk")).toBeVisible({ timeout: 20000 });
});
