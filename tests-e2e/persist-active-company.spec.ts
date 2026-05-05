import { test, expect } from "@playwright/test";
import { mockAuth } from "./helpers/mockAuth";

test("admin permanece no painel global apos reload", async ({ page, context }) => {
  await mockAuth(context, {
    role: "admin",
    companies: ["DEMO", "testing-company"],
    clientSlug: "testing-company",
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForURL(/\/admin\/dashboard/, { timeout: 20000 });
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/admin\/dashboard/);
});
