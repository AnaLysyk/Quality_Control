import { expect, type Page } from "@playwright/test";

import {
  BASE_URL,
} from "../../../../api/autenticacao/autenticar-por-cookie";
import {
  esperarEmailCapturado,
  limparEmailsCapturados,
} from "../../../../api/solicitar-acesso/emails/capturar-emails";
import {
  NOVA_SENHA_RECUPERACAO,
  SENHA_ORIGINAL_RECUPERACAO,
  loginComSenha,
  obterContaSeedadaRecuperacao,
  validarPerfilAposReset,
} from "./recuperar-senha-por-perfil";

export type PerfilEsqueciSenha = {
  role: string;
  slug: string;
  label: string;
};

export const perfisEsqueciSenha: PerfilEsqueciSenha[] = [
  { role: "empresa", slug: "empresa", label: "Empresa" },
  { role: "company_user", slug: "usuario-empresa", label: "Usuario da Empresa" },
  { role: "testing_company_user", slug: "usuario-tc", label: "Usuario TC" },
  { role: "leader_tc", slug: "lider-tc", label: "Lider TC" },
  { role: "technical_support", slug: "suporte-tecnico", label: "Suporte Tecnico" },
];

export function obterPerfilEsqueciSenha(slug: string) {
  const perfil = perfisEsqueciSenha.find((item) => item.slug === slug);
  if (!perfil) throw new Error(`Perfil de esqueci-senha nao encontrado: ${slug}`);
  return perfil;
}

export async function solicitarEsqueciSenhaPelaTela(page: Page, email: string) {
  limparEmailsCapturados();
  await page.goto("/login/forgot-password", { waitUntil: "domcontentloaded" });
  const form = page.getByTestId("forgot-password-form");
  await expect(form).toBeVisible({ timeout: 15000 });
  await expect
    .poll(
      () =>
        form.evaluate((element) => {
          const propsKey = Object.keys(element).find((key) => key.startsWith("__reactProps$"));
          const props = propsKey
            ? (element as unknown as Record<string, Record<string, unknown>>)[propsKey]
            : null;
          return typeof props?.onSubmit === "function";
        }),
      {
        message: "Esperando o formulario de esqueci-senha concluir a hidratacao.",
        timeout: 30000,
      },
    )
    .toBe(true);

  await page.getByTestId("forgot-password-email-input").fill(email);
  const forgotResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/auth/forgot-password") && response.request().method() === "POST",
  );
  await page.getByTestId("forgot-password-submit-button").click();

  const forgotResponse = await forgotResponsePromise;
  const forgotBody = (await forgotResponse.json().catch(() => null)) as { message?: string; error?: string } | null;
  expect(forgotResponse.status(), JSON.stringify(forgotBody)).toBe(200);

  const successMessage =
    typeof forgotBody?.message === "string" && forgotBody.message.trim()
      ? forgotBody.message.trim()
      : null;

  if (successMessage) {
    await expect(page.getByText(successMessage, { exact: false })).toBeVisible({ timeout: 15000 });
  } else {
    await expect(page.getByTestId("forgot-password-email-input")).toHaveValue("", { timeout: 15000 });
  }
}

export async function capturarTokenResetSenha(email: string) {
  const captured = await esperarEmailCapturado({
    to: email,
    subject: /redefinir senha|redefinicao de senha|senha/i,
  });

  const content = `${captured.text ?? ""}\n${captured.html ?? ""}`;
  const token =
    content.match(/reset-password\?token=([a-f0-9]+)/i)?.[1] ??
    content.match(/token=([a-f0-9]{32,})/i)?.[1] ??
    "";

  expect(token, `Token de reset nao encontrado no e-mail capturado para ${email}`).toBeTruthy();
  return token;
}

export async function validarRespostaGenericaEsqueciSenha(page: Page) {
  const [existing, unknown] = await Promise.all([
    page.request.post(`${BASE_URL}/api/auth/forgot-password`, {
      data: { email: "admin@demo.test" },
    }),
    page.request.post(`${BASE_URL}/api/auth/forgot-password`, {
      data: { email: "nao-existe-e2e@demo.test" },
    }),
  ]);

  expect(existing.status()).toBe(200);
  expect(unknown.status()).toBe(200);

  const existingBody = (await existing.json().catch(() => ({}))) as { message?: string };
  const unknownBody = (await unknown.json().catch(() => ({}))) as { message?: string };

  expect(existingBody.message).toBeTruthy();
  expect(existingBody.message).toBe(unknownBody.message);
}

export async function validarTokenInvalidoEsqueciSenha(page: Page) {
  const validateInvalid = await page.request.post(`${BASE_URL}/api/auth/reset-password/validate`, {
    data: { token: "token-invalido-e2e" },
  });
  expect(validateInvalid.status()).toBe(200);
  const validateBody = (await validateInvalid.json().catch(() => ({}))) as { valid?: boolean };
  expect(validateBody.valid).toBeFalsy();

  const confirmInvalid = await page.request.post(`${BASE_URL}/api/auth/reset-password/confirm`, {
    data: { token: "token-invalido-e2e", newPassword: NOVA_SENHA_RECUPERACAO },
  });
  expect(confirmInvalid.status()).toBe(400);
}

export async function executarRecuperacaoSenhaPorPerfil(page: Page, perfil: PerfilEsqueciSenha) {
  const { email } = obterContaSeedadaRecuperacao(perfil.role);
  let senhaAlterada = false;

  try {
    await solicitarEsqueciSenhaPelaTela(page, email);
    const token = await capturarTokenResetSenha(email);

    const validateResponse = await page.request.post(`${BASE_URL}/api/auth/reset-password/validate`, {
      data: { token },
    });
    expect(validateResponse.status()).toBe(200);
    const validateBody = (await validateResponse.json().catch(() => ({}))) as { valid?: boolean };
    expect(validateBody.valid).toBe(true);

    const confirmResponse = await page.request.post(`${BASE_URL}/api/auth/reset-password/confirm`, {
      data: { token, newPassword: NOVA_SENHA_RECUPERACAO },
    });
    const confirmText = await confirmResponse.text();
    expect(confirmResponse.ok(), confirmText).toBeTruthy();
    senhaAlterada = true;

    const consumedResponse = await page.request.post(`${BASE_URL}/api/auth/reset-password/validate`, {
      data: { token },
    });
    expect(consumedResponse.status()).toBe(200);
    const consumedBody = (await consumedResponse.json().catch(() => ({}))) as { valid?: boolean };
    expect(consumedBody.valid).toBeFalsy();

    await page.context().clearCookies();
    const { ok, sessionId, authToken } = await loginComSenha(page, email, NOVA_SENHA_RECUPERACAO);
    expect(ok, `Login com nova senha falhou para ${email}`).toBeTruthy();
    expect(sessionId, "session_id ausente apos login com nova senha").toBeTruthy();

    await validarPerfilAposReset(page, sessionId!, email, perfil.role, authToken);

    const oldLoginResponse = await page.request.post(`${BASE_URL}/api/auth/login`, {
      data: { user: email, password: SENHA_ORIGINAL_RECUPERACAO },
    });
    expect([401, 403]).toContain(oldLoginResponse.status());
  } finally {
    if (senhaAlterada) {
      const restoreResponse = await page.request.post(`${BASE_URL}/api/auth/reset-direct`, {
        data: {
          user: email,
          email,
          newPassword: SENHA_ORIGINAL_RECUPERACAO,
        },
      });
      const restoreText = await restoreResponse.text().catch(() => "");
      expect(restoreResponse.ok(), `Falha ao restaurar senha original de ${email}: ${restoreText}`).toBeTruthy();
    }
  }
}
