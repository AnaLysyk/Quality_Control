import { test, expect } from '@playwright/test';

const profiles = [
  { name: 'admin', username: 'admin@example.com', password: 'admin123' },
  { name: 'it_dev', username: 'itdev@example.com', password: 'itdev123' },
  { name: 'client', username: 'client@example.com', password: 'client123' },
  { name: 'user', username: 'user@example.com', password: 'user123' },
];

const chamadoTitle = (profile: string, mode: string) => `Teste chamado (${profile} - ${mode})`;

for (const profile of profiles) {
  for (const mode of ['kanban', 'meus-chamados']) {
    test(`Criar chamado como ${profile.name} via ${mode}`, async ({ page }) => {
      // Login
      await page.goto('/login');
      await page.fill('input[name="email"]', profile.username);
      await page.fill('input[name="password"]', profile.password);
      await page.click('button[type="submit"]');
      await page.waitForURL((url) => !url.pathname.includes('/login'));

      if (mode === 'kanban') {
        await page.goto('/kanban-it');
        // Botão flutuante
        await page.click('button[aria-label="Criar chamado"]');
      } else {
        await page.goto('/meus-chamados');
        // Botão flutuante
        await page.click('button[aria-label="Criar chamado"]');
      }

      // Preencher formulário
      await page.fill('input[placeholder*="Titulo"], input[placeholder*="Título"]', chamadoTitle(profile.name, mode));
      await page.fill('textarea', 'Descrição automática de teste');
      // Salvar chamado
      await page.click('button:has-text("Criar"), button:has-text("Salvar chamado")');
      // Verificar sucesso
      await expect(page.locator('text=chamado criado')).not.toHaveCount(1, { timeout: 2000 }); // Não deve aparecer erro
      // Verificar se aparece na lista
      await expect(page.locator(`text=${chamadoTitle(profile.name, mode)}`)).toHaveCount(1, { timeout: 5000 });
    });
  }
}
