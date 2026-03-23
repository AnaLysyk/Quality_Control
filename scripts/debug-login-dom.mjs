import { chromium } from 'playwright';

(async () => {
  const base = 'http://localhost:3000';
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  try {
    await page.goto(`${base}/login`, { timeout: 30000, waitUntil: 'domcontentloaded' });
    await page.fill('#user', 'admin@griaule.test');
    await page.fill('#password', 'Griaule@123');
    await Promise.all([page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }), page.click('button[type=submit]')]).catch(() => {});
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
