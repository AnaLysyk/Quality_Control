import { test, expect } from './fixtures/test';
import { setMockUser } from './utils/auth';

// Bloco 22: Benchmark entre empresas (admin-only)
test.describe('Admin Benchmark', () => {
  test('deve bloquear acesso para não-admin', async ({ page }) => {
    await setMockUser(page, 'user');
    await page.goto('/admin/benchmark');
    // Espera mensagem de acesso restrito
    await page.getByText(/Acesso restrito ao admin/).waitFor({ state: 'visible', timeout: 10000 });
  });

  test('deve exibir ranking de empresas para admin', async ({ page }) => {
    await setMockUser(page, 'admin');
    await page.goto('/admin/benchmark');
    await expect(page.getByTestId('nav-benchmark')).toBeVisible();
    await expect(page.getByTestId('benchmark-card').first()).toBeVisible();
    await expect(page.getByTestId('benchmark-company').first()).toBeVisible();
    await expect(page.getByTestId('benchmark-score').first()).toBeVisible();
    await expect(page.getByTestId('benchmark-risk').first()).toBeVisible();
  });
});
