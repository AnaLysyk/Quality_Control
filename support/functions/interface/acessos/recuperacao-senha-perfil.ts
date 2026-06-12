import { expect, type Page } from "@playwright/test";

import {
  BASE_URL,
  EMPRESA_E2E,
  autenticarAdminDeTeste,
  montarDadosEmpresaE2E,
  extrairCookie,
} from "../../api/acessos/autenticacao-por-cookie";

export const SENHA_ORIGINAL_RECUPERACAO = "Demo@123";
export const NOVA_SENHA_RECUPERACAO = "NovaSenha@2026!";

export const perfisRecuperacaoSenha = [
  { role: "empresa", label: "Empresa" },
  { role: "company_user", label: "Usuário da Empresa" },
  { role: "testing_company_user", label: "Usuário TC" },
  { role: "leader_tc", label: "Líder TC" },
  { role: "technical_support", label: "Suporte Tecnico" },
];

export async function criarUsuarioTesteParaRecuperacao(
  page: Page,
  name: string,
  email: string,
  role: string,
): Promise<string | null> {
  await autenticarAdminDeTeste(page);

  const response = await page.request.post(`${BASE_URL}/api/admin/users`, {
    data: {
      name,
      email,
      role,
      password: SENHA_ORIGINAL_RECUPERACAO,
      ...montarDadosEmpresaE2E(role),
    },
  });

  if (!response.ok()) {
    const body = await response.text();
    throw new Error(`Falha ao criar usuário ${email}: ${response.status()} ${body}`);
  }

  const body = await response.json().catch(() => ({}));

  return body.id ?? body.user?.id ?? null;
}

export async function excluirUsuarioTesteRecuperacao(page: Page, userId: string) {
  await autenticarAdminDeTeste(page);
  await page.request.delete(`${BASE_URL}/api/admin/users/${userId}`).catch(() => {});
}

export async function solicitarRecuperacaoSenha(
  page: Page,
  email: string,
): Promise<string | null> {
  const response = await page.request.post(`${BASE_URL}/api/auth/reset-request`, {
    data: { user: email, email },
  });

  if (!response.ok()) {
    return null;
  }

  const body = await response.json().catch(() => ({}));

  return body.requestId ?? body.id ?? null;
}

export async function aprovarRecuperacaoSenha(
  page: Page,
  email: string,
  requestId: string | null,
): Promise<boolean> {
  if (requestId) {
    const response = await page.request.post(`${BASE_URL}/api/admin/requests/${requestId}/approve`, {
      data: {},
    });

    if (response.ok()) {
      return true;
    }
  }

  const response = await page.request.post(`${BASE_URL}/api/auth/reset-direct`, {
    data: {
      user: email,
      email,
      newPassword: NOVA_SENHA_RECUPERACAO,
    },
  });

  return response.ok();
}

export async function loginComSenha(
  page: Page,
  email: string,
  password: string,
): Promise<{ ok: boolean; sessionId?: string; authToken?: string }> {
  const response = await page.request.post(`${BASE_URL}/api/auth/login`, {
    data: { user: email, password },
  });

  if (!response.ok()) {
    return { ok: false };
  }

  const sessionId = extrairCookie(response.headers()["set-cookie"], "session_id") ?? undefined;
  const authToken = extrairCookie(response.headers()["set-cookie"], "auth_token") ?? undefined;

  return { ok: true, sessionId, authToken };
}

export async function aplicarResetDireto(page: Page, email: string) {
  return page.request.post(`${BASE_URL}/api/auth/reset-direct`, {
    data: {
      user: email,
      email,
      newPassword: NOVA_SENHA_RECUPERACAO,
    },
  });
}

export async function prepararAdminParaRecuperacao(page: Page) {
  return autenticarAdminDeTeste(page);
}

export async function validarPerfilAposReset(
  page: Page,
  sessionId: string,
  email: string,
  role: string,
  authToken?: string,
) {
  const authHeaders = {
    cookie: `session_id=${sessionId}${authToken ? `; auth_token=${authToken}` : ""}`,
    ...(authToken ? { authorization: `Bearer ${authToken}` } : {}),
  };
  const meResponse = await page.request.get(`${BASE_URL}/api/me`, {
    headers: authHeaders,
  });
  const meBody = await meResponse.text();

  expect(
    meResponse.ok(),
    `/api/me falhou para ${email}: ${meResponse.status()} ${meBody}`,
  ).toBeTruthy();

  const me = JSON.parse(meBody);

  expect(me.user.email).toBe(email);
  expect(me.user.role).toBe(role);

  if (!["leader_tc", "technical_support"].includes(role)) {
    const hasCompany =
      me.user.clientSlug === EMPRESA_E2E.slug ||
      me.user.clientId === EMPRESA_E2E.id ||
      me.companies?.some(
        (company: { slug?: string; id?: string }) =>
          company.slug === EMPRESA_E2E.slug || company.id === EMPRESA_E2E.id,
      );

    expect(hasCompany, `Vínculo de empresa perdido após reset para ${email}`).toBeTruthy();
  }

  const adminApiResponse = await page.request.get(`${BASE_URL}/api/admin/access-requests`, {
    headers: authHeaders,
  });

  if (!["leader_tc", "technical_support"].includes(role)) {
    expect([401, 403]).toContain(adminApiResponse.status());
  }
}

