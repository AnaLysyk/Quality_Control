/**
 * Rodar:
 * npx playwright test testes/ui/login/solicitar-acesso/acessibilidade/formulario.acessibilidade.ui.spec.ts --project=chromium
 */
import { expect, test } from "@playwright/test";
import { verificarAcessibilidadeDaPagina } from "../../../../../support/functions/ui/acessibilidade/verificar-acessibilidade";
import { localizarElementosSolicitarAcesso } from "../../../../../support/functions/ui/login/solicitar-acesso/elementos/solicitar-acesso.elementos";

test("formulario publico nao possui violacoes graves de acessibilidade", async ({ page }) => {
  await page.goto("/login/access-request");
  const elementos = localizarElementosSolicitarAcesso(page);
  if (await elementos.botaoAbrirFormulario.isVisible().catch(() => false)) {
    await elementos.botaoAbrirFormulario.click();
  }
  await expect(elementos.formulario).toBeVisible();
  await verificarAcessibilidadeDaPagina(page);
});
