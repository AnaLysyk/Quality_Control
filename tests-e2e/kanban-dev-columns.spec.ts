import { test, expect } from '@playwright/test';

const dev = { username: 'dev', password: 'dev123' };

test('Dev pode adicionar e remover coluna no kanban', async ({ page }) => {
  // Login dev
  await page.goto('/login');
  await page.fill('input[name="user"]', dev.username);
  await page.fill('input[name="password"]', dev.password);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.includes('/login'));

  // Vai para o kanban
  await page.goto('/kanban-it');
  await page.waitForTimeout(2000);

  // Conta colunas antes
  const columnsBefore = await page.locator('section > div > div[role="gridcell"], section > div > div').count();

  // Adiciona coluna
  await page.click('button:has-text("+ Coluna")');
  const input = page.locator('input[placeholder="Nome da coluna"]');
  await input.waitFor({ state: 'visible', timeout: 5000 });
  await input.fill('Automatizada');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1000);


  // Verifica coluna criada
  await expect(page.locator('button:has-text("Automatizada")')).toHaveCount(1);

  // Remove coluna (edit mode, esvaziar nome e pressionar Enter)
  await page.click('button:has-text("Automatizada")');
  await page.fill('input[placeholder="Nome da coluna"]', '');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1000);

  // Coluna removida
  await expect(page.locator('button:has-text("Automatizada")')).toHaveCount(0);

  // Persiste após reload
  await page.reload();
  await page.waitForTimeout(1000);
  await expect(page.locator('button:has-text("Automatizada")')).toHaveCount(0);

  // Colunas voltam ao número original
  const columnsAfter = await page.locator('section > div > div[role="gridcell"], section > div > div').count();
  expect(columnsAfter).toBe(columnsBefore);
});
