import { test, expect } from "@playwright/test";
import { mockAuth } from "../helpers/mockAuth";

test.describe("kanban - visualizaÃ§Ã£o", () => {
  test("user vÃª colunas do kanban", async ({ page, context }) => {
    await mockAuth(context, {
      role: "user",
      companies: ["DEMO"],
      clientSlug: "DEMO",
    });

    await page.addInitScript(() => sessionStorage.clear());
    await page.goto("/empresas/demo/defeitos/kanban", { waitUntil: "networkidle" });

    await expect(page.getByTestId("kanban-page")).toBeVisible();
    await expect(page.getByTestId("kanban-column-pass")).toBeVisible();
    await expect(page.getByTestId("kanban-column-fail")).toBeVisible();
  });
});

