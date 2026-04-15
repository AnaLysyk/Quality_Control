import { test, expect } from "@playwright/test";
import { mockAuth } from "../helpers/mockAuth";

test.describe("defeitos - listagem por empresa ativa", () => {
  test("user vÃª pÃ¡gina e lista de defeitos na empresa ativa", async ({ page, context }) => {
    await mockAuth(context, {
      role: "user",
      companies: ["DEMO"],
      clientSlug: "DEMO",
    });

    await page.goto("/empresas/demo/defeitos", { waitUntil: "networkidle" });

    await expect(page.getByTestId("defects-page")).toBeVisible();
    await expect(page.getByTestId("defects-list")).toBeVisible();
  });
});

