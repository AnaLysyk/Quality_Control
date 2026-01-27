import { test, expect } from "@playwright/test";
import { mockAuth } from "./helpers/mockAuth";

test("empresa ativa persiste após reload", async ({ page, context }) => {
  await mockAuth(context, {
    role: "admin",
    companies: ["griaule", "testing-company"],
    clientSlug: "testing-company",
  });

  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await page.waitForURL(/\/empresas\/testing-company\/home/, { timeout: 20000 });
  await page.waitForTimeout(500);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await expect(page).toHaveURL(/\/empresas\/testing-company\/home/);
});
