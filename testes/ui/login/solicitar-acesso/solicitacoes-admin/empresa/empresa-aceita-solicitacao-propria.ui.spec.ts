/**
 * Rodar:
 * npx playwright test testes/ui/login/solicitar-acesso/solicitacoes-admin/empresa/empresa-aceita-solicitacao-propria.ui.spec.ts --headed --workers=1 --reporter=list
 */
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

import { autenticarContextoSolicitacaoAcesso } from "../../../../../../support/functions/api/solicitar-acesso/autenticacao/autenticar-revisor";
import {
  aprovarSolicitacaoAdministrativa,
  criarSolicitacaoPublicaComChave,
  montarPayloadSolicitacaoFluxo,
  validarEmailCapturadoQuandoDisponivel,
  validarLoginUsuarioAprovadoPorApi,
  type DadosSolicitacaoAcessoPublica,
} from "../../../../../../support/functions/api/solicitar-acesso/fluxos/fluxo-ajustes-recusa";
import {
  criarEmailTeste,
  limparEmailsCapturados,
} from "../../../../../../support/functions/api/solicitar-acesso/emails/capturar-emails";

test.use({ baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000" });

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

async function criarEAprovarEmpresa(request: APIRequestContext, label: string) {
  const email = criarEmailTeste(`empresa-aceite-${label}`);
  const payload = montarPayloadSolicitacaoFluxo(email, {
    requestedRole: "empresa",
  });
  const created = await criarSolicitacaoPublicaComChave(request, payload);
  const aprovado = await aprovarSolicitacaoAdministrativa(request, {
    id: created.id,
    comentario: `Empresa ${label} aprovada para atuar em solicitacoes da propria empresa.`,
  });

  return { email, payload, username: aprovado.username };
}

async function criarSolicitacaoUsuarioDaEmpresa(
  request: APIRequestContext,
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

  const created = await criarSolicitacaoPublicaComChave(request, payload);
  return { created, payload };
}

async function aguardarSolicitacaoNaApi(request: APIRequestContext, email: string) {
  await expect
    .poll(
      async () => {
        const response = await request.get("/api/admin/access-requests", { timeout: 30000 });
        if (!response.ok()) return false;
        const body = (await response.json().catch(() => null)) as {
          items?: Array<{ email?: string; requesterEmail?: string }>;
          scope?: string;
        } | null;
        return body?.scope === "company" &&
          (body.items ?? []).some((item) => item.email === email || item.requesterEmail === email);
      },
      { timeout: 120000, intervals: [1000, 2000, 5000] },
    )
    .toBe(true);
}

async function abrirSolicitacaoNaTela(page: Page, email: string) {
  await page.goto("/admin/access-requests", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { level: 1, name: /Solicita/i })).toBeVisible({
    timeout: 60000,
  });

  await page.getByTestId("access-requests-search-input").fill(email);
  const item = page.getByText(email).first();
  await expect(item).toBeVisible({ timeout: 45000 });
  await item.click();
}

async function aguardarStatusPublico(request: APIRequestContext, accessKey: string, status: string) {
  await expect
    .poll(
      async () => {
        const response = await request.get(`/api/access-requests/by-key/${encodeURIComponent(accessKey)}`, {
          timeout: 30000,
        });
        if (!response.ok()) return null;
        const body = (await response.json().catch(() => null)) as { item?: { status?: string } } | null;
        return body?.item?.status ?? null;
      },
      { timeout: 120000, intervals: [1000, 2000, 5000] },
    )
    .toBe(status);
}

test.describe("Solicitacoes de acesso - Empresa aprova no proprio escopo", () => {
  test.setTimeout(360000);

  test.beforeEach(() => {
    limparEmailsCapturados();
  });

  test("Empresa deve aceitar solicitacao vinculada a propria empresa", async ({ browser }) => {
    const adminContext = await browser.newContext();
    const empresaPage = await browser.newPage();
    const approvedContext = await browser.newContext();

    try {
      await autenticarContextoSolicitacaoAcesso(adminContext, "leader_tc");

      const empresa = await criarEAprovarEmpresa(adminContext.request, "a");

      await loginEmpresa(empresaPage, { username: empresa.username });
      const empresaAtiva = await lerEmpresaAtiva(empresaPage);

      const emailSolicitante = criarEmailTeste("empresa-aprova-propria");
      const { created, payload } = await criarSolicitacaoUsuarioDaEmpresa(adminContext.request, {
        email: emailSolicitante,
        companyId: empresaAtiva.id,
        companySlug: empresaAtiva.slug,
      });

      await loginEmpresa(empresaPage, {
        username: empresa.username,
        companySlug: empresaAtiva.slug,
      });

      await aguardarSolicitacaoNaApi(empresaPage.request, emailSolicitante);
      await abrirSolicitacaoNaTela(empresaPage, emailSolicitante);

      await empresaPage.getByLabel("Tipo de perfil").selectOption("Usuário da empresa");
      await empresaPage
        .getByPlaceholder(/Descreva o ajuste/i)
        .fill("Solicitacao aprovada pela Empresa dentro do proprio escopo.");
      await empresaPage.getByRole("button", { name: /Aprovar solicita/i }).click();

      await aguardarStatusPublico(adminContext.request, created.accessKey, "approved");

      await empresaPage.goto(`/login/access-request/status?key=${encodeURIComponent(created.accessKey)}`, {
        waitUntil: "domcontentloaded",
      });
      await expect(empresaPage.getByTestId("access-request-status-label")).toContainText(/aprovad/i, {
        timeout: 30000,
      });

      const approvalEmail = await validarEmailCapturadoQuandoDisponivel({
        to: emailSolicitante,
        subject: /aprovad|bem-vindo/i,
        contains: ["Quality Control", payload.password],
        label: "E-mail de aceite por Empresa",
      });
      if (!approvalEmail) {
        test.info().annotations.push({
          type: "blocked",
          description: "Validacao de e-mail nao executada porque a captura de e-mail nao estava disponivel.",
        });
      }

      const me = await validarLoginUsuarioAprovadoPorApi(approvedContext.request, {
        username: emailSolicitante,
        email: emailSolicitante,
        senha: payload.password,
        perfil: "company_user",
      });

      expect(String(me?.user?.clientId ?? "")).toBe(empresaAtiva.id);
      expect(String(me?.user?.clientSlug ?? "")).toBe(empresaAtiva.slug);
    } finally {
      await adminContext.close();
      await empresaPage.close();
      await approvedContext.close();
    }
  });
});
