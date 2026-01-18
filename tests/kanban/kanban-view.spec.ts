import { test, expect } from "@playwright/test";
import { mockAuth } from "../helpers/mockAuth";

test("user vê defeitos organizados por status", async ({ page, context }) => {
  await mockAuth(context, {
    role: "user",
    companies: ["griaule"],
    clientSlug: "griaule",
  });

  await page.goto("/defeitos/kanban", { waitUntil: "networkidle" });

  await expect(page.getByTestId("kanban-page")).toBeVisible();
  await expect(page.getByTestId("kanban-column-open")).toBeVisible();
  await expect(page.getByTestId("kanban-column-in-progress")).toBeVisible();
});