import { test, expect } from "@playwright/test";
import { simularAutenticacao } from "../../../support/functions/ui/apoio/simular-autenticacao";
import { criarDefeitoManual } from "../../../support/functions/ui/apoio/operar-dashboard-e-defeitos";

const DEFECTS_URL = "/empresas/demo/defeitos";

test.describe("rbac - defeitos", () => {
  test("user não vÃƒª açÃƒµes protegidas", async ({ page, context }) => {
    await simularAutenticacao(context, { role: "user", companies: ["DEMO"], clientSlug: "DEMO" });

    await page.goto(DEFECTS_URL, { waitUntil: "domcontentloaded" });

    await expect(page.getByTestId("defect-delete")).toHaveCount(0);
  });

  test("company vÃƒª editar/link em defeito manual, mas não delete", async ({ page, context }) => {
    await simularAutenticacao(context, { role: "company", companies: ["DEMO"], clientSlug: "DEMO" });

    await page.goto(DEFECTS_URL, { waitUntil: "domcontentloaded" });

    // garante um defeito manual para checar botÃƒµes
    await page.getByTestId("defect-title").fill("Defeito manual - company");
    await page.getByTestId("defect-create").click();

    await expect(page.getByTestId("defect-save")).toBeVisible();
    await expect(page.getByTestId("defect-delete")).toHaveCount(0);
  });

  test("admin vÃƒª todas as açÃƒµes", async ({ page, context }) => {
    await simularAutenticacao(context, { role: "admin", companies: ["DEMO"], clientSlug: "DEMO" });

    await page.goto(DEFECTS_URL, { waitUntil: "domcontentloaded" });

    // garante um defeito manual para checar botÃƒµes
    await page.getByTestId("defect-title").fill("Defeito manual - admin");
    await page.getByTestId("defect-create").click();

    await expect(page.getByTestId("defect-save")).toBeVisible();
    await expect(page.getByTestId("defect-delete")).toBeVisible();
  });
});

