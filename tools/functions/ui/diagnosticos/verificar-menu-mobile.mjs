import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const ports = [3000, 3001];
  let loaded = false;
  for (const port of ports) {
    try {
      // try root and admin routes to ensure AppShell renders
      const paths = ['/', '/admin/home', '/admin/clients'];
      for (const p of paths) {
        try {
          await page.goto(`http://localhost:${port}${p}`, { timeout: 5000 });
          loaded = true;
          console.log('Loaded at port', port, 'path', p);
          break;
        } catch (e) {
          // try next path
        }
      }
      if (loaded) break;
    } catch (e) {
      // try next
    }
  }

  if (!loaded) {
    console.error('Unable to load app on localhost:3000 or :3001');
    await browser.close();
    process.exitCode = 2;
    return;
  }

  await page.setViewportSize({ width: 375, height: 800 });

  const btn = page.locator('button[aria-label="Abrir menu"]');
  if (!(await btn.isVisible())) {
    console.error('Menu button not visible');
    await browser.close();
    process.exitCode = 3;
    return;
  }

  await btn.click();

  const overlay = page.locator('div.fixed.inset-0.z-50');
  const visible = await overlay.isVisible().catch(() => false);
  console.log('Overlay visible:', visible);

  await browser.close();
  process.exitCode = visible ? 0 : 4;
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
