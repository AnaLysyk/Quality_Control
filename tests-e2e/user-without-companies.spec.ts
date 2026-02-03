import { test, expect } from "@playwright/test";
import { mockAuth } from "./helpers/mockAuth";

test("user sem empresas fica em /empresas", async ({ page, context }) => {
  await mockAuth(context, {
    role: "user",
    companies: [],
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });

  await expect(page).toHaveURL(/\/empresas/);
});
