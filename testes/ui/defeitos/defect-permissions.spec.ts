import { test, expect } from "@playwright/test";
import { simularAutenticacao } from "../../../support/functions/ui/apoio/simular-autenticacao";

test.describe("defeitos - permissÃƒÂµes", () => {
  test("user nÃƒÂ£o vÃƒÂª botÃƒÂ£o de ediÃƒÂ§ÃƒÂ£o de defeito manual", async ({ page, context }) => {
    await simularAutenticacao(context, {
      role: "user",
      companies: ["DEMO"],
      clientSlug: "DEMO",
    });

    await page.goto("/empresas/demo/defeitos", { waitUntil: "networkidle" });

    await expect(page.getByTestId("defect-edit")).toBeHidden();
  });

  test("admin acessa pÃƒÂ¡gina de defeitos", async ({ page, context }) => {
    await simularAutenticacao(context, {
      role: "admin",
      companies: ["DEMO", "testing-company"],
      clientSlug: "DEMO",
    });

    await page.goto("/empresas/demo/defeitos", { waitUntil: "networkidle" });

    await expect(page.getByTestId("defects-page")).toBeVisible();
    await expect(page.getByTestId("defects-list")).toBeVisible();
  });
});

