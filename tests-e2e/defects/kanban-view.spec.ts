import { test, expect } from "@playwright/test";
import { mockAuth } from "../helpers/mockAuth";

test.describe("kanban - visualização", () => {
  test("user vê colunas do kanban", async ({ page, context }) => {
    await mockAuth(context, {
      role: "user",
      companies: ["griaule"],
      clientSlug: "griaule",
    });

    await page.addInitScript(() => sessionStorage.clear());
    await page.goto("/empresas/griaule/defeitos/kanban", { waitUntil: "networkidle" });

    await expect(page.getByTestId("kanban-page")).toBeVisible();
    await expect(page.getByTestId("kanban-column-pass")).toBeVisible();
    await expect(page.getByTestId("kanban-column-fail")).toBeVisible();
  });
});
