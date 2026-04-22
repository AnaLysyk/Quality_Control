import { expect, test } from "./fixtures/test";
import { mockAuth } from "./helpers/mockAuth";

async function authenticateAdmin(context: Parameters<typeof mockAuth>[0]) {
  let lastError: unknown = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await mockAuth(context, { role: "admin" });
      return;
    } catch (error) {
      lastError = error;
      if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Falha ao autenticar admin.");
}

test.describe("Tela de Automacao", () => {
  test("@smoke @case=TC-AUTO-001 admin acessa /automacoes/tools e ve a area Tools", async ({ page, context }) => {
    await authenticateAdmin(context);
    await page.goto("/automacoes/tools");

    await expect(page.getByText(/^Tools$/)).toBeVisible({ timeout: 15000 });
    await expect(page.getByLabel(/Ambiente de execução/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /Rodar/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Consultar RFB/i })).toBeVisible();
  });

  test("@case=TC-AUTO-002 admin ve o runner biometrico na pagina de execucoes", async ({ page, context }) => {
    await authenticateAdmin(context);
    await page.goto("/automacoes/execucoes");

    await expect(page.getByRole("heading", { name: /Fila, filtros e detalhe em modal/i })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/Fim da lista carregada/i)).toBeVisible({ timeout: 15000 });
  });

  test("@case=TC-AUTO-003 admin ve lista de casos em /automacoes/casos", async ({ page, context }) => {
    await authenticateAdmin(context);
    await page.goto("/automacoes/casos");

    await expect(page).toHaveURL(/\/automacoes\/casos/);
    await expect(page.locator("body")).not.toContainText("Application error");
  });

  test("@case=TC-AUTO-004 seletores da pagina de execucoes nao quebram", async ({ page, context }) => {
    await authenticateAdmin(context);
    await page.goto("/automacoes/execucoes");

    await expect(page.getByRole("heading", { name: /Fila, filtros e detalhe em modal/i })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("combobox", { name: /Empresa ativa/i })).toBeEnabled();
    await expect(page.getByLabel(/Filtrar por rota/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /Atualizar/i })).toBeVisible();
  });

  test("@case=TC-AUTO-005 API Lab abre em /automacoes/api-lab sem erros", async ({ page, context }) => {
    await authenticateAdmin(context);
    await page.goto("/automacoes/api-lab");

    await expect(page).toHaveURL(/\/automacoes\/api-lab/);
    await expect(page.locator("body")).not.toContainText("Application error");
    await expect(page.getByLabel(/Método HTTP/i)).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("button", { name: /Executar/i })).toBeVisible();
  });

  test("@case=TC-AUTO-006 catalogo importado aparece no workbench", async ({ page, context }) => {
    await authenticateAdmin(context);
    await page.goto("/automacoes/tools");

    await expect(page.getByRole("button", { name: /Anexar biometria/i })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/Request gerada/i)).toBeVisible({ timeout: 15000 });
  });

  test("@case=TC-AUTO-007 Base64 abre em /automacoes/base64 sem erros", async ({ page, context }) => {
    await authenticateAdmin(context);
    await page.goto("/automacoes/base64");

    await expect(page).toHaveURL(/\/automacoes\/base64/);
    await expect(page.locator("body")).not.toContainText("Application error");
    await expect(page.getByText(/Conversor Base64/i)).toBeVisible({ timeout: 15000 });
  });

  test("@case=TC-AUTO-008 Arquivos abre em /automacoes/arquivos sem erros", async ({ page, context }) => {
    await authenticateAdmin(context);
    await page.goto("/automacoes/arquivos");

    await expect(page).toHaveURL(/\/automacoes\/arquivos/);
    await expect(page.locator("body")).not.toContainText("Application error");
    await expect(page.getByText(/Documentos & Assets/i)).toBeVisible({ timeout: 15000 });
  });

  test("@case=TC-AUTO-009 Logs abre em /automacoes/logs sem erros", async ({ page, context }) => {
    await authenticateAdmin(context);
    await page.goto("/automacoes/logs");

    await expect(page).toHaveURL(/\/automacoes\/logs/);
    await expect(page.locator("body")).not.toContainText("Application error");
    await expect(page.getByText(/Console \u00b7 Logs de Automacao/i)).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("button", { name: /Atualizar/i })).toBeVisible({ timeout: 15000 });
  });

  test("@case=TC-AUTO-010 Scripts abre em /automacoes/scripts sem erros", async ({ page, context }) => {
    await authenticateAdmin(context);
    await page.goto("/automacoes/scripts");

    await expect(page).toHaveURL(/\/automacoes\/scripts/);
    await expect(page.locator("body")).not.toContainText("Application error");
    await expect(page.getByText(/Script do fluxo/i)).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("textbox", { name: /Editor de script/i })).toBeVisible({ timeout: 15000 });
  });

  test("@case=TC-AUTO-011 Fluxos abre em /automacoes/fluxos sem erros", async ({ page, context }) => {
    await authenticateAdmin(context);
    await page.goto("/automacoes/fluxos");

    await expect(page).toHaveURL(/\/automacoes\/fluxos/);
    await expect(page.locator("body")).not.toContainText("Application error");
    await expect(page.getByRole("button", { name: /Visão geral/i })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("button", { name: /Etapas/i })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("button", { name: /Preparar execução/i })).toBeVisible({ timeout: 15000 });
  });

  test("@case=TC-AUTO-012 ambiente exige URL base e token no Studio", async ({ page, context }) => {
    await authenticateAdmin(context);
    await page.goto("/automacoes/tools");

    await expect(page).toHaveURL(/\/automacoes\/tools/);
    await expect(page.locator("body")).not.toContainText("Application error");

    const environmentSelect = page.getByLabel(/Ambiente de execução/i);
    await expect(environmentSelect).toBeVisible({ timeout: 15000 });
    await environmentSelect.selectOption({ label: "Produção segura" });

    await expect(page.getByLabel(/URL base/i)).toBeVisible({ timeout: 15000 });
    await expect(page.getByLabel(/Token/i)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/Request gerada/i)).toBeVisible({ timeout: 15000 });
  });
});
