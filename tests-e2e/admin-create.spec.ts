import { test, expect } from "./fixtures/test";
import { login, setMockUser } from "./utils/auth";

test.setTimeout(120000);

test("admin cria empresa e usuario", async ({ page }) => {
  await setMockUser(page, "admin");
  await login(page, "admin@example.com", "senha");

  const suffix = Date.now().toString().slice(-6);
  const companyName = `Empresa E2E ${suffix}`;
  const userName = `Usuario E2E ${suffix}`;
  const userEmail = `e2e.user.${suffix}@demo.test`;

  await page.goto("/admin/clients", { waitUntil: "domcontentloaded" });

  await page.getByRole("button", { name: /Cadastrar.*empresa/i }).first().click();
  await expect(page.getByRole("heading", { name: /Cadastrar.*empresa/i })).toBeVisible();

  await page.getByLabel(/Nome\s*\/\s*raz[aã]o social/i).fill(companyName);
  const createResponsePromise = page.waitForResponse(
    (response) => response.url().includes("/api/clients") && response.request().method() === "POST"
  );
  await page.getByRole("button", { name: /Salvar empresa/i }).click();
  const createResponse = await createResponsePromise;
  if (createResponse.status() !== 201) {
    const body = await createResponse.json().catch(() => null);
    const sentPayload = createResponse.request().postDataJSON?.() ?? createResponse.request().postData();
    throw new Error(
      `Falha ao criar empresa: ${createResponse.status()} ${JSON.stringify(body)} payload=${JSON.stringify(sentPayload)}`
    );
  }
  await page.goto("/admin/clients", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: new RegExp(companyName) }).first()).toBeVisible({
    timeout: 20000,
  });

  await page.goto("/admin/users", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /Criar usu[aá]rio da empresa/i }).click();
  await expect(page.getByRole("heading", { name: /Criar usu/i })).toBeVisible();

  const companySelect = page.locator('select[aria-label*="Empresa vinculada"]').first();
  await expect(companySelect).toContainText(companyName, { timeout: 20000 });
  await companySelect.selectOption({ label: companyName });
  await expect(companySelect).toHaveValue(/.+/);
  await page.getByLabel(/Nome completo/i).fill(userName);
  await page.getByLabel(/^Email$/i).fill(userEmail);
  const userForm = page.locator("form").filter({ hasText: /Criar usu/i });
  await userForm.getByRole("button", { name: /Criar usu/i }).click();

  await expect(page.getByRole("heading", { name: /Criar usu/i })).toHaveCount(0);
  await expect(page.locator("main").getByText(userEmail, { exact: true }).first()).toBeVisible({ timeout: 20000 });
});


