/**
 * Rodar:
 * npx playwright test tests/ui/login/solicitar-acesso/consulta-status/consultar-status-solicitacao-por-perfil.visual.ui.spec.ts --project=chromium --headed --workers=1 --reporter=list
 */

import { test } from "@playwright/test";

import { perfisSolicitacao } from "../../../../../tools/functions/ui/login/solicitar-acesso/formulario/preencher-formulario-por-perfil";
import { executarConsultaStatusSolicitacaoPorPerfil } from "../../../../../tools/functions/ui/login/solicitar-acesso/consulta/executar-consulta-status-por-perfil";

test.describe("VISUAL - Consulta de status da solicitação por perfil", () => {
  test.setTimeout(180000);

  for (const perfil of perfisSolicitacao) {
    test(`deve solicitar acesso, validar e-mail e consultar status para o perfil ${perfil.labelTelaStatus}`, async ({ page }) => {
      await executarConsultaStatusSolicitacaoPorPerfil(page, perfil);
    });
  }
});

