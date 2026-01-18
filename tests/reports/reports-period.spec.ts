import { test, expect } from "@playwright/test";
import { mockAuth } from "../helpers/mockAuth";

test("troca de período atualiza métricas", async ({ page, context }) => {
  await mockAuth(context, {
    role: "user",
    companies: ["griaule"],
  });

  await page.goto("/relatorios", { waitUntil: "networkidle" });

  await page.getByTestId("reports-period").selectOption("30d");
  await expect(page.getByTestId("metric-total-runs")).toBeVisible();
});