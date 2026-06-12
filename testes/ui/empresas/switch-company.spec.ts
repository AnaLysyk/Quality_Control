import { test } from "@playwright/test";
import { simularAutenticacao } from "../../../support/functions/interface/apoio/simular-autenticacao";

test("admin seleciona empresa no dashboard global", async ({ page, context }) => {
  await simularAutenticacao(context, {
    role: "admin",
    companies: ["DEMO", "testing-company"],
    clientSlug: "DEMO",
  });

  await page.goto("/admin/dashboard", { waitUntil: "domcontentloaded" });

  const companyButton = page.getByRole("button", { name: /Testing Company|Griaule|Demo/i }).first();
  await expect(companyButton).toBeVisible({ timeout: 20000 });
  await companyButton.click();

  await expect(page.getByText(/Empresa selecionada|Painel admin/i).first()).toBeVisible();
});
