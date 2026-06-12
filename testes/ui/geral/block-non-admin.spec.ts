import { test, expect } from "@playwright/test";
import { simularAutenticacao } from "../../../support/functions/interface/apoio/simular-autenticacao";

test("user nÃ£o acessa /admin", async ({ page, context }) => {
  await simularAutenticacao(context, {
    role: "user",
    companies: ["DEMO"],
  });

  await page.goto("/admin", { waitUntil: "domcontentloaded" });

  await expect(page).toHaveURL(/\/user\/home|\/empresas/);
});
