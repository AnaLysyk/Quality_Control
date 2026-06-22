/**
 * Rodar:
 * npx playwright test testes/ui/login/solicitar-acesso/gestao-solicitacoes/fluxo-completo/solicitacao-ajuste-aprovacao.ui.spec.ts --headed --workers=1 --reporter=list
 */
import { expect, test } from "@playwright/test";
import type { APIRequestContext, Page } from "@playwright/test";

import { autenticarContextoSolicitacaoAcesso } from "../../../../../../support/functions/api/solicitar-acesso/autenticacao/autenticar-revisor";
import {
  criarSolicitacaoPublicaComChave,
  montarPayloadSolicitacaoFluxo,
  validarLoginUsuarioAprovadoPorApi,
} from "../../../../../../support/functions/api/solicitar-acesso/fluxos/fluxo-ajustes-recusa";
import { criarEmailTeste } from "../../../../../../support/functions/api/solicitar-acesso/emails/capturar-emails";

test.use({ baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3100" });

async function aguardarSolicitacaoNaApi(request: APIRequestContext, email: string) {
  await expect
    .poll(
      async () => {
        const response = await request.get("/api/admin/access-requests", { timeout: 30000 });
        if (!response.ok()) return false;
        const body = (await response.json()) as { items?: Array<{ email?: string; requesterEmail?: string }> };
        return body.items?.some((item) => item.email === email || item.requesterEmail === email) ?? false;
      },
      { timeout: 120000, intervals: [1000, 2000, 5000] },
    )
    .toBe(true);
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

async function abrirSolicitacaoNaTela(page: Page, email: string) {
  await page.goto("/admin/access-requests", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Solicitações de acesso" })).toBeVisible({
    timeout: 60000,
  });

  for (let tentativa = 0; tentativa < 3; tentativa += 1) {
    await page.getByTestId("access-requests-search-input").fill(email);
    const item = page.getByText(email).first();
    try {
      await expect(item).toBeVisible({ timeout: 45000 });
      await item.click();
      return;
    } catch (error) {
      if (tentativa === 2) throw error;
      await page.getByRole("button", { name: /Atualizar/i }).click().catch(() => undefined);
      await page.waitForTimeout(1500);
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: "Solicitações de acesso" })).toBeVisible({
        timeout: 60000,
      });
    }
  }
}

test.describe("Solicitação de acesso - fluxo completo pela UI interna", () => {
  test.setTimeout(360000);

  test("deve solicitar ajuste, corrigir pela consulta pública e aprovar pela tela", async ({ browser }) => {
    const adminContext = await browser.newContext();
    const approvedContext = await browser.newContext();
    const page = await adminContext.newPage();

    try {
      await autenticarContextoSolicitacaoAcesso(adminContext, "leader_tc");

      const email = criarEmailTeste("ui-ajuste-aprovacao");
      const payload = montarPayloadSolicitacaoFluxo(email, {
        requestedRole: "technical_support",
      });
      const created = await criarSolicitacaoPublicaComChave(adminContext.request, payload);

      await aguardarSolicitacaoNaApi(adminContext.request, email);
      await abrirSolicitacaoNaTela(page, email);

      const conversa = page.getByPlaceholder(/Descreva o ajuste/i);
      await conversa.fill("Favor corrigir o telefone antes da aprovação final.");
      await page.getByRole("button", { name: "Telefone" }).click();
      await page
        .getByTestId("access-request-adjustment-comment-phone")
        .fill("Telefone precisa conter DDD e número atualizado.");

      await page.getByRole("button", { name: /Solicitar ajuste/i }).click();
      await aguardarStatusPublico(adminContext.request, created.accessKey, "needs_more_info");

      await page.goto(`/login/access-request/status?key=${encodeURIComponent(created.accessKey)}`, {
        waitUntil: "domcontentloaded",
      });
      await expect(page.getByTestId("access-request-status-result")).toBeVisible({
        timeout: 30000,
      });
      await expect(page.getByTestId("access-request-status-label")).toContainText(/Ajuste|Corre/i);
      await page.getByTestId("access-request-adjust-phone").fill("+55 51 98888-5555");
      await page.getByTestId("access-request-adjust-submit").click();
      await expect(page.getByTestId("access-request-status-label")).toContainText(/análise|analise|Aguardando/i, {
        timeout: 30000,
      });

      await abrirSolicitacaoNaTela(page, email);

      await expect(page.getByText("Correcao reenviada").or(page.getByText("Correção reenviada")).first()).toBeVisible({
        timeout: 30000,
      });
      await page.getByLabel("Tipo de perfil").selectOption({ label: "Suporte Técnico" });
      await page.getByPlaceholder(/Descreva o ajuste/i).fill("Dados corrigidos e aprovados pela UI.");
      await page.getByRole("button", { name: /Aprovar solicitação/i }).click();
      await aguardarStatusPublico(adminContext.request, created.accessKey, "approved");

      await page.goto(`/login/access-request/status?key=${encodeURIComponent(created.accessKey)}`, {
        waitUntil: "domcontentloaded",
      });
      await expect(page.getByTestId("access-request-status-label")).toContainText(/aprovad/i, {
        timeout: 30000,
      });

      await validarLoginUsuarioAprovadoPorApi(approvedContext.request, {
        username: email,
        email,
        senha: payload.password,
        perfil: "technical_support",
      });
    } finally {
      await adminContext.close();
      await approvedContext.close();
    }
  });
});
