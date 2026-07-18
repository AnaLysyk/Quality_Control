import { chromium } from 'playwright';

(async () => {
  const base = 'http://localhost:3000';
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  try {
    await page.goto(`${base}/login`, { timeout: 30000, waitUntil: 'domcontentloaded' });
    await page.locator('#user').fill('admin@griaule.test');
    await page.locator('#password').fill((process.env.E2E_ADMIN_PASSWORD || process.env.E2E_PROFILE_PASSWORD || "Demo@123"));
    await page.locator('button[type="submit"]').click().catch(() => {});
    await page.waitForURL('**/*', { timeout: 30000 }).catch(() => {});
    try { await page.goto(`${base}/admin/home`, { timeout: 15000, waitUntil: 'domcontentloaded' }); } catch (e) {}
    const html = await page.content();
    const fs = await import('fs');
    fs.writeFileSync('debug-admin-home.html', html);
    console.log('Wrote debug-admin-home.html (length:', html.length, ')');
  } catch (e) {
    console.error('error', e.message || e);
  } finally {
    await browser.close();
  }
})();
