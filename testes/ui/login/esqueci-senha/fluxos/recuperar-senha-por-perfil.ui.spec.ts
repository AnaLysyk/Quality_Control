import { test } from "../../../../../support/fixtures/test";
import {
  executarRecuperacaoSenhaPorPerfil,
  perfisEsqueciSenha,
} from "../../../../../support/functions/interface/acessos/esqueci-senha-por-perfil";

test.describe("Esqueci senha - fluxo por perfil", () => {
  for (const perfil of perfisEsqueciSenha) {
    test(`${perfil.label} recupera senha pelo fluxo atual`, async ({ page }) => {
      await executarRecuperacaoSenhaPorPerfil(page, perfil);
    });
  }
});
