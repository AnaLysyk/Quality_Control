import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1600, height: 1100 } });
  await context.request.post("http://127.0.0.1:3000/api/auth/login", {
    data: { user: "admin@griaule.test", password: "Griaule@123", clientSlug: "griaule" },
  });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:3000/admin/users/permissions", { waitUntil: "networkidle", timeout: 120000 });
  await page.screenshot({ path: "tmp/permissions-ui-check.png", fullPage: true });
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
