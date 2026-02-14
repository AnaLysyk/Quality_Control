
import { test, expect } from "@playwright/test";
import { mockAuth } from "../helpers/mockAuth";

test.describe("Kanban - Movimentação de Cards", () => {
  test("Admin move card para outra coluna e verifica resultado", async ({ page, context }) => {
    await mockAuth(context, {
      role: "admin",
      companies: ["griaule"],
      clientSlug: "griaule",
    });

    await page.addInitScript(() => localStorage.clear());
    await page.goto("/empresas/griaule/defeitos/kanban", { waitUntil: "networkidle" });

    // Garante que o card está visível antes de mover
    const card = page.getByTestId("kanban-card-k2");
    await expect(card).toBeVisible();

    // Move o card para a coluna "pass"
    await card.getByTestId("move-to-pass").click();

    // Verifica se o card aparece na coluna correta
    await expect(page.getByTestId("kanban-column-pass")).toContainText("Erro no login");
  });
});
