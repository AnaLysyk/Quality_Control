import { test, expect } from "@playwright/test";
import { simularAutenticacao } from "../../../support/functions/ui/apoio/simular-autenticacao";

test("empresa ativa persiste apÃ³s reload", async ({ page, context }) => {
  await simularAutenticacao(context, {
    role: "admin",
    companies: ["DEMO", "testing-company"],
    clientSlug: "testing-company",
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForURL(/\/admin\/dashboard/, { timeout: 20000 });
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/admin\/dashboard/);
});
