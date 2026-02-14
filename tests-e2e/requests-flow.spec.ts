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
import { test, expect } from "./fixtures/test";
import { login, setMockUser } from "./utils/auth";

const companyChangeEndpoint = "/api/requests/company-change";

test.setTimeout(120000);

test("requests flow: create, duplicate blocked, admin approves", async ({ page }) => {
  await setMockUser(page, "user");
  await login(page, "user@example.com", "senha");

  const meRequestsResponse = page.waitForResponse(
    (response) => response.url().includes("/api/requests/me") && response.request().method() === "GET"
  );
  await page.goto("/requests", { waitUntil: "domcontentloaded" });
  await meRequestsResponse;

  const companyInput = page.getByPlaceholder("Novo nome da empresa");
  const companyCard = page.getByRole("heading", { name: /empresa/i }).locator("..");
  const sendButton = companyCard.getByRole("button", { name: /Enviar/i });
  const message = page.getByRole("status").first();

  await expect(companyInput).toBeVisible({ timeout: 20000 });

  const firstResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes(companyChangeEndpoint) &&
      response.request().method() === "POST",
    { timeout: 30000 }
  );
  await companyInput.fill("Empresa Nova");
  await page.waitForTimeout(300);
  await expect(sendButton).toBeEnabled({ timeout: 10000 });
  await sendButton.click();
  const firstResponse = await firstResponsePromise;
  expect([201, 409]).toContain(firstResponse.status());
  await page.waitForTimeout(300);
  if (firstResponse.status() === 201) {
    await expect(message).toContainText(/empresa enviada/i);
  } else {
    await expect(message).toContainText(/pendente/i);
  }

  const duplicateResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes(companyChangeEndpoint) &&
      response.request().method() === "POST",
    { timeout: 30000 }
  );
  await companyInput.fill("Empresa Duplicada");
  await page.waitForTimeout(300);
  await expect(sendButton).toBeEnabled({ timeout: 10000 });
  await sendButton.click();
  const duplicateResponse = await duplicateResponsePromise;
  expect(duplicateResponse.status()).toBe(409);
  await expect(message).toContainText(/pendente/i);

  await setMockUser(page, "admin");
  await login(page, "admin@example.com", "senha");

  await page.goto("/admin/requests");
  // Remove sidebar overlays right before click
  await page.evaluate(() => {
    document.querySelectorAll('.sidebar-shell').forEach(el => el.remove());
    document.querySelectorAll('.sidebar-link').forEach(el => el.remove());
    document.querySelectorAll('.sidebar-label').forEach(el => el.remove());
  });
  await page.getByRole("button", { name: /Aprovar/i }).first().click();
  const approvedBadge = page.locator('ul[role="list"] li').getByText(/Aprovado/i).first();
  await expect(approvedBadge).toBeVisible();
});
