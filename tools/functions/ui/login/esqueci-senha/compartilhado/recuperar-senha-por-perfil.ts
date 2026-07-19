import { expect, type Page } from "@playwright/test";

import {
  BASE_URL,
  extrairCookie,
} from "../../../../api/autenticacao/autenticar-por-cookie";

export const SENHA_ORIGINAL_RECUPERACAO = process.env.E2E_PROFILE_PASSWORD ?? "Demo@123";
export const NOVA_SENHA_RECUPERACAO = "NovaSenha@2026!";

export const perfisRecuperacaoSenha = [
  { role: "empresa", label: "Empresa" },
  { role: "company_user", label: "Usuário da Empresa" },
  { role: "testing_company_user", label: "Usuário TC" },
  { role: "leader_tc", label: "Líder TC" },
  { role: "technical_support", label: "Suporte Tecnico" },
];

const PERFIS_SEEDADOS: Record<string, { email: string; companySlug?: string; companyId?: string }> = {
  empresa: {
    email: "e2e-empresa@empresa.local",
    companySlug: "empresa-e2e",
    companyId: "cmp_e2e_client",
  },
  company_user: {
    email: "e2e-company-user@empresa.local",
    companySlug: "empresa-e2e",
    companyId: "cmp_e2e_client",
  },
  testing_company_user: {
    email: "e2e-user-tc@testingcompany.local",
    companySlug: "testing-company",
    companyId: "cmp_e2e_testing_company",
  },
  leader_tc: {
    email: "e2e-leader-tc@testingcompany.local",
  },
  technical_support: {
    email: "e2e-suporte@testingcompany.local",
  },
};

export function obterContaSeedadaRecuperacao(role: string) {
  const conta = PERFIS_SEEDADOS[role];
  if (!conta) {
    throw new Error(`Conta seedada nao configurada para recuperacao: ${role}`);
  }
  return conta;
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
    const contaEsperada = obterContaSeedadaRecuperacao(role);
    const hasCompany =
      me.user.clientSlug === contaEsperada.companySlug ||
      me.user.clientId === contaEsperada.companyId ||
      me.companies?.some(
        (company: { slug?: string; id?: string }) =>
          company.slug === contaEsperada.companySlug || company.id === contaEsperada.companyId,
      );

    expect(hasCompany, `Vínculo de empresa perdido após reset para ${email}`).toBeTruthy();
  }

  const adminApiResponse = await page.request.get(`${BASE_URL}/api/admin/access-requests`, {
    headers: authHeaders,
  });

  if (["leader_tc", "technical_support", "empresa"].includes(role)) {
    expect(adminApiResponse.status()).toBe(200);
  } else {
    expect([401, 403]).toContain(adminApiResponse.status());
  }
}

