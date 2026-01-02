import { test, expect } from "@playwright/test";

test("fluxo de request: criar, duplicar bloqueado, admin aprova", async ({ page }) => {
  // Usuário cria solicitação
  await page.goto("/login");
  await page.fill('input[name="email"]', "user@example.com");
  await page.fill('input[name="password"]', "senha");
  await page.click('button[type="submit"]');

  await page.goto("/requests");
  await page.fill('input[placeholder*="email"]', "novo@example.com");
  await page.click('button:has-text("Enviar")');
  await expect(page.getByText(/Solicitação de email enviada/i)).toBeVisible();

  // Tentativa duplicada deve falhar (mensagem)
  await page.fill('input[placeholder*="email"]', "outro@example.com");
  await page.click('button:has-text("Enviar")');
  await expect(page.getByText(/pendente/i)).toBeVisible(); // ajuste conforme mensagem de 409

  // Admin aprova
  await page.goto("/login");
  await page.fill('input[name="email"]', "admin@example.com");
  await page.fill('input[name="password"]', "senha");
  await page.click('button[type="submit"]');

  await page.goto("/admin/requests");
  await page.click('button:has-text("Aprovar")');
  await expect(page.getByText(/Aprovado/i)).toBeVisible();
});
