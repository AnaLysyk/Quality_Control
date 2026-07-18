import { test } from "../../../../../tools/fixtures/test";
import {
  executarRecuperacaoSenhaPorPerfil,
  obterPerfilEsqueciSenha,
} from "../../../../../tools/functions/ui/login/esqueci-senha/compartilhado/esqueci-senha-por-perfil";

test.describe("Esqueci senha - Usuario da Empresa", () => {
  test.setTimeout(300000);

  test("recupera senha, invalida token e preserva vinculo de empresa", async ({ page }) => {
    await executarRecuperacaoSenhaPorPerfil(page, obterPerfilEsqueciSenha("usuario-empresa"));
  });
});

