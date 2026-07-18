import { test, expect } from "@playwright/test";
import { simularAutenticacao } from "../../../tools/functions/ui/apoio/simular-autenticacao";

test("user não acessa /admin", async ({ page, context }) => {
  await simularAutenticacao(context, {
    role: "user",
    companies: ["DEMO"],
  });

  await page.goto("/admin", { waitUntil: "domcontentloaded" });

  await expect(page).toHaveURL(/\/user\/home|\/empresas/);
});

