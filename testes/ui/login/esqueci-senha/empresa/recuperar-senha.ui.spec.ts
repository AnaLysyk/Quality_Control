import { test } from "../../../../../support/fixtures/test";
import {
  executarRecuperacaoSenhaPorPerfil,
  obterPerfilEsqueciSenha,
} from "../../../../../support/functions/interface/acessos/esqueci-senha-por-perfil";

test.describe("Esqueci senha - Empresa", () => {
  test("recupera senha, invalida token e preserva vinculo de empresa", async ({ page }) => {
    await executarRecuperacaoSenhaPorPerfil(page, obterPerfilEsqueciSenha("empresa"));
  });
});
