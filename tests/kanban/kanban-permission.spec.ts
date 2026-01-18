import { test, expect } from "@playwright/test";
import { mockAuth } from "../helpers/mockAuth";

test("user não pode mover defeito para resolvido", async ({ page, context }) => {
  await mockAuth(context, {
    role: "user",
    companies: ["griaule"],
  });

  await page.goto("/defeitos/kanban", { waitUntil: "networkidle" });

  await expect(page.getByTestId("move-to-done")).toBeHidden();
});