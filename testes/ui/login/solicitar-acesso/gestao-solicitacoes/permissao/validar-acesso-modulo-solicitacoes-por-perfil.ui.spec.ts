/**
 * Rodar:
 * npx playwright test testes/ui/login/solicitar-acesso/gestao-solicitacoes/permissao/validar-acesso-modulo-solicitacoes-por-perfil.ui.spec.ts --project=chromium
 */
import { expect, test } from "../../../../../../support/fixtures/test";
import { autenticarSolicitacaoAcessoNaInterface } from "../../../../../../support/functions/api/solicitar-acesso/autenticacao/autenticar-revisor";
import {
  rotaSolicitacoes,
  perfisAutorizadosSolicitacoes,
  perfisNegadosSolicitacoes,
} from "../../../../../../support/functions/banco-de-dados/solicitar-acesso/perfis/definir-perfis-teste";
import {
  abrirModuloSolicitacoes,
  validarAcessoNegadoAoModuloSolicitacoes,
  validarRotaLegadaRedirecionaParaSolicitacoes,
  validarTelaSolicitacoes,
} from "../../../../../../support/functions/ui/login/solicitar-acesso/solicitacoes/operar-tela-solicitacoes";

test.describe("SolicitaÃ§Ãµes - acesso por perfil - UI", () => {
  for (const perfil of perfisAutorizadosSolicitacoes) {
    test(`${perfil.label} deve fazer login e visualizar o mÃ³dulo SolicitaÃ§Ãµes`, async ({
      context,
      page,
    }) => {
      await autenticarSolicitacaoAcessoNaInterface(page, perfil.role);
      await page.close();
      const modulePage = await context.newPage();

      await abrirModuloSolicitacoes(modulePage);
      await validarTelaSolicitacoes(modulePage);

      await expect(modulePage).toHaveURL(new RegExp(rotaSolicitacoes));
    });
  }

  for (const perfil of perfisNegadosSolicitacoes) {
    test(`${perfil.label} deve fazer login sem acessar o mÃ³dulo SolicitaÃ§Ãµes`, async ({
      context,
      page,
    }) => {
      await autenticarSolicitacaoAcessoNaInterface(page, perfil.role);
      await page.close();
      const modulePage = await context.newPage();
      await validarAcessoNegadoAoModuloSolicitacoes(modulePage);
    });
  }

  test("Empresa deve acessar somente a tela SolicitaÃ§Ãµes dentro do admin", async ({
    context,
    page,
  }) => {
    await autenticarSolicitacaoAcessoNaInterface(page, "company");
    await page.close();

    const solicitacoesPage = await context.newPage();
    await abrirModuloSolicitacoes(solicitacoesPage);
    await validarTelaSolicitacoes(solicitacoesPage);
    await expect(solicitacoesPage).toHaveURL(new RegExp(rotaSolicitacoes));
    await solicitacoesPage.close();

    const adminPage = await context.newPage();
    try {
      await adminPage.goto("/admin/users", { waitUntil: "domcontentloaded", timeout: 60000 });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      expect(message).toContain("ERR_TOO_MANY_REDIRECTS");
      return;
    }
    await expect(adminPage).not.toHaveURL(/\/admin\/users/);
    await expect(adminPage.getByRole("heading", { name: /UsuÃ¡rios|Usuarios/i })).not.toBeVisible({
      timeout: 3000,
    });
  });

  test("rota antiga /admin/requests deve redirecionar para SolicitaÃ§Ãµes", async ({
    context,
    page,
  }) => {
    await autenticarSolicitacaoAcessoNaInterface(page, "leader_tc");
    await page.close();
    const oldRoutePage = await context.newPage();
    await validarRotaLegadaRedirecionaParaSolicitacoes(oldRoutePage);
  });
});

