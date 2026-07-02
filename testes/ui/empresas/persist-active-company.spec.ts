import { test, expect } from "@playwright/test";
import { simularAutenticacao } from "../../../support/functions/ui/apoio/simular-autenticacao";

test("empresa ativa persiste após reload", async ({ page, context }) => {
  await simularAutenticacao(context, {
    role: "admin",
    companies: ["empresa-e2e", "testing-company"],
    clientSlug: "testing-company",
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForURL(/\/lider-tc\/testing-company\/home/, { timeout: 30000 });
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/lider-tc\/testing-company\/home/);
});

