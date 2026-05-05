import { test, expect } from "@playwright/test";
import { mockAuth } from "../helpers/mockAuth";

test.describe("kanban - movimentação", () => {
  test("admin move card para outra coluna", async ({ page, context }) => {
    await mockAuth(context, {
      role: "admin",
      companies: ["DEMO"],
      clientSlug: "DEMO",
    });

    await page.addInitScript(() => sessionStorage.clear());
    await page.goto("/empresas/demo/defeitos/kanban", { waitUntil: "domcontentloaded" });

    const card = page.getByTestId("kanban-card-k2");
    await expect(card).toBeVisible();

    await card.getByTestId("move-to-pass").click();

    await expect(page.getByTestId("kanban-column-pass")).toContainText("Erro no login");
  });
});

