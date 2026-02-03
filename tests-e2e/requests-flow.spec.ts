import { test, expect } from "./fixtures/test";
import { login, setMockUser } from "./utils/auth";

const companyChangeEndpoint = "/api/requests/company-change";

test("requests flow: create, duplicate blocked, admin approves", async ({ page }) => {
  await setMockUser(page, "user");
  await login(page, "user@example.com", "senha");

  await page.goto("/requests");

  const companyInput = page.getByPlaceholder("Novo nome da empresa");
  const companyCard = page.getByRole("heading", { name: /empresa/i }).locator("..");
  const sendButton = companyCard.getByRole("button", { name: /Enviar/i });
  const message = page.getByRole("status").first();

  const firstResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes(companyChangeEndpoint) &&
      response.request().method() === "POST"
  );
  await companyInput.fill("Empresa Nova");
  await page.waitForTimeout(300);
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
      response.request().method() === "POST"
  );
  await companyInput.fill("Empresa Duplicada");
  await page.waitForTimeout(300);
  await sendButton.click();
  const duplicateResponse = await duplicateResponsePromise;
  expect(duplicateResponse.status()).toBe(409);
  await expect(message).toContainText(/pendente/i);

  await setMockUser(page, "admin");
  await login(page, "admin@example.com", "senha");

  await page.goto("/admin/requests");
  await page.getByRole("button", { name: /Aprovar/i }).first().click();
  const approvedBadge = page.locator('ul[role="list"] li').getByText(/Aprovado/i).first();
  await expect(approvedBadge).toBeVisible();
});
