import { test, expect } from "@playwright/test";
import { autenticarPerfilRuns, rotaRunsEmpresa } from "../../../support/functions/ui/runs/rotas-runs";

test.describe("runs - busca", () => {
  test("user filtra runs pela busca", async ({ page, context }) => {
    await autenticarPerfilRuns(context, "company_user");

    await page.goto(rotaRunsEmpresa(), { waitUntil: "networkidle" });

    const search = page.getByTestId("runs-search");
    await expect(search).toBeVisible();
    await search.fill("Sprint");

    await page.waitForTimeout(300);
    await expect(page.getByTestId("test-run-list")).toBeVisible({ timeout: 10000 });
  });
});

