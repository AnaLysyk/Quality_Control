import { test, expect } from "@playwright/test";
import { mockAuth } from "../helpers/mockAuth";
import { createManualDefect } from "../utils/current-ui";

const DEFECTS_URL = "/empresas/demo/defeitos";

test.describe("rbac - defeitos", () => {
  test("user nao ve acoes protegidas", async ({ page, context }) => {
    await mockAuth(context, { role: "user", companies: ["DEMO"], clientSlug: "DEMO" });

    await page.goto(DEFECTS_URL, { waitUntil: "domcontentloaded" });

    await expect(page.getByTestId("defect-delete")).toHaveCount(0);
  });

  test("company edita defeito manual, mas nao deleta", async ({ page, context }) => {
    await mockAuth(context, { role: "company", companies: ["DEMO"], clientSlug: "DEMO" });

    await page.goto(DEFECTS_URL, { waitUntil: "domcontentloaded" });

    await createManualDefect(page, "Defeito manual - company");
    await page.getByText("Defeito manual - company").first().click();

    await expect(page.getByTestId("defect-save")).toBeVisible();
    await expect(page.getByTestId("defect-delete")).toHaveCount(0);
  });

  test("admin ve acoes de edicao e remocao", async ({ page, context }) => {
    await mockAuth(context, { role: "admin", companies: ["DEMO"], clientSlug: "DEMO" });

    await page.goto(DEFECTS_URL, { waitUntil: "domcontentloaded" });

    await createManualDefect(page, "Defeito manual - admin");
    await page.getByText("Defeito manual - admin").first().click();

    await expect(page.getByTestId("defect-save")).toBeVisible();
    await expect(page.getByTestId("defect-delete")).toBeVisible();
  });
});
