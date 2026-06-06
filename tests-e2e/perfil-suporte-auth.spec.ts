import { test, expect } from "./fixtures/test";
import { login, setMockUser } from "./utils/auth";

test("perfil suporte tecnico autentica via mock e acessa area global", async ({ page }) => {
  await setMockUser(page, "technical_support");
  await login(page, "technical_support@demo.test", "Demo@123");

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
