import { test, expect } from "@playwright/test";
import { mockAuth } from "../helpers/mockAuth";

const DEFECTS_URL = "/empresas/demo/defeitos";

test.describe("rbac - defeitos", () => {
  test("user nÃ£o vÃª aÃ§Ãµes protegidas", async ({ page, context }) => {
    await mockAuth(context, { role: "user", companies: ["DEMO"], clientSlug: "DEMO" });

    await page.goto(DEFECTS_URL, { waitUntil: "networkidle" });

    const edit = page.locator('[data-testid="defect-edit"]');
    const del = page.locator('[data-testid="defect-delete"]');
    const link = page.locator('[data-testid="defect-link-run"]');

    await expect(edit).toHaveCount(0);
    await expect(del).toHaveCount(0);
    await expect(link).toHaveCount(0);
  });

  test("company vÃª editar/link em defeito manual, mas nÃ£o delete", async ({ page, context }) => {
    await mockAuth(context, { role: "company", companies: ["DEMO"], clientSlug: "DEMO" });

    await page.goto(DEFECTS_URL, { waitUntil: "networkidle" });

    // garante um defeito manual para checar botÃµes
    await page.getByTestId("defect-title").fill("Defeito manual - company");
    await page.getByTestId("defect-create").click();

    const edit = page.locator('[data-testid="defect-edit"]');
    const del = page.locator('[data-testid="defect-delete"]');
    const link = page.locator('[data-testid="defect-link-run"]');

    await expect(edit).toBeVisible();
    await expect(link).toBeVisible();
    await expect(del).toHaveCount(0);
  });

  test("admin vÃª todas as aÃ§Ãµes", async ({ page, context }) => {
    await mockAuth(context, { role: "admin", companies: ["DEMO"], clientSlug: "DEMO" });

    await page.goto(DEFECTS_URL, { waitUntil: "networkidle" });

    // garante um defeito manual para checar botÃµes
    await page.getByTestId("defect-title").fill("Defeito manual - admin");
    await page.getByTestId("defect-create").click();

    const edit = page.locator('[data-testid="defect-edit"]');
    const del = page.locator('[data-testid="defect-delete"]');
    const link = page.locator('[data-testid="defect-link-run"]');

    await expect(edit).toBeVisible();
    await expect(del).toBeVisible();
    await expect(link).toBeVisible();
  });
});

