import { test, expect } from "@playwright/test";
import { mockAuth } from "../helpers/mockAuth";

test.describe("runs - lista", () => {
  test("user vê runs da empresa ativa", async ({ page, context }) => {
    await mockAuth(context, {
      role: "user",
      companies: ["griaule"],
      clientSlug: "griaule",
    });

    await page.goto("/empresas/griaule/runs", { waitUntil: "networkidle" });

    await expect(page.getByTestId("runs-page")).toBeVisible();
    await expect(page.getByTestId("runs-list")).toBeVisible();
  });
});
