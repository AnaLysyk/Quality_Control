import { test, expect } from "@playwright/test";
import { simularAutenticacao } from "../../../support/functions/ui/apoio/simular-autenticacao";

test.describe("runs - lista", () => {
  test("user vÃª runs da empresa ativa", async ({ page, context }) => {
    await simularAutenticacao(context, {
      role: "user",
      companies: ["DEMO"],
      clientSlug: "DEMO",
    });

    await page.goto("/empresas/demo/runs", { waitUntil: "networkidle" });

    await expect(page.getByTestId("runs-page")).toBeVisible();
    await expect(page.getByTestId("runs-list")).toBeVisible();
  });
});
