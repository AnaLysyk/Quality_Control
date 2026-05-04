import { test, expect } from "@playwright/test";
import { mockAuth } from "../helpers/mockAuth";

test.describe("kanban - persistência local", () => {
  test("status persiste após reload", async ({ page, context }) => {
    await mockAuth(context, {
      role: "admin",
      companies: ["DEMO"],
      clientSlug: "DEMO",
    });

    await page.addInitScript(() => sessionStorage.clear());
    await page.goto("/empresas/demo/defeitos/kanban", { waitUntil: "domcontentloaded" });

    const card = page.getByTestId("kanban-card-k2");
    await card.locator('[data-testid="move-to-pass"]').first().click();
    await expect(page.getByTestId("kanban-column-pass")).toContainText("Erro no login");

    await page.reload({ waitUntil: "domcontentloaded" });

    await expect(page.getByTestId("kanban-column-pass")).toContainText("Erro no login");
  });
});

