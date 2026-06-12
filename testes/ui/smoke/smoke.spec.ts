import { test, expect } from "../../../support/fixtures/test";
import { ClientListResponseSchema } from "../../../packages/contracts/src/client";
import { autenticarUsuario, configurarUsuarioSimulado } from "../../../support/functions/interface/apoio/autenticar-usuario-teste";

test("@smoke login and load clientes", async ({ page }) => {
  await configurarUsuarioSimulado(page, "admin");
  await autenticarUsuario(page, "admin@demo.test", "Demo@123");

  await expect(page).toHaveURL(/\/admin\/clients/);
  await expect(page.getByRole("heading", { name: /Lista de empresas/i })).toBeVisible();

  const apiResponse = await page.request.get("/api/clients");
  expect(apiResponse.ok()).toBeTruthy();
  const payload = ClientListResponseSchema.parse(await apiResponse.json());
  expect(Array.isArray(payload.items)).toBeTruthy();
});

const supportCriticalRoutes = [
  "/admin/clients",
  "/solicitacoes",
  "/suporte",
  "/suporte/kanban",
  "/chamados",
  "/brain",
  "/brain/perguntar",
  "/admin/users",
  "/admin/permissoes",
];

test("@smoke perfil suporte - rotas criticas carregam sem erro fatal", async ({ page }) => {
  await configurarUsuarioSimulado(page, "admin");
  await autenticarUsuario(page, "admin@demo.test", "Demo@123");

  for (const route of supportCriticalRoutes) {
    const response = await page.goto(route, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    expect(response?.status(), `rota ${route} nao deve retornar erro 5xx`).toBeLessThan(500);

    await expect(
      page.getByText(/404|500|Internal Server Error|Application error|This page could not be found/i),
      `rota ${route} nao deve exibir erro fatal`,
    ).toHaveCount(0);
  }
});
