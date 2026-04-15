import { test, expect } from "@playwright/test";
import { mockAuth } from "../helpers/mockAuth";

test.describe("rbac - runs UI", () => {
  test("user nao ve botao de criar run", async ({ page, context }) => {
    await mockAuth(context, {
      role: "user",
      companies: ["DEMO"],
      clientSlug: "DEMO",
    });

    await page.goto("/empresas/demo/runs", { waitUntil: "networkidle" });

    await expect(page.getByTestId("run-create")).toHaveCount(0);
  });

  test("company ve botao de criar run", async ({ page, context }) => {
    await mockAuth(context, {
      role: "company",
      companies: ["DEMO"],
      clientSlug: "DEMO",
    });

    await page.goto("/empresas/demo/runs", { waitUntil: "networkidle" });

    await expect(page.getByTestId("run-create")).toBeVisible();
  });

  test("company nao ve deletar run", async ({ page, context }) => {
    await mockAuth(context, {
      role: "company",
      companies: ["DEMO"],
      clientSlug: "DEMO",
    });

    await page.goto("/admin/runs", { waitUntil: "networkidle" });

    await expect(page.getByTestId("run-delete")).toHaveCount(0);
  });

  test("admin ve deletar run", async ({ page, context }) => {
    await mockAuth(context, {
      role: "admin",
      companies: ["DEMO"],
      clientSlug: "DEMO",
    });

    await page.goto("/admin/runs", { waitUntil: "networkidle" });

    await expect(page.getByTestId("run-delete").first()).toBeVisible();
  });
});

