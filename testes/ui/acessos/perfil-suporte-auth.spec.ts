import { test, expect } from "../../../support/fixtures/test";
import { autenticarUsuario, configurarUsuarioSimulado } from "../../../support/functions/ui/apoio/autenticar-usuario-teste";

test("perfil suporte tecnico autentica via mock e acessa area global", async ({ page }) => {
  await configurarUsuarioSimulado(page, "technical_support");
  await autenticarUsuario(page, "technical_support@demo.test", "Demo@123");

  await expect(page).toHaveURL(/\/admin\/clients/);

  const mePayload = await page.evaluate(async () => {
    const response = await fetch("/api/me");
    return response.json();
  });

  expect(mePayload.user.role).toBe("technical_support");
  expect(mePayload.user.permissionRole).toBe("technical_support");
  expect(mePayload.user.companyRole).toBe("technical_support");

  await expect(page.getByRole("heading", { name: /Lista de empresas/i })).toBeVisible();
});
