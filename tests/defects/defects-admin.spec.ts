import { test, expect } from "@playwright/test";
import { mockAuth } from "../helpers/mockAuth";

test("admin vê defeitos de todas as empresas", async ({ page, context }) => {
  await mockAuth(context, {
    role: "admin",
    companies: ["griaule", "testing-company"],
  });

  await page.goto("/defeitos", { waitUntil: "networkidle" });

  await expect(page.getByText("Griaule")).toBeVisible();
  await expect(page.getByText("Testing Company")).toBeVisible();
});