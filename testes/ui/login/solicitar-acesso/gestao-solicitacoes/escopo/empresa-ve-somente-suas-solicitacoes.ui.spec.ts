/**
 * Rodar:
 * npx playwright test testes/ui/login/solicitar-acesso/gestao-solicitacoes/escopo/empresa-ve-somente-suas-solicitacoes.ui.spec.ts --headed --workers=1 --reporter=list
 */
import { expect, test, type Page } from "@playwright/test";

import { autenticarContextoSolicitacaoAcesso } from "../../../../../../support/functions/api/solicitar-acesso/autenticacao/autenticar-revisor";
import {
  aprovarSolicitacaoAdministrativa,
  criarSolicitacaoPublicaComChave,
  montarPayloadSolicitacaoFluxo,
  type DadosSolicitacaoAcessoPublica,
} from "../../../../../../support/functions/api/solicitar-acesso/fluxos/fluxo-ajustes-recusa";
import { criarEmailTeste } from "../../../../../../support/functions/api/solicitar-acesso/emails/capturar-emails";

test.use({ baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3100" });

const PASSWORD = process.env.E2E_PROFILE_PASSWORD ?? "SenhaVisual@123";

async function loginEmpresa(page: Page, params: { username: string; companySlug?: string | null }) {
  await page.context().clearCookies();
  const response = await page.request.post("/api/auth/login", {
    data: {
      user: params.username,
      password: PASSWORD,
      companySlug: params.companySlug ?? undefined,
    },
  });
  const text = await response.text();
  expect(response.ok(), text).toBeTruthy();
}

async function lerEmpresaAtiva(page: Page) {
  const response = await page.request.get("/api/me");
  const body = await response.json().catch(() => null);

  expect(response.status(), JSON.stringify(body)).toBe(200);
  expect(body?.user?.clientId).toBeTruthy();
  expect(body?.user?.clientSlug).toBeTruthy();

  return {
    id: String(body.user.clientId),
    slug: String(body.user.clientSlug),
  };
}

async function criarEAprovarEmpresa(
  request: import("@playwright/test").APIRequestContext,
  label: string,
) {
  const email = criarEmailTeste(`empresa-escopo-${label}`);
  const payload = montarPayloadSolicitacaoFluxo(email, {
    requestedRole: "empresa",
  });
  const created = await criarSolicitacaoPublicaComChave(request, payload);
  const aprovado = await aprovarSolicitacaoAdministrativa(request, {
    id: created.id,
    comentario: `Empresa ${label} aprovada para teste de escopo.`,
  });

  return { email, payload, username: aprovado.username };
}

async function criarSolicitacaoUsuarioDaEmpresa(
  request: import("@playwright/test").APIRequestContext,
  params: {
    email: string;
    companyId: string;
    companySlug: string;
  },
) {
  const payload: DadosSolicitacaoAcessoPublica = montarPayloadSolicitacaoFluxo(params.email, {
    requestedRole: "company_user",
    requestedCompanyId: params.companyId,
    requestedCompanySlug: params.companySlug,
  });

  return criarSolicitacaoPublicaComChave(request, payload);
}

async function validarApiEscopo(page: Page, esperado: string, proibido: string) {
  const response = await page.request.get("/api/admin/access-requests");
  const body = await response.json().catch(() => null);

  expect(response.status(), JSON.stringify(body)).toBe(200);
  expect(body?.scope).toBe("company");

  const emails = (body?.items ?? []).map((item: { email?: string }) => item.email);
  expect(emails).toContain(esperado);
  expect(emails).not.toContain(proibido);
}

async function validarUiEscopo(page: Page, esperado: string, proibido: string) {
  await page.goto("/admin/access-requests", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { name: "SolicitaÃ§Ãµes de acesso" })).toBeVisible({
    timeout: 60000,
  });
  await expect(page.getByTestId("access-requests-list")).toBeVisible();

  const search = page.getByTestId("access-requests-search-input");

  await search.fill(esperado);
  await expect(page.getByText(esperado).first()).toBeVisible({ timeout: 30000 });

  await search.fill(proibido);
  await expect(page.getByText(proibido)).toHaveCount(0);
  await expect(page.getByText("Nenhuma solicitaÃ§Ã£o encontrada para o filtro atual.")).toBeVisible({
    timeout: 30000,
  });
}

async function esperarBloqueio(response: import("@playwright/test").APIResponse) {
  const body = await response.text().catch(() => "");
  expect([403, 404], `${response.url()} -> ${response.status()} ${body}`).toContain(response.status());
}

async function validarBloqueioDiretoOutraEmpresa(
  page: Page,
  params: { requestId: string; companyId: string; companySlug: string },
) {
  await esperarBloqueio(
    await page.request.patch(`/api/admin/access-requests/${encodeURIComponent(params.requestId)}`, {
      data: {
        email: "tentativa-fora-escopo@quality-control.test",
        full_name: "Tentativa fora de escopo",
        access_type: "company_user",
        client_id: params.companyId,
        company: params.companySlug,
        title: "Tentativa fora de escopo",
        description: "Tentativa de edicao direta por outra empresa.",
      },
    }),
  );

  await esperarBloqueio(
    await page.request.post(`/api/admin/access-requests/${encodeURIComponent(params.requestId)}/accept`, {
      data: { comment: "Tentativa de aceitar solicitacao de outra empresa." },
    }),
  );

  await esperarBloqueio(
    await page.request.post(
      `/api/admin/access-requests/${encodeURIComponent(params.requestId)}/request-adjustment`,
      {
        data: {
          comment: "Tentativa de solicitar ajuste em solicitacao de outra empresa.",
          fields: ["phone"],
        },
      },
    ),
  );

  await esperarBloqueio(
    await page.request.post(`/api/admin/access-requests/${encodeURIComponent(params.requestId)}/reject`, {
      data: { reason: "Tentativa de recusar solicitacao de outra empresa." },
    }),
  );

  await esperarBloqueio(
    await page.request.post(`/api/admin/access-requests/${encodeURIComponent(params.requestId)}/comments`, {
      data: { comment: "Tentativa de comentar solicitacao de outra empresa." },
    }),
  );
}

test.describe("SolicitaÃ§Ãµes de acesso - escopo por empresa", () => {
  test.setTimeout(240000);

  test("cada empresa deve ver somente as solicitaÃ§Ãµes realizadas para ela", async ({ browser }) => {
    const adminContext = await browser.newContext();
    const pageA = await browser.newPage();
    const pageB = await browser.newPage();

    try {
      await autenticarContextoSolicitacaoAcesso(adminContext, "leader_tc");

      const empresaA = await criarEAprovarEmpresa(adminContext.request, "a");
      const empresaB = await criarEAprovarEmpresa(adminContext.request, "b");

      await loginEmpresa(pageA, {
        username: empresaA.username,
      });
      const empresaAtivaA = await lerEmpresaAtiva(pageA);

      await loginEmpresa(pageB, {
        username: empresaB.username,
      });
      const empresaAtivaB = await lerEmpresaAtiva(pageB);

      const emailA = criarEmailTeste("escopo-empresa-a");
      const emailB = criarEmailTeste("escopo-empresa-b");

      const solicitacaoA = await criarSolicitacaoUsuarioDaEmpresa(adminContext.request, {
        email: emailA,
        companyId: empresaAtivaA.id,
        companySlug: empresaAtivaA.slug,
      });
      const solicitacaoB = await criarSolicitacaoUsuarioDaEmpresa(adminContext.request, {
        email: emailB,
        companyId: empresaAtivaB.id,
        companySlug: empresaAtivaB.slug,
      });

      await loginEmpresa(pageA, {
        username: empresaA.username,
        companySlug: empresaAtivaA.slug,
      });
      await validarApiEscopo(pageA, emailA, emailB);
      await validarUiEscopo(pageA, emailA, emailB);
      await validarBloqueioDiretoOutraEmpresa(pageA, {
        requestId: solicitacaoB.id,
        companyId: empresaAtivaB.id,
        companySlug: empresaAtivaB.slug,
      });

      await loginEmpresa(pageB, {
        username: empresaB.username,
        companySlug: empresaAtivaB.slug,
      });
      await validarApiEscopo(pageB, emailB, emailA);
      await validarUiEscopo(pageB, emailB, emailA);
      await validarBloqueioDiretoOutraEmpresa(pageB, {
        requestId: solicitacaoA.id,
        companyId: empresaAtivaA.id,
        companySlug: empresaAtivaA.slug,
      });
    } finally {
      await adminContext.close();
      await pageA.close();
      await pageB.close();
    }
  });
});

