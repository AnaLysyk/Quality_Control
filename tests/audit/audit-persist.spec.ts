import { test, expect } from "@playwright/test";
import { mockAuth } from "../helpers/mockAuth";

test("histórico persiste após reload", async ({ page, context }) => {
  await mockAuth(context, {
    role: "admin",
    companies: ["griaule"],
  });

  await page.goto("/historico", { waitUntil: "networkidle" });

  const firstEvent = page.locator('[data-testid^="audit-item-"]').first();
  await expect(firstEvent).toBeVisible();

  await page.reload();

  await expect(firstEvent).toBeVisible();
});