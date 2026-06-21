/**
 * Rodar:
 * npx playwright test testes/ui/login/solicitar-acesso/consulta/consultar-status.ui.spec.ts --project=chromium
 */
import { test, expect } from "../../../../../support/fixtures/test";
import {
  montarPayloadSolicitacaoPublica,
  criarSolicitacaoPublicaViaApi,
} from "../../../../../support/functions/api/solicitar-acesso/formulario/criar-solicitacao-publica";
import { criarEmailTeste, limparEmailsCapturados } from "../../../../../support/functions/api/solicitar-acesso/emails/capturar-emails";
import {
  aprovarSolicitacaoViaApiV2,
  recusarSolicitacaoViaApiV2,
  solicitarAjusteViaApiV2,
} from "../../../../../support/functions/api/solicitar-acesso/consulta/consultar-status";
import { autenticarSolicitacaoAcessoViaApi } from "../../../../../support/functions/api/solicitar-acesso/autenticacao/autenticar-revisor";
import { abrirStatusPorLink } from "../../../../../support/functions/ui/login/solicitar-acesso/consulta/abrir-consulta-status";

test.describe("Solicitações de acesso - consulta/status UI", () => {
  test.beforeEach(() => {
    limparEmailsCapturados();
  });

  test("deve consultar status e mostrar em análise com datas", async ({ page, request }) => {
    const email = criarEmailTeste("status-ui");
    const payload = montarPayloadSolicitacaoPublica(email);
    const created = await criarSolicitacaoPublicaViaApi(request, payload);

    await abrirStatusPorLink(page, created.accessKey);

    await expect(page.getByTestId("access-request-status-badge")).toContainText(/Aguardando análise|Em análise/i);
    await expect(page.getByTestId("access-request-created-at")).not.toHaveText("-");
    await expect(page.getByTestId("access-request-updated-at")).not.toHaveText("-");
    await expect(page.getByTestId("access-request-status-message")).toContainText(/e-mail/i);
    await expect(page.getByTestId("access-request-requester-email")).toContainText(email);
  });

  test("deve consultar manualmente por e-mail e token", async ({ page, request }) => {
    const email = criarEmailTeste("status-manual");
    const payload = montarPayloadSolicitacaoPublica(email);
    const created = await criarSolicitacaoPublicaViaApi(request, payload);

    await abrirStatusPorLink(page, created.accessKey);

    await expect(page.getByTestId("access-request-status-result")).toBeVisible();
    await expect(page.getByTestId("access-request-requester-email")).toContainText(email);
  });

  test("deve mostrar aprovado quando solicitação for aprovada", async ({ page, request }) => {
    await autenticarSolicitacaoAcessoViaApi(request, "leader_tc");
    const email = criarEmailTeste("status-ui-aprovado");
    const payload = montarPayloadSolicitacaoPublica(email);
    const created = await criarSolicitacaoPublicaViaApi(request, payload);

    await aprovarSolicitacaoViaApiV2(request, created.id);

    await abrirStatusPorLink(page, created.accessKey);

    await expect(page.getByTestId("access-request-status-badge")).toContainText(/Aprovado/i);
    await expect(page.getByTestId("access-request-status-message")).toContainText(/aprovada/i);
  });

  test("deve mostrar recusado quando solicitação for recusada", async ({ page, request }) => {
    await autenticarSolicitacaoAcessoViaApi(request, "leader_tc");
    const email = criarEmailTeste("status-ui-recusado");
    const payload = montarPayloadSolicitacaoPublica(email);
    const created = await criarSolicitacaoPublicaViaApi(request, payload);

    await recusarSolicitacaoViaApiV2(request, created.id);

    await abrirStatusPorLink(page, created.accessKey);

    await expect(page.getByTestId("access-request-status-badge")).toContainText(/Rejeitado|Recusado/i);
    await expect(page.getByTestId("access-request-status-message")).toContainText(/rejeitada|recusada/i);
    await expect(page.getByTestId("access-request-review-comment")).toContainText(/Rejeitado|Recusado/i);
  });

  test("deve mostrar campos de correção quando houver ajuste", async ({ page, request }) => {
    await autenticarSolicitacaoAcessoViaApi(request, "leader_tc");
    const email = criarEmailTeste("status-ui-ajuste");
    const payload = montarPayloadSolicitacaoPublica(email);
    const created = await criarSolicitacaoPublicaViaApi(request, payload);

    await solicitarAjusteViaApiV2(request, created.id);

    await abrirStatusPorLink(page, created.accessKey);

    await expect(page.getByTestId("access-request-status-badge")).toContainText(/Ajuste necessário/i);
    await expect(page.getByTestId("access-request-status-message")).toContainText(/Corrija|correção/i);
    await expect(page.getByTestId("access-request-adjustment-fields")).toContainText("Telefone");
    await expect(page.getByTestId("access-request-adjustment-fields")).toContainText("Descrição");
  });
});

