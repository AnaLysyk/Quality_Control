import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { login, setMockUser } from "./utils/auth";

const nav = (page: Page) => page.locator("aside nav").first();

test("admin global only sees admin menu", async ({ page }) => {
  await setMockUser(page, "admin");
  await login(page, "admin@example.com", "senha");

  await expect(page).toHaveURL(/\/admin\/clients/);

  const sidebar = nav(page);
  await expect(sidebar.getByRole("link", { name: /Painel Admin/i })).toHaveCount(1);
  await expect(sidebar.getByRole("link", { name: /^Runs$/ })).toHaveCount(0);
  await expect(sidebar.getByRole("link", { name: /^Aplic/ })).toHaveCount(0);
});

test("admin sees company menu inside company context", async ({ page }) => {
  await setMockUser(page, "admin", "griaule");
  await login(page, "admin@example.com", "senha");

  await page.goto("/empresas/griaule/dashboard");
  await expect(page).toHaveURL(/\/empresas\/griaule\/dashboard/);

  const sidebar = nav(page);
  await expect(sidebar.getByRole("link", { name: /Dashboard/i })).toHaveCount(1);
  await expect(sidebar.getByRole("link", { name: /^Runs$/ })).toHaveCount(1);
  await expect(sidebar.getByRole("link", { name: /^Aplic/ })).toHaveCount(1);
  await expect(sidebar.getByRole("link", { name: /Painel Admin/i })).toHaveCount(0);
});

test("client user lands in company and cannot access admin", async ({ page }) => {
  await setMockUser(page, "user", "griaule");
  await login(page, "user@example.com", "senha");

  await expect(page).toHaveURL(/\/empresas\/griaule\/dashboard/);

  const sidebar = nav(page);
  await expect(sidebar.getByRole("link", { name: /^Runs$/ })).toHaveCount(1);
  await expect(sidebar.getByRole("link", { name: /^Aplic/ })).toHaveCount(1);
  await expect(sidebar.getByRole("link", { name: /Painel Admin/i })).toHaveCount(0);

  await page.goto("/admin/clients");
  await expect(page.getByText(/Acesso restrito a admin global/i)).toBeVisible();
});
