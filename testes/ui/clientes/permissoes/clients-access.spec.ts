import { test, expect } from "../../../../support/fixtures/test";
import { autenticarUsuario, configurarUsuarioSimulado } from "../../../../support/functions/ui/apoio/autenticar-usuario-teste";

test("admin global sees clients list", async ({ page }) => {
  await configurarUsuarioSimulado(page, "admin");
  await autenticarUsuario(page, "admin@example.com", "senha");

  await page.goto("/admin/clients");
  await expect(page).toHaveURL(/\/admin\/clients/);
  await expect(page.getByRole("heading", { name: /Lista de empresas/i })).toBeVisible();
});

test("user cannot access /admin/clients", async ({ page }) => {
  await configurarUsuarioSimulado(page, "user", "DEMO");
  await autenticarUsuario(page, "user@example.com", "senha");

  await page.goto("/admin/clients");
  await expect(page).not.toHaveURL(/\/admin\/clients/);
  await expect(page.getByRole("heading", { name: /Demo|Dashboard|Home/i }).first()).toBeVisible();
});

