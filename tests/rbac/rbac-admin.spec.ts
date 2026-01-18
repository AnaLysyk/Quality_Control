import { test, expect } from "@playwright/test";
import { mockAuth } from "../helpers/mockAuth";

test("admin vê todas as ações", async ({ page, context }) => {
  await mockAuth(context, {
    role: "admin",
    companies: ["griaule"],
  });

  await page.goto("/defeitos/123", { waitUntil: "networkidle" });

  await expect(page.getByTestId("defect-edit")).toBeVisible();
  await expect(page.getByTestId("defect-delete")).toBeVisible();
});