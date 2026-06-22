import { test, expect } from "@playwright/test";
import { simularAutenticacao } from "../../../support/functions/ui/apoio/simular-autenticacao";

test.setTimeout(120000);

test("admin seleciona empresa no dashboard global", async ({ page, context }) => {
  await simularAutenticacao(context, {
    role: "admin",
    companies: ["empresa-e2e", "testing-company"],
    clientSlug: "empresa-e2e",
  });

  await page.goto("/admin/dashboard", { waitUntil: "domcontentloaded" });

  const companyButton = page.getByRole("button", { name: /Empresa Cliente E2E/i }).first();
  await expect(companyButton).toBeVisible({ timeout: 45000 });
  await companyButton.click();

  await expect(companyButton).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("heading", { name: "Empresa Cliente E2E" }).first()).toBeVisible();
});
