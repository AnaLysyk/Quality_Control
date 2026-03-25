import { chromium, request as playwrightRequest } from 'playwright';

const adminUser = { email: 'admin@griaule.test', password: 'Griaule@123' };
const ports = [3000, 3001];

function parseSetCookie(setCookie) {
  if (!setCookie) return [];
  const arr = Array.isArray(setCookie) ? setCookie : [setCookie];
  return arr
    .map((s) => {
      const parts = s.split(';').map((p) => p.trim());
      const [namePart, ...attrs] = parts;
      const eq = namePart.indexOf('=');
      if (eq === -1) return null;
      const name = namePart.slice(0, eq).trim();
      const value = namePart.slice(eq + 1).trim();
      const cookie = { name, value, path: '/', httpOnly: false, secure: false, sameSite: 'Lax', expires: undefined };
      for (const attr of attrs) {
        const [k, v] = attr.split('=');
        const key = k.trim().toLowerCase();
        if (key === 'httponly') cookie.httpOnly = true;
        else if (key === 'secure') cookie.secure = true;
        else if (key === 'samesite') cookie.sameSite = v ? v.trim() : 'Lax';
        else if (key === 'path') cookie.path = v ? v.trim() : '/';
        else if (key === 'max-age') {
          const secs = Number(v);
          if (Number.isFinite(secs)) cookie.expires = Math.floor(Date.now() / 1000) + Math.floor(secs);
        } else if (key === 'expires') {
          const date = Date.parse(v);
          if (!Number.isNaN(date)) cookie.expires = Math.floor(date / 1000);
        }
      }
      return cookie;
    })
    .filter(Boolean);
}

async function run() {
  let success = false;
  for (const port of ports) {
    try {
      const base = `http://localhost:${port}`;
      const req = await playwrightRequest.newContext({ baseURL: base, ignoreHTTPSErrors: true });
      console.log('Trying login at', base, '...');
      const res = await req.post('/api/auth/login', { data: { user: adminUser.email, password: adminUser.password } });
      if (!res.ok()) {
        console.warn('Login failed at', base, 'status', res.status());
        await req.dispose();
        continue;
      }
      const setCookie = res.headers()['set-cookie'];
      const cookies = parseSetCookie(setCookie);
      if (!cookies.length) {
        console.warn('No cookies returned at', base);
        await req.dispose();
        continue;
      }
      console.log('Login OK at', base, 'cookies:', cookies.map(c=>c.name).join(','));
      await req.dispose();

      const browser = await chromium.launch();
      const context = await browser.newContext();
      // add cookies to context preserving attributes; Playwright requires either url or domain
      const cookieObjs = cookies.map((c) => {
        const cookie = {
          name: c.name,
          value: c.value,
          url: base,
          path: c.path || '/',
          httpOnly: !!c.httpOnly,
          secure: !!c.secure,
        };
        if (c.sameSite) {
          // Playwright expects 'Lax' | 'Strict' | 'None'
          cookie.sameSite = ['lax', 'strict', 'none'].includes(String(c.sameSite).toLowerCase())
            ? String(c.sameSite).charAt(0).toUpperCase() + String(c.sameSite).slice(1).toLowerCase()
            : 'Lax';
        }
        if (c.expires) cookie.expires = c.expires;
        return cookie;
      });
      await context.addCookies(cookieObjs);
      const page = await context.newPage();

      await page.goto(`${base}/admin/home`, { timeout: 30000, waitUntil: 'domcontentloaded' });
      await page.setViewportSize({ width: 375, height: 800 });

      const btn = page.locator('button[aria-label="Abrir menu"]');
      if (!(await btn.isVisible())) {
        console.error('Menu button not visible after login at', base);
        await browser.close();
        process.exitCode = 3;
        return;
      }

      await btn.click();
      // small delay to let overlay animate/show
      await page.waitForTimeout(600);
      const overlay = page.locator('div.fixed.inset-0.z-50');
      const visible = await overlay.isVisible().catch(() => false);
      console.log('Overlay visible:', visible);

      await browser.close();
      process.exitCode = visible ? 0 : 4;
      success = true;
      break;
    } catch (e) {
      console.warn('Error trying port', port, e.message || e);
    }
  }

  if (!success) {
    console.error('Unable to authenticate and load app on localhost:3000 or :3001');
    process.exitCode = 2;
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
