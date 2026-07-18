import { test } from "../../../../../tools/fixtures/test";
import {
  executarRecuperacaoSenhaPorPerfil,
  obterPerfilEsqueciSenha,
} from "../../../../../tools/functions/ui/login/esqueci-senha/compartilhado/esqueci-senha-por-perfil";

test.describe("Esqueci senha - Suporte Tecnico", () => {
  test.setTimeout(300000);

  test("recupera senha, invalida token e mantem perfil administrativo", async ({ page }) => {
    await executarRecuperacaoSenhaPorPerfil(page, obterPerfilEsqueciSenha("suporte-tecnico"));
  });
});

