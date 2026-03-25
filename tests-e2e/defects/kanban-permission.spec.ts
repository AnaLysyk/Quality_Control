import { test, expect } from "@playwright/test";
import { mockAuth } from "../helpers/mockAuth";

test.describe("kanban - permissão", () => {
  test("user não vê controles de movimentação", async ({ page, context }) => {
    await mockAuth(context, {
      role: "user",
      companies: ["griaule"],
      clientSlug: "griaule",
    });

    await page.addInitScript(() => sessionStorage.clear());
    await page.goto("/empresas/griaule/defeitos/kanban", { waitUntil: "networkidle" });

    // Controles de move só existem para admin (editable=true)
    await expect(page.getByTestId("move-to-pass")).toBeHidden();
  });
});
