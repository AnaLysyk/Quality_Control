import { test, expect } from "@playwright/test";
import { mockAuth } from "./utils/mockAuth";

test("dashboard mostra qualidade por run", async ({ page, context }) => {
  await mockAuth(context, {
    role: "admin",
    companies: ["griaule"],
    clientSlug: "griaule",
  });

  await page.goto("/empresas/griaule/dashboard", {
    waitUntil: "networkidle",
  });

  await page.waitForTimeout(300);
  await expect(page.getByTestId("runs-quality-table")).toBeVisible({ timeout: 10000 });
});
