import { test, expect } from "@playwright/test";
import { autenticarPerfilRuns, rotaRunsEmpresa } from "../../../tools/functions/ui/runs/rotas-runs";

test.describe("runs - lista", () => {
  test("user vÃƒª runs da empresa ativa", async ({ page, context }) => {
    await autenticarPerfilRuns(context, "company_user");

    await page.goto(rotaRunsEmpresa(), { waitUntil: "networkidle" });

    await expect(page.getByTestId("test-run-repository")).toBeVisible();
    await expect(page.getByTestId("test-run-list")).toBeVisible();
  });
});

