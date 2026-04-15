import { test, expect } from "@playwright/test";
import { mockAuth } from "../helpers/mockAuth";

test.describe("kanban - persistÃªncia local", () => {
  test("status persiste apÃ³s reload", async ({ page, context }) => {
    await mockAuth(context, {
      role: "admin",
      companies: ["DEMO"],
      clientSlug: "DEMO",
    });

    await page.addInitScript(() => sessionStorage.clear());
    await page.goto("/empresas/demo/defeitos/kanban", { waitUntil: "networkidle" });

    const card = page.getByTestId("kanban-card-k2");
    await card.locator('[data-testid="move-to-pass"]').first().click();
    await expect(page.getByTestId("kanban-column-pass")).toContainText("Erro no login");

    await page.reload({ waitUntil: "networkidle" });

    await expect(page.getByTestId("kanban-column-pass")).toContainText("Erro no login");
  });
});

