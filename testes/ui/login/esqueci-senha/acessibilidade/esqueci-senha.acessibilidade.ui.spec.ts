/**
 * Rodar:
 * npx playwright test testes/ui/login/esqueci-senha/acessibilidade/esqueci-senha.acessibilidade.ui.spec.ts --project=chromium
 */
import { expect, test } from "@playwright/test";
import { endpointsEsqueciSenha } from "../../../../../support/functions/api/login/esqueci-senha/endpoints/esqueci-senha.endpoints";
import { verificarAcessibilidadeDaPagina } from "../../../../../support/functions/ui/acessibilidade/verificar-acessibilidade";
import { localizarElementosEsqueciSenha } from "../../../../../support/functions/ui/login/esqueci-senha/elementos/esqueci-senha.elementos";

test("tela usa o endpoint de esqueci a senha e atende acessibilidade", async ({ page }) => {
  await page.route(`**${endpointsEsqueciSenha.solicitarRedefinicao}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ message: "Instrucoes enviadas." }),
    });
  });

  await page.goto("/login/forgot-password");
  const elementos = localizarElementosEsqueciSenha(page);
  await expect(elementos.formulario).toBeVisible();
  await verificarAcessibilidadeDaPagina(page);

  const chamada = page.waitForRequest(
    (request) =>
      request.url().endsWith(endpointsEsqueciSenha.solicitarRedefinicao) &&
      request.method() === "POST",
  );
  await elementos.email.fill("acessibilidade@example.com");
  await elementos.enviar.click();
  await chamada;
});
