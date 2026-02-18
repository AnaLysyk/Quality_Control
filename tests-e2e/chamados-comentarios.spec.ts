import { test, expect } from '@playwright/test';

const admin = { username: 'admin', password: 'admin123' };
const dev = { username: 'dev', password: 'dev123' };

const chamadoTitle = `Chamado comentário ${Date.now()}`;

// Cria chamado como admin, comenta, dev comenta, admin responde

test('Admin e dev trocam comentários em chamado', async ({ page, context }) => {
  // Admin cria chamado
  await page.goto('/login');
  await page.fill('input[name="user"]', admin.username);
  await page.fill('input[name="password"]', admin.password);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.includes('/login'));
  await page.goto('/meus-chamados');
  await page.click('button[aria-label="Criar chamado"]');
  await page.fill('input[placeholder*="Titulo"], input[placeholder*="Título"]', chamadoTitle);
  await page.fill('textarea', 'Chamado para teste de comentários');

  await page.click('button:has-text("Criar"), button:has-text("Salvar chamado")');
  // Aguarda o chamado aparecer na lista, com timeout generoso
  await expect(page.locator(`text=${chamadoTitle}`)).toHaveCount(1, { timeout: 30000 });

  await page.click(`button[aria-label="Abrir detalhes do chamado ${chamadoTitle}"]`);
  // Aguarda o botão da aba de comentários aparecer no modal
  await expect(page.locator('button:has-text("Comentarios")')).toBeVisible({ timeout: 10000 });
  // Pequeno delay para garantir montagem do modal
  await page.waitForTimeout(500);
  // Seleciona a aba de comentários
  await page.click('button:has-text("Comentarios")');
  // Aguarda o conteúdo da aba de comentários aparecer (debug)
  await page.waitForSelector('[data-testid="comments-tab-content"]', { timeout: 10000 });
  // Aguarda o textarea de comentário aparecer
  await page.waitForSelector('[data-testid="comment-textarea"]', { timeout: 10000 });
  // Admin faz comentário
  await page.fill('[data-testid="comment-textarea"]', 'Comentário do admin');
  await page.click('button:has-text("Enviar"), button:has-text("Comentar")');
  await expect(page.locator('text=Comentário do admin')).toHaveCount(1, { timeout: 10000 });

  // Dev entra e comenta
  const devPage = await context.newPage();
  await devPage.goto('/login');
  await devPage.fill('input[name="user"]', dev.username);
  await devPage.fill('input[name="password"]', dev.password);
  await devPage.click('button[type="submit"]');
  await devPage.waitForURL((url) => !url.pathname.includes('/login'));
  await devPage.goto('/kanban-it');
  await devPage.waitForTimeout(2000);
  await expect(devPage.locator(`text=${chamadoTitle}`)).toHaveCount(1, { timeout: 10000 });
  await devPage.click(`button[aria-label="Abrir detalhes do chamado ${chamadoTitle}"]`);
  await devPage.fill('[data-testid="comment-textarea"]', 'Comentário do dev');
  await devPage.click('button:has-text("Enviar"), button:has-text("Comentar")');
  await expect(devPage.locator('text=Comentário do dev')).toHaveCount(1, { timeout: 10000 });

  // Admin responde
  await page.reload();
  await page.click(`button[aria-label="Abrir detalhes do chamado ${chamadoTitle}"]`);
  await page.fill('[data-testid="comment-textarea"]', 'Resposta do admin');
  await page.click('button:has-text("Enviar"), button:has-text("Comentar")');
  await expect(page.locator('text=Resposta do admin')).toHaveCount(1, { timeout: 10000 });

  // Ambos veem todos os comentários
  await page.reload();
  await page.click(`button[aria-label="Abrir detalhes do chamado ${chamadoTitle}"]`);
  await expect(page.locator('text=Comentário do admin')).toHaveCount(1);
  await expect(page.locator('text=Comentário do dev')).toHaveCount(1);
  await expect(page.locator('text=Resposta do admin')).toHaveCount(1);
  await devPage.reload();
  await devPage.click(`button[aria-label="Abrir detalhes do chamado ${chamadoTitle}"]`);
  await expect(devPage.locator('text=Comentário do admin')).toHaveCount(1);
  await expect(devPage.locator('text=Comentário do dev')).toHaveCount(1);
  await expect(devPage.locator('text=Resposta do admin')).toHaveCount(1);
});
