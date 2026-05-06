import { test, expect } from "@playwright/test";
import { mockAuth } from "../helpers/mockAuth";

test.describe("defeitos - permissÃµes", () => {
  test("user nÃ£o vÃª botÃ£o de ediÃ§Ã£o de defeito manual", async ({ page, context }) => {
    await mockAuth(context, {
      role: "user",
      companies: ["DEMO"],
      clientSlug: "DEMO",
    });

    await page.goto("/empresas/demo/defeitos", { waitUntil: "networkidle" });

    await expect(page.getByTestId("defect-edit")).toBeHidden();
  });

  test("admin acessa pÃ¡gina de defeitos", async ({ page, context }) => {
    await mockAuth(context, {
      role: "admin",
      companies: ["DEMO", "testing-company"],
      clientSlug: "DEMO",
    });

    await page.goto("/empresas/demo/defeitos", { waitUntil: "networkidle" });

    await expect(page.getByTestId("defects-page")).toBeVisible();
    await expect(page.getByTestId("defects-list")).toBeVisible();
  });
});

