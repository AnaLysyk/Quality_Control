import { test, expect } from "@playwright/test";
import { simularAutenticacao } from "../../../support/functions/ui/apoio/simular-autenticacao";

test.describe("kanban - persistÃƒªncia local", () => {
  test("status persiste após reload", async ({ page, context }) => {
    await simularAutenticacao(context, {
      role: "admin",
      companies: ["DEMO"],
      clientSlug: "DEMO",
    });

    await page.addInitScript(() => sessionStorage.clear());
    await page.goto("/empresas/demo/defeitos/kanban", { waitUntil: "networkidle" });

    const card = page.getByTestId("kanban-card-k2");
    await card.locator('[data-testid="move-to-pass"]').first().click();
    await expect(page.getByTestId("kanban-column-pass")).toContainText("Erro no login");

    await page.reload({ waitUntil: "domcontentloaded" });

    await expect(page.getByTestId("kanban-column-pass")).toContainText("Erro no login");
  });
});

