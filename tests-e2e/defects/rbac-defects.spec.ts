import { test, expect } from "@playwright/test";
import { mockAuth } from "../helpers/mockAuth";
import { createManualDefect } from "../utils/current-ui";

const DEFECTS_URL = "/empresas/demo/defeitos";

test.describe("rbac - defeitos", () => {
  test("user nÃ£o vÃª aÃ§Ãµes protegidas", async ({ page, context }) => {
    await mockAuth(context, { role: "user", companies: ["DEMO"], clientSlug: "DEMO" });

    await page.goto(DEFECTS_URL, { waitUntil: "domcontentloaded" });

    await expect(page.getByTestId("defect-delete")).toHaveCount(0);
  });

  test("company vÃª editar/link em defeito manual, mas nÃ£o delete", async ({ page, context }) => {
    await mockAuth(context, { role: "company", companies: ["DEMO"], clientSlug: "DEMO" });

    await page.goto(DEFECTS_URL, { waitUntil: "domcontentloaded" });

    // garante um defeito manual para checar botÃµes
    await page.getByTestId("defect-title").fill("Defeito manual - company");
    await page.getByTestId("defect-create").click();

    await expect(page.getByTestId("defect-save")).toBeVisible();
    await expect(page.getByTestId("defect-delete")).toHaveCount(0);
  });

  test("admin vÃª todas as aÃ§Ãµes", async ({ page, context }) => {
    await mockAuth(context, { role: "admin", companies: ["DEMO"], clientSlug: "DEMO" });

    await page.goto(DEFECTS_URL, { waitUntil: "domcontentloaded" });

    // garante um defeito manual para checar botÃµes
    await page.getByTestId("defect-title").fill("Defeito manual - admin");
    await page.getByTestId("defect-create").click();

    await expect(page.getByTestId("defect-save")).toBeVisible();
    await expect(page.getByTestId("defect-delete")).toBeVisible();
  });
});

