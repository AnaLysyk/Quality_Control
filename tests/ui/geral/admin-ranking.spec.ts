import { test, expect } from "@playwright/test";
import { simularAutenticacao } from "../../../tools/functions/ui/apoio/simular-autenticacao";

test("admin ve ranking de empresas", async ({ page, context }) => {
  await simularAutenticacao(context, {
    role: "admin",
    companies: ["griaule", "testing-company"],
  });

  await page.goto("/admin/dashboard", { waitUntil: "networkidle" });

  await expect(page.getByText(/Ranking de qualidade por empresa/i)).toBeVisible({ timeout: 20000 });
  await expect(page.getByText(/Comparativo operacional do ambiente/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /Abrir contexto/i }).first()).toBeVisible();
});

