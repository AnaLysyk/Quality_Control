import { expect, test } from "./fixtures/test";
import { mockAuth } from "./helpers/mockAuth";

test.describe("Tela de Automação", () => {
  test("@smoke @case=TC-AUTO-001 admin acessa /automacoes/tools e vê o Studio", async ({ page, context }) => {
    await mockAuth(context, { role: "admin" });
    await page.goto("/automacoes/tools");

    // Cabeçalho do módulo deve estar visível
    await expect(page.getByRole("heading", { name: /Automation Studio/i }).or(
      page.getByText(/Studio|Automação|automação/i).first()
    )).toBeVisible({ timeout: 15000 });

    // URL deve permanecer em /automacoes
    await expect(page).toHaveURL(/\/automacoes/);
  });

  test("@case=TC-AUTO-002 admin vê seção do Biometric Runner na página de execuções", async ({ page, context }) => {
    await mockAuth(context, { role: "admin" });
    await page.goto("/automacoes/execucoes");

    await expect(page.getByText(/Biometria Griaule/i)).toBeVisible({ timeout: 15000 });
  });

  test("@case=TC-AUTO-003 admin vê lista de casos em /automacoes/casos", async ({ page, context }) => {
    await mockAuth(context, { role: "admin" });
    await page.goto("/automacoes/casos");

    // Pode estar vazia mas deve renderizar a página sem erro
    await expect(page).toHaveURL(/\/automacoes\/casos/);
    await expect(page.locator("body")).not.toContainText("Application error");
  });

  test("@case=TC-AUTO-004 seletores do Biometric Runner não exibem estado quebrado (sem option vazia visível)", async ({ page, context }) => {
    await mockAuth(context, { role: "admin" });
    await page.goto("/automacoes/execucoes");

    // Aguarda o runner carregar (pode ser lazy)
    const runnerSection = page.getByText(/Biometria Griaule/i);
    await expect(runnerSection).toBeVisible({ timeout: 15000 });

    // Verifica que o select de Empresa não está desabilitado (lista carregada)
    const companySelect = page.locator("select").filter({ hasText: /griaule|testing|empresa/i }).first();
    await expect(companySelect).not.toBeDisabled({ timeout: 8000 });
  });

  test("@case=TC-AUTO-005 API Lab abre em /automacoes/api-lab sem erros", async ({ page, context }) => {
    await mockAuth(context, { role: "admin" });
    await page.goto("/automacoes/api-lab");

    await expect(page).toHaveURL(/\/automacoes\/api-lab/);
    await expect(page.locator("body")).not.toContainText("Application error");

    // Verifica que o campo de Método aparece
    await expect(page.getByText(/Método|Method/i).first()).toBeVisible({ timeout: 10000 });
  });

  test("@case=TC-AUTO-006 collection SC Integration API v2 aparece organizada na tela", async ({ page, context }) => {
    await mockAuth(context, { role: "admin" });
    await page.goto("/automacoes/tools");

    await expect(page.getByText(/SC Integration API v2/i)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/Coleção importada/i)).toBeVisible({ timeout: 15000 });
  });
});
