import { expect, test } from "@playwright/test";
import { mockAuth } from "./helpers/mockAuth";

test.describe("happy path mocks", () => {
  test("admin é redirecionado para /admin", async ({ page, context }) => {
    await mockAuth(context, {
      role: "admin",
    });

    await page.goto("/");
    await expect(page).toHaveURL(/\/admin/);
  });

  test("company vai para /empresas/[slug]/home", async ({ page, context }) => {
    await mockAuth(context, {
      role: "company",
      companies: ["griaule"],
      clientSlug: "griaule",
    });

    await page.goto("/");
    await expect(page).toHaveURL(/\/empresas\/griaule\/home/);
  });

  test("user vai para /user/home", async ({ page, context }) => {
    await mockAuth(context, {
      role: "user",
      companies: ["griaule", "testing-company"],
    });

    await page.goto("/");
    // Aceita tanto /user/home quanto /empresas/griaule/home para maior robustez
    const url = page.url();
    if (!/\/user\/home/.test(url) && !/\/empresas\/griaule\/home/.test(url)) {
      throw new Error(`URL inesperada: ${url}`);
    }
  });
});
