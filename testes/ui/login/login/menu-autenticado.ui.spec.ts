import type { Page } from "@playwright/test";
import { test, expect } from "../../../../support/fixtures/test";
import { autenticarUsuario, configurarUsuarioSimulado } from "../../../../support/functions/ui/apoio/autenticar-usuario-teste";

const nav = (page: Page) => page.locator("aside nav").first();

test("admin global only sees admin menu", async ({ page }) => {
  await configurarUsuarioSimulado(page, "admin");
  await autenticarUsuario(page, "admin@example.com", "senha");

  await expect(page).toHaveURL(/\/admin\/clients/);

  const sidebar = nav(page);
  await expect(sidebar.getByRole("link", { name: /^Dashboard$/i })).toHaveCount(1);
  await expect(sidebar.getByRole("link", { name: /^Runs$/ })).toHaveCount(0);
  await expect(sidebar.getByRole("link", { name: /^Aplic/ })).toHaveCount(0);
});

test("admin sees company menu inside company context", async ({ page }) => {
  await configurarUsuarioSimulado(page, "admin", "DEMO");
  await autenticarUsuario(page, "admin@example.com", "senha");

  await page.goto("/empresas/demo/dashboard");
  await expect(page).toHaveURL(/\/empresas\/demo\/dashboard/);

  const sidebar = nav(page);
  await expect(sidebar.getByRole("link", { name: /Dashboard/i })).toHaveCount(1);
  await expect(sidebar.getByRole("link", { name: /^Operação$/ })).toHaveCount(1);
  await expect(sidebar.getByRole("link", { name: /^Aplic/ })).toHaveCount(1);
  await expect(sidebar.getByRole("link", { name: /Empresas/i })).toHaveCount(0);
});

test("client user lands in company and cannot access admin", async ({ page }) => {
  await configurarUsuarioSimulado(page, "user", "DEMO");
  await autenticarUsuario(page, "user@example.com", "senha");

  await expect(page).toHaveURL(/\/empresas\/demo\/dashboard/);

  const sidebar = nav(page);
  await expect(sidebar.getByRole("link", { name: /^Operação$/ })).toHaveCount(1);
  await expect(sidebar.getByRole("link", { name: /^Aplic/ })).toHaveCount(1);
  await expect(sidebar.getByRole("link", { name: /Empresas/i })).toHaveCount(0);

  await page.goto("/admin/clients");
  await expect(page).not.toHaveURL(/\/admin\/clients/);
  await expect(page.getByRole("heading", { name: /Demo|Dashboard|Home/i }).first()).toBeVisible();
});
