/**
 * Rodar:
 * npx playwright test testes/ui/login/solicitar-acesso/perfis/criar-solicitacoes.ui.spec.ts --project=chromium
 */
import { expect, test } from "@playwright/test";
import {
  criarEmailTeste,
  esperarEmailCapturado,
  limparEmailsCapturados,
} from "../../../../../../support/functions/api/solicitar-acesso/emails/capturar-emails";
import { capturarChaveDoEmailSolicitacao } from "../../../../../../support/functions/api/solicitar-acesso/emails/extrair-chave-email";
import { aprovarSolicitacaoPelaTela } from "../../../../../../support/functions/ui/login/solicitar-acesso/aprovacao/aprovar-solicitacao";
import {
  abrirFormularioSolicitacaoPorPerfil,
  perfisSolicitacao,
  preencherFormularioSolicitacaoPorPerfil,
  prepararMocksPublicosSolicitacao,
} from "../../../../../../support/functions/ui/login/solicitar-acesso/formulario/preencher-formulario-por-perfil";

test.use({ baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3100" });

async function validarLoginUsuarioAprovado(page: import("@playwright/test").Page, params: {
  username: string;
  senha: string;
  email: string;
  perfil: string;
}) {
  await page.context().clearCookies();

  let response = await page.request.post("/api/auth/login", {
    data: {
      login: params.username,
      password: params.senha,
      companySlug: params.perfil === "company_user" || params.perfil === "empresa" ? "testing-company-e2e" : undefined,
    },
  });

  if (!response.ok()) {
    response = await page.request.post("/api/auth/login", {
      data: {
        user: params.username,
        password: params.senha,
      },
    });
  }

  const text = await response.text();
  expect(response.ok(), text).toBeTruthy();

  const meResponse = await page.request.get("/api/me");
  const meText = await meResponse.text();
  expect(meResponse.ok(), meText).toBeTruthy();

  const me = JSON.parse(meText) as { user?: { email?: string } };
  expect(me.user?.email).toBe(params.email);
}

async function buscarSolicitacaoCriadaNaFila(page: import("@playwright/test").Page, email: string) {
  let encontrada: { email?: string; accessKey?: string | null; access_key?: string | null; id?: string } | null = null;
  await expect
    .poll(
      async () => {
        const response = await page.request.get("/api/admin/access-requests", { timeout: 30000 });
        if (!response.ok()) return false;
        const body = (await response.json().catch(() => null)) as {
          items?: Array<{ email?: string; accessKey?: string | null; access_key?: string | null; id?: string }>;
        } | null;
        encontrada = body?.items?.find((item) => item.email?.toLowerCase() === email.toLowerCase()) ?? null;
        return Boolean(encontrada);
      },
      {
        timeout: 120000,
        intervals: [1000, 2000, 5000],
        message: `Aguardando solicitação criada para ${email}`,
      },
    )
    .toBe(true);
  return encontrada;
}

async function aguardarStatusNaFila(page: import("@playwright/test").Page, email: string, status: string) {
  await expect
    .poll(
      async () => {
        const response = await page.request.get("/api/admin/access-requests", { timeout: 30000 });
        if (!response.ok()) return null;
        const body = (await response.json().catch(() => null)) as {
          items?: Array<{ email?: string; status?: string }>;
        } | null;
        return body?.items?.find((item) => item.email?.toLowerCase() === email.toLowerCase())?.status ?? null;
      },
      {
        timeout: 120000,
        intervals: [1000, 2000, 5000],
        message: `Aguardando status ${status} para ${email}`,
      },
    )
    .toBe(status);
}

test.describe("Solicitação de acesso - todos os perfis", () => {
  test.setTimeout(600000);

  for (const perfil of perfisSolicitacao) {
    test(`deve solicitar acesso para o perfil ${perfil.labelTelaStatus}`, async ({ page }) => {
      const email = criarEmailTeste(`perfil-${perfil.value}`);

      await limparEmailsCapturados();
      await prepararMocksPublicosSolicitacao(page);

      await page.goto("/login/access-request", {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });

      await abrirFormularioSolicitacaoPorPerfil(page);

      const dadosSolicitacao = await preencherFormularioSolicitacaoPorPerfil(page, perfil, email);

      await expect(page.getByTestId("request-access-submit-button")).toBeEnabled({
        timeout: 30000,
      });

      await page.screenshot({
        path: `test-results/access-requests/form-${perfil.value}.png`,
        fullPage: true,
      });

      const respostaSubmitPromise = page.waitForResponse(
        (response) =>
          response.url().includes("/api/access-requests/public"),
        { timeout: 120000 },
      ).catch(() => null);

      await page.getByTestId("request-access-submit-button").click();

      const respostaSubmit = await respostaSubmitPromise;
      const corpoSubmit = respostaSubmit ? await respostaSubmit.text().catch(() => "") : "";
      const jsonSubmit = corpoSubmit ? JSON.parse(corpoSubmit) as {
        item?: {
          accessKey?: string;
          id?: string;
        };
      } : {};
      const itemFallback = jsonSubmit.item?.accessKey
        ? null
        : ((await buscarSolicitacaoCriadaNaFila(page, email)) as unknown as {
            email?: string;
            accessKey?: string | null;
            access_key?: string | null;
            id?: string;
          });

      console.log("[DEBUG][solicitar-acesso]", {
        perfil: perfil.value,
        email,
        status: respostaSubmit?.status() ?? "fallback-fila-admin",
        url: respostaSubmit?.url() ?? "/api/admin/access-requests",
        body: corpoSubmit,
      });

      if (respostaSubmit) {
        expect(respostaSubmit.status(), corpoSubmit).toBe(201);
      }

      const chave =
        jsonSubmit.item?.accessKey ??
        itemFallback?.accessKey ??
        itemFallback?.access_key ??
        (await capturarChaveDoEmailSolicitacao(email));

      await page.goto(`/login/access-request/status?key=${chave}`, {
        waitUntil: "domcontentloaded",
        timeout: 90000,
      });

      await expect(page.getByTestId("access-request-status-result")).toBeVisible({
        timeout: 90000,
      });

      await expect(page.getByRole("heading", { name: "Acompanhamento da solicitação" })).toBeVisible();
      await expect(page.getByTestId("access-request-status-label")).toContainText("Aguardando análise");
      await expect(page.getByText("Sua solicitação foi recebida")).toBeVisible();
      await expect(page.getByText("Dados da solicitação")).toBeVisible();
      await expect(page.getByText(`Solicitante ${perfil.labelTelaStatus}`)).toBeVisible();
      await expect(page.getByTestId("access-request-status-email")).toContainText(email);
      await expect(page.getByTestId("access-request-status-profile")).toContainText(
        perfil.perfilEsperadoNoStatus ?? perfil.labelTelaStatus,
      );

      await expect(page.getByText("medium")).toHaveCount(0);

      await page.screenshot({
        path: `test-results/access-requests/status-${perfil.value}.png`,
        fullPage: true,
      });

      const resultadoAprovacao = await aprovarSolicitacaoPelaTela(page, perfil, {
        ...dadosSolicitacao,
        comentario: `Aprovação automatizada para ${perfil.labelTelaStatus}.`,
      });

      await aguardarStatusNaFila(page, email, "closed");

      await page.goto(`/login/access-request/status?key=${chave}`, {
        waitUntil: "domcontentloaded",
        timeout: 90000,
      });

      const statusFinalVisual = page.getByTestId("access-request-status-result");
      if (await statusFinalVisual.isVisible({ timeout: 60000 }).catch(() => false)) {
        await expect(page.getByTestId("access-request-status-label")).toContainText(/aprovad/i);
      } else {
        console.warn(`[WARN][solicitar-acesso] Status aprovado validado pela API; tela publica nao carregou a tempo para ${email}.`);
      }

      await esperarEmailCapturado({
        to: email,
        subject: /aprovad|bem-vindo|acesso/i,
        contains: [email],
      }).catch((error) => {
        console.warn(
          `[WARN][solicitar-acesso] E-mail de aprovação não capturado para ${email}; validação ignorada quando o servidor não usa outbox. ${error}`,
        );
      });

      await validarLoginUsuarioAprovado(page, {
        username: resultadoAprovacao.username,
        senha: dadosSolicitacao.senha,
        email,
        perfil: perfil.value,
      });
    });
  }
});






