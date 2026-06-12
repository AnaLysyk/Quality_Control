import { expect, type Page } from "@playwright/test";
import {
  BASE_URL,
  EMPRESA_E2E,
  autenticarAdminDeTeste,
  loginDiretoComTentativas,
  montarDadosEmpresaE2E,
} from "../../api/acessos/autenticacao-por-cookie";
import { aguardarUsuarioNaListaAdmin } from "./criacao-usuario-perfil";

export const perfisPrimeiroLoginSolicitacao = [
  { role: "empresa", label: "Empresa", accessType: "company" as const, expectedRole: "empresa" },
  { role: "company_user", label: "Usuário da Empresa", accessType: "user" as const, expectedRole: "company_user" },
  { role: "testing_company_user", label: "Usuário TC", accessType: "user" as const, expectedRole: "testing_company_user" },
  { role: "leader_tc", label: "Lider TC", accessType: "user" as const, expectedRole: "leader_tc" },
  { role: "technical_support", label: "Suporte Tecnico", accessType: "user" as const, expectedRole: "technical_support" },
];

export type PerfilPrimeiroLoginSolicitacao = (typeof perfisPrimeiroLoginSolicitacao)[number];

type PayloadSolicitacaoAcesso = {
  name: string;
  email: string;
  role: string;
  company: string;
  accessType: "user" | "company";
  profileType: string;
  notes?: string;
};

function montarPayloadSolicitacao(payload: PayloadSolicitacaoAcesso) {
  return {
    name: payload.name,
    full_name: payload.name,
    requesterName: payload.name,
    requesterEmail: payload.email,
    email: payload.email,
    user: payload.email,
    role: payload.role,
    requestType: payload.profileType,
    requestedRole: payload.profileType,
    access_type: payload.accessType,
    profile_type: payload.profileType,
    phone: "(11) 99999-9999",
    password: "Griaule@123",
    title: `Solicitação E2E ${payload.name}`,
    description: payload.notes ?? "Solicitação criada automaticamente pelo E2E.",
    reason: payload.notes ?? "Solicitação criada automaticamente pelo E2E.",
    priority: "medium",
    ...montarDadosEmpresaE2E(payload.profileType),
  };
}

export async function enviarSolicitacaoAcessoLegada(
  page: Page,
  payload: PayloadSolicitacaoAcesso,
) {
  const data = montarPayloadSolicitacao(payload);

  const response = await page.request.post(`${BASE_URL}/api/support/access-request`, {
    data,
  });

  if (response.ok()) {
    const body = await response.json().catch(() => ({}));
    return body.id ?? body.request?.id ?? body.item?.id ?? null;
  }

  const fallback = await page.request.post(`${BASE_URL}/api/access-requests/public`, {
    data,
  });

  expect(
    fallback.ok(),
    `Falha ao criar solicitação de acesso: ${response.status()} / fallback ${fallback.status()} ${await fallback.text().catch(() => "")}`,
  ).toBeTruthy();

  const body = await fallback.json().catch(() => ({}));

  return body.id ?? body.request?.id ?? body.item?.id ?? null;
}

export async function postarSolicitacaoAcessoLegada(
  page: Page,
  payload: PayloadSolicitacaoAcesso,
) {
  const data = montarPayloadSolicitacao(payload);

  return page.request.post(`${BASE_URL}/api/support/access-request`, { data });
}

export async function aprovarSolicitacaoAcessoLegada(
  page: Page,
  requestId: string,
  companySlug = EMPRESA_E2E.slug,
) {
  const response = await page.request.post(
    `${BASE_URL}/api/admin/access-requests/${requestId}/accept`,
    {
      data: {
        clientSlug: companySlug,
        company: companySlug,
        companyId: EMPRESA_E2E.id,
        clientId: EMPRESA_E2E.id,
        requestedCompanyId: EMPRESA_E2E.id,
      },
    },
  );

  if (!response.ok()) {
    const body = await response.json().catch(() => null);
    throw new Error(`Falha ao aprovar solicitação ${requestId}: ${response.status()} ${JSON.stringify(body)}`);
  }

  return response.json().catch(() => ({}));
}

export async function autenticarAdminDemo(page: Page) {
  return autenticarAdminDeTeste(page);
}

export async function tentarPrimeiroLoginUsuarioAprovado(page: Page, email: string) {
  await page.context().clearCookies();

  return loginDiretoComTentativas(page, email, [
    "Griaule@123",
    "Demo@123",
    "Teste@2026!",
  ]);
}

export async function validarUsuarioExisteNoAdmin(page: Page, email: string) {
  await autenticarAdminDemo(page);

  const response = await page.request.get(`${BASE_URL}/api/admin/users`);

  expect(response.ok()).toBeTruthy();

  const body = await response.json();
  const users = body.items ?? body.users ?? body.data ?? body ?? [];
  const found = Array.isArray(users) && users.some((user: { email: string }) => user.email === email);

  expect(found, `Usuário ${email} não encontrado após aprovação`).toBeTruthy();
}

export async function validarPrimeiroLoginAprovado(
  page: Page,
  email: string,
  profile: PerfilPrimeiroLoginSolicitacao,
) {
  const response = await page.request.get(`${BASE_URL}/api/me`);

  expect(response.ok()).toBeTruthy();

  const me = await response.json();

  expect(me.user.email).toBe(email);
  expect(me.user.role).toBe(profile.expectedRole);

  const isInternalAdminProfile = ["leader_tc", "technical_support"].includes(profile.expectedRole);
  const hasCompany =
    me.user.clientSlug === EMPRESA_E2E.slug ||
    me.user.clientId === EMPRESA_E2E.id ||
    me.companies?.some((company: { slug?: string; id?: string }) => company.slug === EMPRESA_E2E.slug || company.id === EMPRESA_E2E.id);

  if (!isInternalAdminProfile) {
    expect(hasCompany, `Usuario ${email} sem vinculo com ${EMPRESA_E2E.slug}`).toBeTruthy();
  }

  const adminResponse = await page.request.get(`${BASE_URL}/api/admin/access-requests`);

  if (isInternalAdminProfile) {
    expect(adminResponse.ok(), `Perfil interno ${profile.expectedRole} deve acessar fila de solicitacoes`).toBeTruthy();
  } else {
    expect([401, 403]).toContain(adminResponse.status());
  }
}

export async function aguardarUsuarioAprovadoNaListaAdmin(
  page: Page,
  email: string,
  timeoutMs = 35000,
) {
  return aguardarUsuarioNaListaAdmin(page, email, timeoutMs);
}

export async function validarSolicitacaoPendenteNaFilaAdmin(page: Page, email: string) {
  const response = await page.request.get(`${BASE_URL}/api/admin/access-requests`);

  expect(response.ok()).toBeTruthy();

  const body = await response.json().catch(() => ({}));
  const items = Array.isArray(body.items) ? body.items : [];
  const found = items.some((item: { email?: string; requesterEmail?: string; status?: string }) => {
    const itemEmail = item.email ?? item.requesterEmail;
    return itemEmail === email && ["open", "pending", "under_review"].includes(String(item.status));
  });

  expect(found, `Solicitação ${email} não apareceu na listagem de pendentes`).toBeTruthy();
}
