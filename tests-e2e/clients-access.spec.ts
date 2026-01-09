import { test, expect } from "./fixtures/test";
import { login, setMockUser } from "./utils/auth";

test("admin global sees clients list", async ({ page }) => {
  await setMockUser(page, "admin");
  await login(page, "admin@example.com", "senha");

  await page.goto("/admin/clients");
  await expect(page).toHaveURL(/\/admin\/clients/);
  await expect(page.getByRole("heading", { name: /Empresas/i })).toBeVisible();
});

test("user cannot access /admin/clients", async ({ page }) => {
  await setMockUser(page, "user", "griaule");
  await login(page, "user@example.com", "senha");

  await page.goto("/admin/clients");
  await expect(page.getByText(/Acesso restrito a admin global/i)).toBeVisible();
});
