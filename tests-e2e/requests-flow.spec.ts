import { test, expect } from "./fixtures/test";
import { login, setMockUser } from "./utils/auth";

const companyChangeEndpoint = "/api/requests/company-change";

test.setTimeout(120000);

test("requests flow: create, duplicate blocked, admin reviews queue", async ({ page }) => {
  await setMockUser(page, "user");
  await login(page, "user@example.com", "senha");

  const meRequestsResponse = page.waitForResponse(
    (response) => response.url().includes("/api/requests/me") && response.request().method() === "GET",
  );
  await page.goto("/requests", { waitUntil: "domcontentloaded" });
  await meRequestsResponse;

  const companyInput = page.getByPlaceholder(/Nome da empresa|Company name/i);
  const companyCard = page.locator("section").filter({ has: page.getByRole("heading", { name: /troca de empresa|company/i }) }).first();
  const sendButton = companyCard.getByRole("button", { name: /Enviar solicitação|Send request/i });

  await expect(companyInput).toBeVisible({ timeout: 20000 });

  const firstResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes(companyChangeEndpoint) &&
      response.request().method() === "POST",
    { timeout: 30000 },
  );
  await companyInput.fill("Empresa Nova");
  await expect(sendButton).toBeEnabled({ timeout: 10000 });
  await sendButton.click();
  const firstResponse = await firstResponsePromise;
  expect([201, 409]).toContain(firstResponse.status());
  await expect(page.getByText(/empresa enviada|pendente|Já existe uma solicitação pendente/i).first()).toBeVisible({ timeout: 10000 });

  const duplicateResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes(companyChangeEndpoint) &&
      response.request().method() === "POST",
    { timeout: 30000 },
  );
  await companyInput.fill("Empresa Duplicada");
  await expect(sendButton).toBeEnabled({ timeout: 10000 });
  await sendButton.click();
  const duplicateResponse = await duplicateResponsePromise;
  expect(duplicateResponse.status()).toBe(409);
  await expect(page.getByText(/pendente|Já existe uma solicitação pendente/i).first()).toBeVisible({ timeout: 10000 });

  await setMockUser(page, "admin");
  await login(page, "admin@example.com", "senha");

  await page.goto("/admin/requests", { waitUntil: "domcontentloaded" });
  await expect(page.getByText(/Solicitações|Pedidos|Ajustes/i).first()).toBeVisible({ timeout: 20000 });
});
