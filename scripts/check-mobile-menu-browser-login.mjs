import { chromium } from 'playwright';

const ports = [3000, 3001];
const adminUser = { user: 'admin@griaule.test', password: 'Griaule@123' };

async function tryPort(port) {
  const base = `http://localhost:${port}`;
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    console.log('Visiting', `${base}/login`);
    await page.goto(`${base}/login`, { timeout: 30000, waitUntil: 'domcontentloaded' });
    await page.setViewportSize({ width: 375, height: 800 });

    // fill login form
    const userInput = page.locator('#user');
    const passInput = page.locator('#password');
    const submit = page.locator('button[type="submit"]');

    if (!(await userInput.isVisible()) || !(await passInput.isVisible())) {
      console.warn('Login inputs not visible at', base);
      await browser.close();
      return { ok: false, reason: 'no-login-form' };
    }

    await userInput.fill(adminUser.user);
    await passInput.fill(adminUser.password);
    await Promise.all([
      page.waitForNavigation({ timeout: 30000, waitUntil: 'domcontentloaded' }),
      submit.click(),
    ]).catch(() => {});

    // After login, try visiting admin/home in case redirect didn't happen
    try {
      await page.goto(`${base}/admin/home`, { timeout: 15000, waitUntil: 'domcontentloaded' });
    } catch (e) {
      // ignore
    }

    const btn = page.locator('button[aria-label="Abrir menu"]');
    const visible = await btn.isVisible().catch(() => false);
    if (!visible) {
      console.error('Menu button not visible after browser login at', base);
      await browser.close();
      return { ok: false, reason: 'menu-button-missing' };
    }

    await btn.click();
    await page.waitForTimeout(600);
    const overlay = page.locator('div.fixed.inset-0.z-50');
    const overlayVisible = await overlay.isVisible().catch(() => false);
    console.log('Overlay visible at', base, overlayVisible);
    await browser.close();
    return { ok: overlayVisible };
  } catch (e) {
    console.warn('Error testing', base, e.message || e);
    await browser.close();
    return { ok: false, reason: e.message };
  }
}

(async () => {
  for (const port of ports) {
    const res = await tryPort(port);
    if (res.ok) {
      console.log('Success at port', port);
      process.exit(0);
    } else {
      console.log('Failed at port', port, res.reason || 'unknown');
    }
  }
  console.error('All ports failed');
  process.exit(1);
})();
