import { test, expect } from "./fixtures/test";

const BASE =
  process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3100";

const TEST_USER = "user@griaule.test";
const ORIGINAL_PASSWORD = "Griaule@123";
const NEW_PASSWORD = "NovaSenha@456";

test.describe("Forgot password flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login/forgot-password");
    await expect(
      page.getByRole("heading", { name: /esqueceu sua senha/i }),
    ).toBeVisible();
  });

  /* ────────── restore original password via API after each test ────────── */
  test.afterEach(async ({ request }) => {
    // Always attempt to restore the original password so other tests aren't affected
    await request.post(`${BASE}/api/auth/reset-direct`, {
      data: {
        user: TEST_USER,
        email: TEST_USER,
        newPassword: ORIGINAL_PASSWORD,
      },
    });
  });

  /* ====================== validation ====================== */

  test("shows error when fields are empty", async ({ page }) => {
    // noValidate on form allows submission of empty fields -> JS validation fires
    await page.getByRole("button", { name: /validar dados/i }).click();
    await expect(
      page.getByText("Informe seu usuário e e-mail."),
    ).toBeVisible();
  });

  test("shows error for invalid email format", async ({ page }) => {
    // "not-an-email" fails JS regex; noValidate bypasses browser check
    await page.getByLabel("Usuário").fill("someuser");
    await page.getByLabel("E-mail").fill("not-an-email");
    await page.getByRole("button", { name: /validar dados/i }).click();
    await expect(page.getByText("E-mail inválido.")).toBeVisible();
  });

  test("shows error when user and email do not match", async ({ page }) => {
    await page.getByLabel("Usuário").fill("nonexistent-user");
    await page.getByLabel("E-mail").fill("wrong@example.com");
    await page.getByRole("button", { name: /validar dados/i }).click();
    await expect(
      page.getByText(/não foi possível validar|nao conferem/i),
    ).toBeVisible();
  });

  /* ====================== happy path ====================== */

  test("resets password successfully and can log in with new password", async ({
    page,
    request,
  }) => {
    // ── Step 1: verify identity ──
    await page.getByLabel("Usuário").fill(TEST_USER);
    await page.getByLabel("E-mail").fill(TEST_USER);
    await page.getByRole("button", { name: /validar dados/i }).click();

    // Success message + new password fields appear
    await expect(
      page.getByText("Dados confirmados. Agora defina sua nova senha."),
    ).toBeVisible();
    await expect(page.getByLabel("Nova senha", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Confirmar nova senha")).toBeVisible();

    // ── Step 2: set new password ──
    await page.getByLabel("Nova senha", { exact: true }).fill(NEW_PASSWORD);
    await page.getByLabel("Confirmar nova senha").fill(NEW_PASSWORD);
    await page.getByRole("button", { name: /atualizar senha/i }).click();

    await expect(
      page.getByText("Senha atualizada com sucesso. Você já pode entrar."),
    ).toBeVisible();

    // ── Step 3: confirm the new password works via API ──
    const loginResp = await request.post(`${BASE}/api/auth/login`, {
      data: { user: TEST_USER, password: NEW_PASSWORD },
    });
    expect(loginResp.ok()).toBeTruthy();
  });

  /* ====================== password validations ====================== */

  test("shows error when password is too short", async ({ page }) => {
    // First verify identity
    await page.getByLabel("Usuário").fill(TEST_USER);
    await page.getByLabel("E-mail").fill(TEST_USER);
    await page.getByRole("button", { name: /validar dados/i }).click();
    await expect(page.getByLabel("Nova senha", { exact: true })).toBeVisible();

    // Try short password
    await page.getByLabel("Nova senha", { exact: true }).fill("abc");
    await page.getByLabel("Confirmar nova senha").fill("abc");
    await page.getByRole("button", { name: /atualizar senha/i }).click();

    await expect(
      page.getByText(/pelo menos 8 caracteres/i),
    ).toBeVisible();
  });

  test("shows error when passwords do not match", async ({ page }) => {
    // First verify identity
    await page.getByLabel("Usuário").fill(TEST_USER);
    await page.getByLabel("E-mail").fill(TEST_USER);
    await page.getByRole("button", { name: /validar dados/i }).click();
    await expect(page.getByLabel("Nova senha", { exact: true })).toBeVisible();

    // Mismatched passwords
    await page.getByLabel("Nova senha", { exact: true }).fill(NEW_PASSWORD);
    await page.getByLabel("Confirmar nova senha").fill("DifferentPassword@789");
    await page.getByRole("button", { name: /atualizar senha/i }).click();

    await expect(
      page.getByText("As senhas não coincidem."),
    ).toBeVisible();
  });

  /* ====================== navigation ====================== */

  test("'Voltar ao login' navigates back to login page", async ({ page }) => {
    await page.getByRole("link", { name: /voltar ao login/i }).click();
    await expect(page).toHaveURL(/\/login$/);
  });

  /* ====================== re-verification on credential edit ====================== */

  test("editing user after verification resets back to verify step", async ({
    page,
  }) => {
    // Verify identity first
    await page.getByLabel("Usuário").fill(TEST_USER);
    await page.getByLabel("E-mail").fill(TEST_USER);
    await page.getByRole("button", { name: /validar dados/i }).click();
    await expect(page.getByLabel("Nova senha", { exact: true })).toBeVisible();

    // Edit the user field — should reset verification
    await page.getByLabel("Usuário").fill("another-user");
    await expect(page.getByLabel("Nova senha", { exact: true })).not.toBeVisible();
    await expect(
      page.getByRole("button", { name: /validar dados/i }),
    ).toBeVisible();
  });
});
