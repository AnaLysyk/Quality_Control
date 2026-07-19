/**
 * Rodar:
 * npx playwright test tests/ui/login/solicitar-acesso/gestao-solicitacoes/endpoints/validar-endpoints-tela-solicitacoes.ui.spec.ts --project=chromium
 */
import { expect, test } from "../../../../../../tools/fixtures/test";
import { autenticarSolicitacaoAcessoNaInterface } from "../../../../../../tools/functions/api/solicitar-acesso/autenticacao/autenticar-revisor";
import { endpointsTelaSolicitacoes } from "../../../../../../tools/functions/api/solicitar-acesso/endpoints/solicitacoes.endpoints";
import { localizarElementosTelaSolicitacoes } from "../../../../../../tools/functions/ui/login/solicitar-acesso/elementos/solicitacoes.elementos";

test("tela de Solicitações carrega os endpoints administrativos esperados", async ({
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

