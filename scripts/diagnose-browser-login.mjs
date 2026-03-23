import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE = process.env.BASE || 'http://localhost:3002';
const adminUser = { user: 'admin@griaule.test', password: 'Griaule@123' };
const outDir = path.resolve(process.cwd(), 'debug', 'diagnose-browser-login');

function ensureDir(d) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

(async () => {
  ensureDir(outDir);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const consoleLogs = [];
  const network = [];

  page.on('console', (m) => {
    try {
      consoleLogs.push({ type: m.type(), text: m.text(), location: m.location() });
    } catch (e) {
      consoleLogs.push({ type: 'error', text: String(e) });
    }
  });

  page.on('request', (req) => {
    network.push({ type: 'request', url: req.url(), method: req.method(), headers: req.headers(), postData: req.postData() });
  });

  page.on('response', async (res) => {
    try {
      network.push({ type: 'response', url: res.url(), status: res.status(), headers: res.headers(), fromCache: res.fromCache() });
    } catch (e) {
      network.push({ type: 'response', url: res.url(), error: String(e) });
    }
  });

  page.on('requestfailed', (req) => {
    network.push({ type: 'requestfailed', url: req.url(), failure: req.failure()?.errorText || null });
  });

  try {
    console.log('Visiting', `${BASE}/login`);
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.setViewportSize({ width: 375, height: 800 });

    // fill login form
    const userInput = page.locator('#user');
    const passInput = page.locator('#password');
    const submit = page.locator('button[type="submit"]');

    if (!(await userInput.isVisible().catch(() => false)) || !(await passInput.isVisible().catch(() => false))) {
      console.warn('Login inputs not visible');
    } else {
      await userInput.fill(adminUser.user).catch(() => {});
      await passInput.fill(adminUser.password).catch(() => {});
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {}),
        submit.click().catch(() => {}),
      ]);
    }

    // try loading admin home
    await page.goto(`${BASE}/admin/home`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});

    // wait a bit for client scripts to load
    await page.waitForTimeout(2000);

    const html = await page.content();
    fs.writeFileSync(path.join(outDir, 'page.html'), html, 'utf8');
    await page.screenshot({ path: path.join(outDir, 'screenshot.png'), fullPage: true }).catch(() => {});

    fs.writeFileSync(path.join(outDir, 'console.json'), JSON.stringify(consoleLogs, null, 2), 'utf8');
    fs.writeFileSync(path.join(outDir, 'network.json'), JSON.stringify(network, null, 2), 'utf8');

    console.log('Saved diagnostics to', outDir);
  } catch (err) {
    console.error('Error during diagnosis:', err);
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
