import { test, expect } from "@playwright/test";
import {
  autenticarPerfilRuns,
  rotaRunsEmpresa,
} from "../../../support/functions/ui/runs/rotas-runs";

test.describe("rbac - runs UI", () => {
  test("usuario da empresa nao ve botao de criar run", async ({ page, context }) => {
    await autenticarPerfilRuns(context, "company_user");

    await page.goto(rotaRunsEmpresa(), { waitUntil: "networkidle" });

    await expect(page.getByTestId("run-create")).toHaveCount(0);
  });

  test("empresa ve botao de criar run", async ({ page, context }) => {
    await autenticarPerfilRuns(context, "empresa");

    await page.goto(rotaRunsEmpresa(), { waitUntil: "networkidle" });

    await expect(page.getByTestId("run-create")).toBeVisible();
  });

  test("empresa nao ve deletar run", async ({ page, context }) => {
    await autenticarPerfilRuns(context, "empresa");

    await page.goto(rotaRunsEmpresa(), { waitUntil: "networkidle" });

    await expect(page.getByTestId("run-delete")).toHaveCount(0);
  });

  test("admin acessa repositorio de runs da empresa", async ({ page, context }) => {
    await autenticarPerfilRuns(context, "admin");

    await page.goto(rotaRunsEmpresa(), { waitUntil: "networkidle" });

    await expect(page.getByTestId("test-run-repository")).toBeVisible();
    await expect(page.getByTestId("test-run-list")).toBeVisible();
  });
});

