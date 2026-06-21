import { expect, type Page } from "@playwright/test";

import {
  BASE_URL,
  EMPRESA_E2E,
} from "../../../../api/autenticacao/autenticar-por-cookie";
import {
  esperarEmailCapturado,
  limparEmailsCapturados,
} from "../../../../api/solicitar-acesso/emails/capturar-emails";
import {
  NOVA_SENHA_RECUPERACAO,
  SENHA_ORIGINAL_RECUPERACAO,
  criarUsuarioTesteParaRecuperacao,
  excluirUsuarioTesteRecuperacao,
  loginComSenha,
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
  await expect(page.getByTestId("forgot-password-form")).toBeVisible({ timeout: 15000 });

  await page.getByTestId("forgot-password-email-input").fill(email);
  await page.getByTestId("forgot-password-submit-button").click();

  await expect(page.getByText(/se o e-mail informado estiver cadastrado/i)).toBeVisible({
    timeout: 15000,
  });
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
  const suffix = `${Date.now().toString().slice(-6)}-${Math.random().toString(36).slice(2, 5)}`;
  const email = `e2e-reset-${perfil.slug}-${suffix}@demo.test`;
  let userId: string | null = null;

  try {
    userId = await criarUsuarioTesteParaRecuperacao(
      page,
      `Reset ${perfil.label} ${suffix}`,
      email,
      perfil.role,
    );
    expect(userId, `Usuario de teste nao foi criado para ${perfil.label}`).toBeTruthy();

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

    if (!["leader_tc", "technical_support"].includes(perfil.role)) {
      const meResponse = await page.request.get(`${BASE_URL}/api/me`, {
        headers: {
          cookie: `session_id=${sessionId}${authToken ? `; auth_token=${authToken}` : ""}`,
          ...(authToken ? { authorization: `Bearer ${authToken}` } : {}),
        },
      });
      const me = (await meResponse.json().catch(() => ({}))) as {
        user?: { clientSlug?: string; clientId?: string };
        companies?: Array<{ slug?: string; id?: string }>;
      };
      const manteveEmpresa =
        me.user?.clientSlug === EMPRESA_E2E.slug ||
        me.user?.clientId === EMPRESA_E2E.id ||
        me.companies?.some((company) => company.slug === EMPRESA_E2E.slug || company.id === EMPRESA_E2E.id);
      expect(manteveEmpresa, `Vinculo de empresa perdido para ${perfil.label}`).toBeTruthy();
    }
  } finally {
    if (userId) {
      await excluirUsuarioTesteRecuperacao(page, userId);
    }
  }
}
