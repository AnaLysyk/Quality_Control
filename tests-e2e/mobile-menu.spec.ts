import { test, expect } from '@playwright/test';

test('mobile menu opens on small viewport', async ({ page }) => {
  const ports = [3000, 3001];
  let loaded = false;
  for (const port of ports) {
    try {
      await page.goto(`http://localhost:${port}`, { timeout: 5000 });
      loaded = true;
      break;
    } catch (e) {
      // try next port
    }
  }

  if (!loaded) throw new Error('Unable to load app on localhost:3000 or :3001');

  await page.setViewportSize({ width: 375, height: 800 });

  const btn = page.locator('button[aria-label="Abrir menu"]');
  await expect(btn).toBeVisible();
  await btn.click();

  const overlay = page.locator('div.fixed.inset-0.z-50');
  await expect(overlay).toBeVisible({ timeout: 2000 });
});
