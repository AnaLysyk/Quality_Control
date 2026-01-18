import { test, expect } from "@playwright/test";
import { mockAuth } from "../helpers/mockAuth";

test("user vê relatório da empresa ativa", async ({ page, context }) => {
  await mockAuth(context, {
    role: "user",
    companies: ["griaule"],
    clientSlug: "griaule",
  });

  await page.goto("/relatorios", { waitUntil: "networkidle" });

  await expect(page.getByTestId("reports-page")).toBeVisible();
  await expect(page.getByTestId("metric-pass-rate")).toBeVisible();
  await expect(page.getByTestId("trend-chart")).toBeVisible();
});