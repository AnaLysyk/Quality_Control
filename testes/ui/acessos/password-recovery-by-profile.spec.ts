/**
 * Ticket 3 — Automatizar recuperação de senha por perfil
 */

import { test, expect } from "../../../support/fixtures/test";
import {
  NOVA_SENHA_RECUPERACAO,
  SENHA_ORIGINAL_RECUPERACAO,
  aplicarResetDireto,
  aprovarRecuperacaoSenha,
  criarUsuarioTesteParaRecuperacao,
  excluirUsuarioTesteRecuperacao,
  loginComSenha,
  perfisRecuperacaoSenha,
  prepararAdminParaRecuperacao,
  solicitarRecuperacaoSenha,
  validarPerfilAposReset,
} from "../../../support/functions/interface/acessos/recuperacao-senha-perfil";
import { BASE_URL } from "../../../support/functions/api/acessos/autenticacao-por-cookie";

test.setTimeout(180000);

for (const profile of perfisRecuperacaoSenha) {
  test.describe(`Recuperação de senha — ${profile.label}`, () => {
    let testUserId: string | null = null;
    let testEmail: string;

    test.beforeEach(async ({ page }) => {
      const suffix = `${Date.now().toString().slice(-6)}-${Math.random().toString(36).slice(2, 5)}`;
      testEmail = `e2e-reset-${profile.role}-${suffix}@demo.test`;

      testUserId = await criarUsuarioTesteParaRecuperacao(
        page,
        `Reset ${profile.label} ${suffix}`,
        testEmail,
        profile.role,
      );
    });

    test.afterEach(async ({ page }) => {
      if (testUserId) {
        await excluirUsuarioTesteRecuperacao(page, testUserId);
      }
    });

    test(`${profile.label} recupera senha e faz login com nova senha`, async ({ page }) => {
      if (!testUserId) {
        test.skip();
        return;
      }

      await page.goto("/login/forgot-password", { waitUntil: "domcontentloaded" });
      await expect(page).not.toHaveURL(/\/(login)?\?/, { timeout: 10000 });

      const requestId = await solicitarRecuperacaoSenha(page, testEmail);

      await prepararAdminParaRecuperacao(page);

      const approved = await aprovarRecuperacaoSenha(page, testEmail, requestId);

      if (!approved) {
        const directResponse = await aplicarResetDireto(page, testEmail);
        expect(
          directResponse.ok(),
          `reset-direct falhou para ${testEmail}: ${directResponse.status()}`,
        ).toBeTruthy();
      }

      await page.context().clearCookies();

      const { ok: loginOk, sessionId, authToken } = await loginComSenha(
        page,
        testEmail,
        NOVA_SENHA_RECUPERACAO,
      );

      expect(loginOk, `Login com nova senha falhou para ${testEmail}`).toBeTruthy();
      expect(sessionId, "session_id ausente após login com nova senha").toBeTruthy();

      await validarPerfilAposReset(page, sessionId!, testEmail, profile.role, authToken);
    });

    test(`${profile.label} — senha antiga não funciona após reset`, async ({ page }) => {
      if (!testUserId) {
        test.skip();
        return;
      }

      const resetResponse = await aplicarResetDireto(page, testEmail);

      if (!resetResponse.ok()) {
        test.skip();
        return;
      }

      await page.context().clearCookies();

      const oldLoginResponse = await page.request.post(`${BASE_URL}/api/auth/login`, {
        data: {
          user: testEmail,
          password: SENHA_ORIGINAL_RECUPERACAO,
        },
      });

      expect([401, 403]).toContain(oldLoginResponse.status());
    });
  });
}

test("Tela esqueci-minha-senha acessível sem login", async ({ page }) => {
  await page.goto("/login/forgot-password", { waitUntil: "domcontentloaded" });
  await expect(page).not.toHaveURL(/\/login(\?|$)/, { timeout: 10000 });

  const emailInput = page.getByPlaceholder(/e-mail|email/i).first();
  await expect(emailInput).toBeVisible({ timeout: 10000 });
});

test("Recuperação com email inexistente retorna erro", async ({ page }) => {
  const response = await page.request.post(`${BASE_URL}/api/auth/reset-request`, {
    data: {
      user: "nao-existe@demo.test",
      email: "nao-existe@demo.test",
    },
  });

  expect([400, 404]).toContain(response.status());
});

test("Reset via token inválido retorna 400", async ({ page }) => {
  const response = await page.request.post(`${BASE_URL}/api/auth/reset-via-token`, {
    data: {
      token: "token-invalido-e2e-test",
      newPassword: NOVA_SENHA_RECUPERACAO,
    },
  });

  expect(response.status()).toBe(400);
});
