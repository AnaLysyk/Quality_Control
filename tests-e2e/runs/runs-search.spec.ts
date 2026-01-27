import { test, expect } from "@playwright/test";
import { mockAuth } from "../helpers/mockAuth";

test.describe("runs - busca", () => {
  test("user filtra runs pela busca", async ({ page, context }) => {
    await mockAuth(context, {
      role: "user",
      companies: ["griaule"],
      clientSlug: "griaule",
    });

    await page.goto("/empresas/griaule/runs", { waitUntil: "networkidle" });

    const search = page.getByTestId("runs-search");
    await expect(search).toBeVisible();
    await search.fill("Sprint");

    await page.waitForTimeout(300);
    await expect(page.getByTestId("runs-list")).toBeVisible({ timeout: 10000 });
  });
});
