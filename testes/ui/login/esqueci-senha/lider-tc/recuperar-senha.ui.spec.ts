import { test } from "../../../../../support/fixtures/test";
import {
  executarRecuperacaoSenhaPorPerfil,
  obterPerfilEsqueciSenha,
} from "../../../../../support/functions/ui/login/esqueci-senha/compartilhado/esqueci-senha-por-perfil";

test.describe("Esqueci senha - Lider TC", () => {
  test.setTimeout(300000);

  test("recupera senha, invalida token e mantem perfil administrativo", async ({ page }) => {
    await executarRecuperacaoSenhaPorPerfil(page, obterPerfilEsqueciSenha("lider-tc"));
  });
});

