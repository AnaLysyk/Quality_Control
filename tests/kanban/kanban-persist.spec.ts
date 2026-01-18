import { test, expect } from "@playwright/test";
import { mockAuth } from "../helpers/mockAuth";

test("status do defeito persiste após reload", async ({ page, context }) => {
  await mockAuth(context, {
    role: "admin",
    companies: ["griaule"],
  });

  await page.goto("/defeitos/kanban", { waitUntil: "networkidle" });

  await page.getByTestId("kanban-card-123")
    .getByTestId("move-to-done")
    .click();

  await page.reload();

  await expect(page.getByTestId("kanban-column-done")).toContainText("Erro no login");
});