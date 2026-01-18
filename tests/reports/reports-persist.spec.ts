import { test, expect } from "@playwright/test";
import { mockAuth } from "../helpers/mockAuth";

test("período selecionado persiste após reload", async ({ page, context }) => {
  await mockAuth(context, {
    role: "admin",
    companies: ["griaule"],
  });

  await page.goto("/relatorios", { waitUntil: "networkidle" });

  await page.getByTestId("reports-period").selectOption("90d");
  await page.reload();

  await expect(page.getByTestId("reports-period")).toHaveValue("90d");
});