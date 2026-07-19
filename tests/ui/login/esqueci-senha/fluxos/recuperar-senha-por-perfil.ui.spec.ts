import { test } from "../../../../../tools/fixtures/test";
import {
  executarRecuperacaoSenhaPorPerfil,
  perfisEsqueciSenha,
} from "../../../../../tools/functions/ui/login/esqueci-senha/compartilhado/esqueci-senha-por-perfil";

test.describe("Esqueci senha - fluxo por perfil", () => {
  test.setTimeout(300000);

  for (const perfil of perfisEsqueciSenha) {
    test(`${perfil.label} recupera senha pelo fluxo atual`, async ({ page }) => {
      await executarRecuperacaoSenhaPorPerfil(page, perfil);
    });
  }
});

