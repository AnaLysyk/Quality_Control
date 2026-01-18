import { test, expect } from "@playwright/test";
import { mockAuth } from "../helpers/mockAuth";

test("user não vê botão de editar defeito", async ({ page, context }) => {
  await mockAuth(context, {
    role: "user",
    companies: ["griaule"],
  });

  await page.goto("/defeitos/123", { waitUntil: "networkidle" });

  await expect(page.getByTestId("defect-edit")).toBeHidden();
});