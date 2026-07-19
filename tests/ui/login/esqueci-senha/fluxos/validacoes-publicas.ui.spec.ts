import { expect, test } from "../../../../../tools/fixtures/test";
import {
  validarRespostaGenericaEsqueciSenha,
  validarTokenInvalidoEsqueciSenha,
} from "../../../../../tools/functions/ui/login/esqueci-senha/compartilhado/esqueci-senha-por-perfil";

test.describe("Esqueci senha - validacoes publicas", () => {
  test("tela publica abre sem login", async ({ page }) => {
    await page.goto("/login/forgot-password", { waitUntil: "domcontentloaded" });
    await expect(page).not.toHaveURL(/\/login(\?|$)/, { timeout: 10000 });
    await expect(page.getByTestId("forgot-password-form")).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId("forgot-password-email-input")).toBeVisible();
  });

  test("resposta nao permite enumerar e-mail cadastrado", async ({ page }) => {
    await validarRespostaGenericaEsqueciSenha(page);
  });

  test("token invalido nao pode ser validado nem consumido", async ({ page }) => {
    await validarTokenInvalidoEsqueciSenha(page);
  });
});

