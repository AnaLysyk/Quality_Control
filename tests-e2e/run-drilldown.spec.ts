import { test, expect } from '@playwright/test';
import { mockAuth } from './utils/mockAuth';
 
test.beforeEach(async ({ page }) => {
  await page.addStyleTag({ content: `
    .sidebar-shell, .sidebar-link, .sidebar-label {
      display: none !important;
      pointer-events: none !important;
      opacity: 0 !important;
      z-index: -1 !important;
      visibility: hidden !important;
    }
  ` });
  await page.evaluate(() => {
    document.querySelectorAll('.sidebar-shell').forEach(el => el.remove());
    document.querySelectorAll('.sidebar-link').forEach(el => el.remove());
    document.querySelectorAll('.sidebar-label').forEach(el => el.remove());
    // @ts-ignore
    window._e2eSidebarRemoved = true;
  });
  // Debug: confirm removal
  const removed = await page.evaluate(() => !!window._e2eSidebarRemoved);
  if (!removed) console.warn('Sidebar not removed!');
});

// Bloco 14: Drill-down de Run para Defeitos
// Este teste valida que o usuário pode clicar em uma run na tabela de qualidade e ver a lista de defeitos filtrada por run, com indicador de filtro ativo.

test.describe('Drill-down de Run para Defeitos', () => {
  test('Deve navegar da run para defeitos filtrados e mostrar indicador', async ({ page, context }) => {
    await mockAuth(context, {
      role: 'admin',
      companies: ['griaule'],
    });
    // Acessa o dashboard de uma empresa (ajuste o slug conforme necessário)
    await page.goto('/empresas/griaule/dashboard', { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    // Aguarda a tabela de qualidade de runs
    await page.getByTestId('runs-quality-table').waitFor({ timeout: 10000 });
    // Clica no link da primeira run
    const runLink = await page.getByTestId('run-drilldown-link').first();
    const runName = await runLink.textContent();
    // Remove sidebar overlays right before click
    await page.evaluate(() => {
      document.querySelectorAll('.sidebar-shell').forEach(el => el.remove());
      document.querySelectorAll('.sidebar-link').forEach(el => el.remove());
      document.querySelectorAll('.sidebar-label').forEach(el => el.remove());
    });
    await runLink.click();
    await page.waitForTimeout(500);
    // Deve navegar para a lista de defeitos filtrada por run
    await expect(page).toHaveURL(/\/empresas\/griaule\/defeitos\?run=/, { timeout: 10000 });
    await page.getByTestId('defects-list').waitFor({ timeout: 10000 });
    // Deve mostrar o indicador de filtro ativo
    const filterIndicator = await page.getByText(/Filtro ativo:/);
    await expect(filterIndicator).toBeVisible({ timeout: 10000 });
    await expect(filterIndicator).toContainText(runName || '');

    // Deve haver pelo menos um defeito listado (se houver para a run)
    // Se não houver, a mensagem de "Nenhum defeito encontrado" deve aparecer
    const defects = await page.getByTestId(/defect-item-/).all();
    if (defects.length > 0) {
      for (const defect of defects) {
        await expect(defect).toBeVisible();
      }
    } else {
      await expect(page.getByText('Nenhum defeito encontrado.')).toBeVisible();
    }

    // Remove o filtro
    const removeBtn = await page.getByRole('button', { name: /Remover filtro/ });
    await removeBtn.click();
    await expect(page).not.toHaveURL(/run=/);
  });
});
