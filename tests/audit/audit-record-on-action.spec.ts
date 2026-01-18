import { test, expect } from "@playwright/test";
import { mockAuth } from "../helpers/mockAuth";

test("ação gera evento no histórico", async ({ page, context }) => {
  await mockAuth(context, {
    role: "user",
    companies: ["griaule"],
    clientSlug: "griaule",
  });

  await page.goto("/defeitos/123", { waitUntil: "networkidle" });
  await page.getByTestId("link-run").click();
  await page.getByTestId("run-option-456").click();

  await page.goto("/historico", { waitUntil: "networkidle" });
  await expect(page.getByText("Vinculou run")).toBeVisible();
});