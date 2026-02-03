import { test, expect } from "./fixtures/test";
import { login, setMockUser } from "./utils/auth";

test.setTimeout(120000);

test("admin cria empresa e usuario", async ({ page }) => {
  await setMockUser(page, "admin");
  await login(page, "admin@example.com", "senha");

  const suffix = Date.now().toString().slice(-6);
  const companyName = `Empresa E2E ${suffix}`;
  const userName = `Usuario E2E ${suffix}`;
  const userEmail = `e2e.user.${suffix}@griaule.test`;

  await page.goto("/admin/clients", { waitUntil: "domcontentloaded" });

  await page.getByRole("button", { name: /Cadastrar.*empresa/i }).first().click();
  await expect(page.getByRole("heading", { name: /Cadastrar.*empresa/i })).toBeVisible();

  await page.getByLabel(/Nome\s*\/\s*razao social/i).fill(companyName);
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
  await expect(page.getByRole("heading", { name: /Cadastrar.*empresa/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: new RegExp(companyName) }).first()).toBeVisible({
    timeout: 20000,
  });

  await page.goto("/admin/users", { waitUntil: "domcontentloaded" });
  const filterSelect = page.getByLabel(/Empresa:/i);
  await filterSelect.selectOption("");

  await page.getByRole("button", { name: /\+ Criar usu/i }).click();
  await expect(page.getByRole("heading", { name: /Criar usu/i })).toBeVisible();

  await page.getByLabel(/Empresa vinculada/i).selectOption({ label: companyName });
  await page.getByLabel(/Nome completo/i).fill(userName);
  await page.getByLabel(/^Email$/i).fill(userEmail);
  const userForm = page.locator("form").filter({ hasText: /Criar usu/i });
  await userForm.getByRole("button", { name: /Criar usu/i }).click();

  await expect(page.getByRole("heading", { name: /Criar usu/i })).toHaveCount(0);
  await filterSelect.selectOption("");
  await expect(page.getByText(userEmail)).toBeVisible({ timeout: 20000 });
});
