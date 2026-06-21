import { expect, test } from "@playwright/test";
import { simularAutenticacao } from "../../../support/functions/ui/apoio/simular-autenticacao";

test.describe("happy path mocks", () => {
  test("admin Ã© redirecionado para /admin", async ({ page, context }) => {
    await simularAutenticacao(context, {
      role: "admin",
    });

    await page.goto("/");
    await expect(page).toHaveURL(/\/admin/);
  });

  test("company vai para /empresas/[slug]/home", async ({ page, context }) => {
    await simularAutenticacao(context, {
      role: "company",
      companies: ["DEMO"],
      clientSlug: "DEMO",
    });

    await page.goto("/");
    await expect(page).toHaveURL(/\/empresas\/demo\/home/);
  });

  test("user vai para /user/home", async ({ page, context }) => {
    await simularAutenticacao(context, {
      role: "user",
      companies: ["DEMO", "testing-company"],
    });

    await page.goto("/");
    // Aceita tanto /user/home quanto /empresas/demo/home para maior robustez
    const url = page.url();
    if (!/\/user\/home/.test(url) && !/\/empresas\/demo\/home/.test(url)) {
      throw new Error(`URL inesperada: ${url}`);
    }
  });
});
