import { test, expect } from "@playwright/test";
import { mockAuth } from "../helpers/mockAuth";

test("admin pode filtrar relatório por empresa", async ({ page, context }) => {
  await mockAuth(context, {
    role: "admin",
    companies: ["griaule", "testing-company"],
  });

  await page.goto("/relatorios", { waitUntil: "networkidle" });

  await page.getByTestId("reports-company-filter").selectOption("testing-company");
  await expect(page.getByText("Testing Company")).toBeVisible();
});