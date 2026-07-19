/**
 * Rodar:
 * npx playwright test tests/ui/login/solicitar-acesso/gestao-solicitacoes/acessibilidade/validar-acessibilidade-tela-solicitacoes.ui.spec.ts --project=chromium
 */
import { expect, test } from "../../../../../../tools/fixtures/test";
import { autenticarSolicitacaoAcessoNaInterface } from "../../../../../../tools/functions/api/solicitar-acesso/autenticacao/autenticar-revisor";
import { verificarAcessibilidadeDaPagina } from "../../../../../../tools/functions/ui/acessibilidade/verificar-acessibilidade";
import { localizarElementosTelaSolicitacoes } from "../../../../../../tools/functions/ui/login/solicitar-acesso/elementos/solicitacoes.elementos";

test("tela administrativa não possui violações graves de acessibilidade", async ({
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

