import { test, expect } from "./fixtures/test";
import { ClientListResponseSchema } from "../packages/contracts/src/client";
import { login, setMockUser } from "./utils/auth";


test("@smoke login and load clientes", async ({ page }) => {
  await setMockUser(page, "admin");
  await login(page, "admin@griaule.test", "Griaule@123");

  await expect(page).toHaveURL(/\/admin\/clients/);
  await expect(page.getByRole("heading", { name: /Empresas da plataforma/i })).toBeVisible();

  const apiResponse = await page.request.get("/api/clients");
  expect(apiResponse.ok()).toBeTruthy();
  const payload = ClientListResponseSchema.parse(await apiResponse.json());
  expect(payload.items.length).toBeGreaterThan(0);
});
