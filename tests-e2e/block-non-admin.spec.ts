import { test, expect } from "@playwright/test";
import { mockAuth } from "./helpers/mockAuth";

test("user não acessa /admin", async ({ page, context }) => {
  await mockAuth(context, {
    role: "user",
    companies: ["griaule"],
  });

  await page.goto("/admin", { waitUntil: "networkidle" });

  await expect(page).toHaveURL(/\/user\/home|\/empresas/);
});
