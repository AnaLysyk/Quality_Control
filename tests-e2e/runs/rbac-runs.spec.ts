import { test, expect } from "@playwright/test";
import { mockAuth } from "../helpers/mockAuth";

test.describe("rbac - runs UI", () => {
  test("user nao ve botao de criar run", async ({ page, context }) => {
    await mockAuth(context, {
      role: "user",
      companies: ["DEMO"],
      clientSlug: "DEMO",
    });

    await page.goto("/empresas/demo/runs", { waitUntil: "domcontentloaded" });

    await expect(page.getByTestId("run-create")).toHaveCount(0);
  });

  test("company ve botao de criar run", async ({ page, context }) => {
    await mockAuth(context, {
      role: "company",
      companies: ["DEMO"],
      clientSlug: "DEMO",
    });

    await page.goto("/empresas/demo/runs", { waitUntil: "domcontentloaded" });

    await expect(page.getByTestId("run-create")).toBeVisible();
  });

  test("company nao ve deletar run", async ({ page, context }) => {
    await mockAuth(context, {
      role: "company",
      companies: ["DEMO"],
      clientSlug: "DEMO",
    });

    await page.goto("/admin/runs", { waitUntil: "domcontentloaded" });

    await expect(page.getByTestId("run-delete")).toHaveCount(0);
  });

  test("admin ve deletar run", async ({ page, context }) => {
    await mockAuth(context, {
      role: "admin",
      companies: ["DEMO"],
      clientSlug: "DEMO",
    });

    await page.goto("/admin/runs", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { name: /Gerenciar Runs|Central Operacional/i })).toBeVisible({ timeout: 30000 });
    const deleteButtons = page.getByTestId("run-delete");
    if ((await deleteButtons.count()) > 0) {
      await expect(deleteButtons.first()).toBeVisible();
    } else {
      await expect(page.getByText(/Mostrando 0 de 0|Nenhuma/i).first()).toBeVisible();
    }
  });
});
