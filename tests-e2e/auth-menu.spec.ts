import { test, expect } from "@playwright/test";

test("menu condicional - user vs admin", async ({ page }) => {
  // Pré: login usuário comum (ajuste a rota/login fake conforme seu backend real)
  await page.goto("/login");
  await page.fill('input[name="email"]', "user@example.com");
  await page.fill('input[name="password"]', "senha");
  await page.click('button[type="submit"]');

  await expect(page).toHaveURL(/\/dashboard/);
  await page.click('button:has-text("Usuário")'); // avatar/menu
  await expect(page.getByText("Configurações")).toBeVisible();
  await expect(page.getByText("Administração")).toHaveCount(0);

  // Pré: login admin global (pode ser outro fluxo/rota)
  await page.goto("/login");
  await page.fill('input[name="email"]', "admin@example.com");
  await page.fill('input[name="password"]', "senha");
  await page.click('button[type="submit"]');

  await page.click('button:has-text("Admin")');
  await expect(page.getByText("Administração")).toBeVisible();
  await expect(page.getByText("Equipe")).toBeVisible();
});
