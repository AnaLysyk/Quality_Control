import { expect, type Page } from "@playwright/test";
import {
  BASE_URL,
  EMPRESA_E2E,
  autenticarAdminDeTeste,
  loginDiretoComTentativas,
  montarDadosEmpresaE2E,
} from "../../api/autenticacao/autenticar-por-cookie";

export const SENHA_ADMIN_PADRAO = "Demo@123";
export const SENHA_USUARIO_NOVO = "Teste@2026!";

export const perfisCriadosPorSuporte = [
  { role: "empresa", label: "Empresa" },
  { role: "company_user", label: "Usuário da Empresa" },
  { role: "testing_company_user", label: "Usuário TC" },
  { role: "technical_support", label: "Suporte Tecnico" },
];

export const perfisCriadosPorLider = [
  { role: "empresa", label: "Empresa" },
  { role: "company_user", label: "Usuário da Empresa" },
  { role: "testing_company_user", label: "Usuário TC" },
  { role: "technical_support", label: "Suporte Tecnico" },
  { role: "leader_tc", label: "Lider TC" },
];

export async function autenticarAdminParaCriacaoUsuario(page: Page) {
  return autenticarAdminDeTeste(page);
}

export async function criarUsuarioViaApi(
  page: Page,
  payload: {
    name: string;
    email: string;
    login?: string;
    user?: string;
    role: string;
    companySlug?: string;
    password?: string;
  },
): Promise<{ id: string; email: string }> {
  const response = await page.request.post(`${BASE_URL}/api/admin/users`, {
    data: {
      name: payload.name,
      email: payload.email,
      ...((payload.login ?? payload.user) ? { user: payload.login ?? payload.user } : {}),
      role: payload.role,
      ...(payload.password !== undefined ? { password: payload.password } : {}),
      ...montarDadosEmpresaE2E(payload.role),
    },
  });

  if (!response.ok()) {
    const body = await response.json().catch(() => null);
    throw new Error(`Falha ao criar usuário ${payload.email}: ${response.status()} ${JSON.stringify(body)}`);
  }

  const body = await response.json();

  return {
    id: body.id ?? body.user?.id ?? "",
    email: payload.email,
  };
}

export async function aguardarUsuarioNaListaAdmin(
  page: Page,
  email: string,
  timeoutMs = 30000,
) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const response = await page.request.get(`${BASE_URL}/api/admin/users`);

    if (response.ok()) {
      const body = await response.json().catch(() => ({}));
      const list = body.items ?? body.users ?? body.data ?? body;

      if (Array.isArray(list) && list.some((user: { email?: string }) => user.email === email)) {
        return true;
      }
    }

    await page.waitForTimeout(500);
  }

  throw new Error(`Usuário ${email} não apareceu em /api/admin/users no tempo esperado`);
}

export async function loginDiretoUsuarioCriado(
  page: Page,
  email: string,
  password = SENHA_USUARIO_NOVO,
) {
  const login = await loginDiretoComTentativas(page, email, [
    password,
    "Demo@123",
  ]);

  if (!login.ok || !login.sessionId) {
    throw new Error(`Não foi possível autenticar como ${email}`);
  }

  return login;
}

export async function validarSessaoUsuarioCriado(
  page: Page,
  email: string,
  role: string,
) {
  const response = await page.request.get(`${BASE_URL}/api/me`);

  expect(response.ok()).toBeTruthy();

  const me = await response.json();

  expect(me.user.email).toBe(email);
  expect(me.user.role).toBe(role);

  return me;
}

export async function validarBloqueioAdminParaPerfilCriado(
  page: Page,
  role: string,
) {
  if (!["company_user", "testing_company_user"].includes(role)) return;

  const response = await page.request.get(`${BASE_URL}/api/admin/users`);
  expect([401, 403]).toContain(response.status());
}

export function temEmpresaE2E(me: {
  user?: { clientSlug?: string | null; clientId?: string | null };
  companies?: Array<{ slug?: string; id?: string }>;
}) {
  return (
    me.user?.clientSlug === EMPRESA_E2E.slug ||
    me.user?.clientId === EMPRESA_E2E.id ||
    me.companies?.some((company) => company.slug === EMPRESA_E2E.slug || company.id === EMPRESA_E2E.id)
  );
}
