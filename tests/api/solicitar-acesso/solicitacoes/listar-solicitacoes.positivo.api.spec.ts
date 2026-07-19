/**
 * Rodar:
 * npx playwright test tests/api/solicitar-acesso/listar-solicitacoes.positivo.api.spec.ts --project=chromium
 */
import { expect, test } from "../../../../tools/fixtures/test";
import { validarApiSolicitacoesAcessivel } from "../../../../tools/functions/api/solicitar-acesso/solicitacoes/executar-acoes-administrativas";
import { autenticarContextoSolicitacaoAcesso } from "../../../../tools/functions/api/solicitar-acesso/autenticacao/autenticar-revisor";
import {
  perfisAutorizadosSolicitacoes,
  perfisNegadosSolicitacoes,
} from "../../../../tools/functions/banco-de-dados/solicitar-acesso/perfis/definir-perfis-teste";

test.describe("Solicitacoes - permissao por perfil na API", () => {
  test("usuario nao autenticado deve receber 401", async ({ request }) => {
    const response = await request.get("/api/admin/access-requests");
    expect(response.status()).toBe(401);
  });

  for (const perfil of perfisAutorizadosSolicitacoes) {
    test(`${perfil.label} deve acessar a API`, async ({ browser }) => {
      const context = await browser.newContext();
      try {
        await autenticarContextoSolicitacaoAcesso(context, perfil.role);
        await validarApiSolicitacoesAcessivel(context.request);
      } finally {
        await context.close();
      }
    });
  }

  for (const perfil of perfisNegadosSolicitacoes) {
    test(`${perfil.label} deve receber 403 na API`, async ({ browser }) => {
      const context = await browser.newContext();
      try {
        await autenticarContextoSolicitacaoAcesso(context, perfil.role);
        const response = await context.request.get("/api/admin/access-requests");
        expect(response.status()).toBe(403);
      } finally {
        await context.close();
      }
    });
  }
});


