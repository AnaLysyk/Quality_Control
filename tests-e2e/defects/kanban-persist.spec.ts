
/**
 * Teste de persistência local do status do kanban.
 * Garante que o status do card persiste após reload da página.
 */
import { test, expect } from "@playwright/test";
import { mockAuth } from "../helpers/mockAuth";

test.describe("Kanban - Persistência Local", () => {
  test("Status do card persiste após reload da página", async ({ page, context }) => {
    // Mocka autenticação como admin
    await mockAuth(context, {
      role: "admin",
      companies: ["griaule"],
      clientSlug: "griaule",
    });

    // Limpa localStorage e navega para o kanban
    await page.addInitScript(() => localStorage.clear());
    await page.goto("/empresas/griaule/defeitos/kanban", { waitUntil: "networkidle" });

    // Move o card para a coluna "pass"
    const card = page.getByTestId("kanban-card-k2");
    await card.locator('[data-testid="move-to-pass"]').first().click();
    await expect(page.getByTestId("kanban-column-pass")).toContainText("Erro no login");

    // Recarrega a página e verifica persistência
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.getByTestId("kanban-column-pass")).toContainText("Erro no login");
  });
});
