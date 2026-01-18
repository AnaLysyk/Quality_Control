import { test, expect } from "@playwright/test";
import { mockAuth } from "../helpers/mockAuth";

test("user move defeito para em andamento", async ({ page, context }) => {
  await mockAuth(context, {
    role: "user",
    companies: ["griaule"],
    clientSlug: "griaule",
  });

  await page.goto("/defeitos/kanban", { waitUntil: "networkidle" });

  const card = page.getByTestId("kanban-card-123");
  await card.getByTestId("move-to-in-progress").click();

  await expect(page.getByTestId("kanban-column-in-progress")).toContainText("Erro no login");
});