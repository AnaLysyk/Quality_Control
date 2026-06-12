import { test, expect } from "@playwright/test";
import { simularAutenticacao } from "../../../support/functions/interface/apoio/simular-autenticacao";

test.describe("runs - busca", () => {
  test("user filtra runs pela busca", async ({ page, context }) => {
    await simularAutenticacao(context, {
      role: "user",
      companies: ["DEMO"],
      clientSlug: "DEMO",
    });

    await page.goto("/empresas/demo/runs", { waitUntil: "networkidle" });

    const search = page.getByTestId("runs-search");
    await expect(search).toBeVisible();
    await search.fill("Sprint");

    await page.waitForTimeout(300);
    await expect(page.getByTestId("runs-list")).toBeVisible({ timeout: 10000 });
  });
});
