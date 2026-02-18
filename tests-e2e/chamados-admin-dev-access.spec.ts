import { test, expect } from '@playwright/test';

const admin = { username: 'admin', password: 'admin123' };
const dev = { username: 'dev', password: 'dev123' };

const chamadoTitle = `Automated chamado admin-${Date.now()}`;

// 1. Admin cria chamado e tenta movimentar (não pode)
test('Admin cria chamado e não pode movimentar', async ({ page }) => {
  // Login admin
  await page.goto('/login');
  await page.fill('input[name="user"]', admin.username);
  await page.fill('input[name="password"]', admin.password);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.includes('/login'));


  // Criar chamado
  await page.goto('/meus-chamados');
  await page.click('button[aria-label="Criar chamado"]');
  await page.fill('input[placeholder*="Titulo"], input[placeholder*="Título"]', chamadoTitle);
  await page.fill('textarea', 'Descrição teste admin');
  await page.click('button:has-text("Criar"), button:has-text("Salvar chamado")');
  // Espera extra para garantir renderização e persistência
  await page.waitForTimeout(4000);
  await page.reload();
  await page.waitForTimeout(2000);
  // Screenshot para debug
  await page.screenshot({ path: 'admin-chamado-list.png', fullPage: true });
  await expect(page.locator(`text=${chamadoTitle}`)).toHaveCount(1, { timeout: 15000 });

  // Tentar movimentar (mudar status)
  await page.click(`text=${chamadoTitle}`);
  const canMove = await page.locator('button[aria-label*="status"],button:has-text("Mover"),button:has-text("Status")').isVisible().catch(() => false);
  expect(canMove).toBeFalsy();
});

// 2. Dev acessa chamado do admin e movimenta
test('Dev movimenta chamado criado pelo admin', async ({ page }) => {
  // Login dev
  await page.goto('/login');
  await page.fill('input[name="user"]', dev.username);
  await page.fill('input[name="password"]', dev.password);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.includes('/login'));

  // Procurar chamado criado pelo admin
  await page.goto('/kanban-it');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'dev-kanban-list.png', fullPage: true });
  await expect(page.locator(`text=${chamadoTitle}`)).toHaveCount(1, { timeout: 10000 });
  await page.click(`text=${chamadoTitle}`);

  // Botão de movimentar/status deve estar visível
  const canMove = await page.locator('button[aria-label*="status"],button:has-text("Mover"),button:has-text("Status")').isVisible().catch(() => false);
  expect(canMove).toBeTruthy();

  if (canMove) {
    await page.click('button[aria-label*="status"],button:has-text("Mover"),button:has-text("Status")');
    await page.click('text=Em andamento');
    await expect(page.locator('text=Em andamento')).toHaveCount(1, { timeout: 5000 });
  }
});
