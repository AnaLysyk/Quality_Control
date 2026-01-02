import { test, expect } from "@playwright/test";

test("admin global vê lista de clientes", async ({ page }) => {
  await page.goto("/login");
  await page.fill('input[name="email"]', "admin@example.com");
  await page.fill('input[name="password"]', "senha");
  await page.click('button[type="submit"]');

  await page.goto("/admin/clients");
  await expect(page).toHaveURL(/\/admin\/clients/);
  await expect(page.getByRole("heading", { name: /Clientes/i })).toBeVisible();
});

test("user comum não acessa /admin/clients", async ({ page }) => {
  await page.goto("/login");
  await page.fill('input[name="email"]', "user@example.com");
  await page.fill('input[name="password"]', "senha");
  await page.click('button[type="submit"]');

  await page.goto("/admin/clients");
  await expect(page.getByText(/sem permissão/i)).toBeVisible();
});
