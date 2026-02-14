
import { test, expect } from "@playwright/test";
import { mockAuth } from "../helpers/mockAuth";

test.describe("Kanban - Permissões de Movimentação", () => {
  test("Usuário comum não vê controles de movimentação de card", async ({ page, context }) => {
    await mockAuth(context, {
      role: "user",
      companies: ["griaule"],
      clientSlug: "griaule",
    });

    await page.addInitScript(() => localStorage.clear());
    await page.goto("/empresas/griaule/defeitos/kanban", { waitUntil: "networkidle" });

    // Controles de movimentação só existem para admin (editable=true)
    await expect(page.getByTestId("move-to-pass")).toBeHidden();
  });
});
