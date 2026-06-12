import { test, expect } from "@playwright/test";
import { simularAutenticacao } from "../../../support/functions/interface/apoio/simular-autenticacao";

test.describe("kanban - permissÃ£o", () => {
  test("user nÃ£o vÃª controles de movimentaÃ§Ã£o", async ({ page, context }) => {
    await simularAutenticacao(context, {
      role: "user",
      companies: ["DEMO"],
      clientSlug: "DEMO",
    });

    await page.addInitScript(() => sessionStorage.clear());
    await page.goto("/empresas/demo/defeitos/kanban", { waitUntil: "networkidle" });

    // Controles de move sÃ³ existem para admin (editable=true)
    await expect(page.getByTestId("move-to-pass")).toBeHidden();
  });
});
