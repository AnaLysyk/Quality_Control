import { test, expect } from "@playwright/test";
import { mockAuth } from "../helpers/mockAuth";

test("company edita mas não deleta defeito", async ({ page, context }) => {
  await mockAuth(context, {
    role: "company",
    companies: ["griaule"],
  });

  await page.goto("/defeitos/123", { waitUntil: "networkidle" });

  await expect(page.getByTestId("defect-edit")).toBeVisible();
  await expect(page.getByTestId("defect-delete")).toBeHidden();
});