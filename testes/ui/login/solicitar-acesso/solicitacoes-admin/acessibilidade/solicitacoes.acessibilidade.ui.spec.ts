/**
 * Rodar:
 * npx playwright test testes/ui/login/solicitar-acesso/solicitacoes/solicitacoes.acessibilidade.ui.spec.ts --project=chromium
 */
import { expect, test } from "../../../../../support/fixtures/test";
import { autenticarSolicitacaoAcessoNaInterface } from "../../../../../support/functions/api/solicitar-acesso/autenticacao/autenticar-revisor";
import { verificarAcessibilidadeDaPagina } from "../../../../../support/functions/ui/acessibilidade/verificar-acessibilidade";
import { localizarElementosTelaSolicitacoes } from "../../../../../support/functions/ui/login/solicitar-acesso/elementos/solicitacoes.elementos";

test("tela administrativa nao possui violacoes graves de acessibilidade", async ({
  context,
  page,
}) => {
  await autenticarSolicitacaoAcessoNaInterface(page, "technical_support");
  await page.close();
  const tela = await context.newPage();
  await tela.goto("/admin/access-requests");

  await expect(localizarElementosTelaSolicitacoes(tela).titulo).toBeVisible();
  await verificarAcessibilidadeDaPagina(tela);
});

