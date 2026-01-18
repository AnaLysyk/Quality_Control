import { test, expect } from "@playwright/test";
import { mockAuth } from "../helpers/mockAuth";

test.describe("kanban - persistência local", () => {
  test("status persiste após reload", async ({ page, context }) => {
    await mockAuth(context, {
      role: "admin",
      companies: ["griaule"],
      clientSlug: "griaule",
    });

    await page.addInitScript(() => localStorage.clear());
    await page.goto("/empresas/griaule/defeitos/kanban", { waitUntil: "networkidle" });

    const card = page.getByTestId("kanban-card-k2");
    await card.getByTestId("move-to-pass").click();
    await expect(page.getByTestId("kanban-column-pass")).toContainText("Erro no login");

    await page.reload({ waitUntil: "networkidle" });

    await expect(page.getByTestId("kanban-column-pass")).toContainText("Erro no login");
  });
});
