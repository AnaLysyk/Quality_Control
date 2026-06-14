/**
 * Rodar:
 * npx playwright test testes/ui/login/solicitar-acesso/perfis/criar-solicitacoes.ui.spec.ts --project=chromium
 */
import { expect, test } from "@playwright/test";
import {
  criarEmailTeste,
  limparEmailsCapturados,
} from "../../../../../support/functions/api/login/solicitar-acesso/compartilhado/capturar-emails";
import { capturarChaveDoEmailSolicitacao } from "../../../../../support/functions/api/login/solicitar-acesso/compartilhado/extrair-chave-email";
import {
  abrirFormularioSolicitacaoPorPerfil,
  perfisSolicitacao,
  preencherFormularioSolicitacaoPorPerfil,
  prepararMocksPublicosSolicitacao,
} from "../../../../../support/functions/ui/login/solicitar-acesso/compartilhado/preencher-formulario-por-perfil";

test.describe("Solicitação de acesso - todos os perfis", () => {
  test.setTimeout(120000);

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

      await preencherFormularioSolicitacaoPorPerfil(page, perfil, email);

      await expect(page.getByTestId("request-access-submit-button")).toBeEnabled({
        timeout: 30000,
      });

      await page.screenshot({
        path: `test-results/access-requests/form-${perfil.value}.png`,
        fullPage: true,
      });

      await page.getByTestId("request-access-submit-button").click();

      const chave = await capturarChaveDoEmailSolicitacao(email);

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
    });
  }
});
