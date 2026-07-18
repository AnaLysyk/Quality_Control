import type { BrowserContext } from "@playwright/test";

import { simularAutenticacao, type OpcoesAutenticacaoSimulada } from "../apoio/simular-autenticacao";

export const EMPRESA_CLIENTE_E2E = {
  slug: "empresa-e2e",
  name: "Empresa Cliente E2E",
};

export const TESTING_COMPANY_E2E = {
  slug: "testing-company",
  name: "Testing Company E2E",
};

export function rotaRunsEmpresa(slug = EMPRESA_CLIENTE_E2E.slug) {
  return `/${slug}/runs`;
}

export function rotaDashboardEmpresa(slug = EMPRESA_CLIENTE_E2E.slug) {
  return `/${slug}/dashboard`;
}

export function rotaKanbanDefeitosEmpresa(slug = EMPRESA_CLIENTE_E2E.slug) {
  return `/${slug}/defeitos/kanban`;
}

export function rotaDetalheRunEmpresa(runSlug: string, slug = EMPRESA_CLIENTE_E2E.slug) {
  return `/${slug}/runs/${runSlug}`;
}

export async function autenticarPerfilRuns(
  context: BrowserContext,
  role: OpcoesAutenticacaoSimulada["role"],
) {
  if (role === "admin" || role === "leader_tc" || role === "technical_support") {
    await simularAutenticacao(context, {
      role,
      companies: [TESTING_COMPANY_E2E.slug, EMPRESA_CLIENTE_E2E.slug],
      clientSlug: TESTING_COMPANY_E2E.slug,
    });
    return;
  }

  await simularAutenticacao(context, {
    role,
    companies: [EMPRESA_CLIENTE_E2E.slug],
    companySlug: EMPRESA_CLIENTE_E2E.slug,
    clientSlug: EMPRESA_CLIENTE_E2E.slug,
  });
}

