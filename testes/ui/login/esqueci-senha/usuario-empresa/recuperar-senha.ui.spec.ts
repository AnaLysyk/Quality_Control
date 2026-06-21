import { test } from "../../../../../support/fixtures/test";
import {
  executarRecuperacaoSenhaPorPerfil,
  obterPerfilEsqueciSenha,
} from "../../../../../support/functions/ui/login/esqueci-senha/compartilhado/esqueci-senha-por-perfil";

test.describe("Esqueci senha - Usuario da Empresa", () => {
  test("recupera senha, invalida token e preserva vinculo de empresa", async ({ page }) => {
    await executarRecuperacaoSenhaPorPerfil(page, obterPerfilEsqueciSenha("usuario-empresa"));
  });
});
