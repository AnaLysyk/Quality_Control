import { test, expect } from "@playwright/test";
import { simularAutenticacao } from "../../../support/functions/ui/apoio/simular-autenticacao";

test.describe("kanban - visualizaÃ§Ã£o", () => {
  test("user vÃª colunas do kanban", async ({ page, context }) => {
    await simularAutenticacao(context, {
      role: "user",
      companies: ["DEMO"],
      clientSlug: "DEMO",
    });

    await page.addInitScript(() => sessionStorage.clear());
    await page.goto("/empresas/demo/defeitos/kanban", { waitUntil: "networkidle" });

    await expect(page.getByTestId("kanban-page")).toBeVisible();
    await expect(page.getByTestId("kanban-column-pass")).toBeVisible();
    await expect(page.getByTestId("kanban-column-fail")).toBeVisible();
  });
});
