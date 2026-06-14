/**
 * Rodar:
 * npx playwright test testes/ui/login/solicitar-acesso/solicitacoes/endpoints-da-tela.ui.spec.ts --project=chromium
 */
import { expect, test } from "../../../../../support/fixtures/test";
import { autenticarSolicitacaoAcessoNaInterface } from "../../../../../support/functions/api/login/solicitar-acesso/compartilhado/autenticar-revisor";
import { endpointsTelaSolicitacoes } from "../../../../../support/functions/api/login/solicitar-acesso/endpoints/solicitacoes.endpoints";
import { localizarElementosTelaSolicitacoes } from "../../../../../support/functions/ui/login/solicitar-acesso/elementos/solicitacoes.elementos";

test("tela de Solicitacoes carrega os endpoints administrativos esperados", async ({
  context,
  page,
}) => {
  await autenticarSolicitacaoAcessoNaInterface(page, "leader_tc");
  await page.close();
  const tela = await context.newPage();

  const chamadas = Promise.all([
    tela.waitForResponse((response) => response.url().endsWith(endpointsTelaSolicitacoes.listar)),
    tela.waitForResponse((response) =>
      response.url().endsWith(endpointsTelaSolicitacoes.listarEmpresas),
    ),
    tela.waitForResponse((response) =>
      response.url().endsWith(endpointsTelaSolicitacoes.listarUsuarios),
    ),
  ]);

  await tela.goto("/admin/access-requests");
  const elementos = localizarElementosTelaSolicitacoes(tela);
  await expect(elementos.titulo).toBeVisible();
  const respostas = await chamadas;
  for (const resposta of respostas) {
    expect(resposta.ok()).toBeTruthy();
  }
});
