/**
 * Regression Guard â€” telas crÃ­ticas da plataforma
 *
 * Garante que nenhuma tela crÃ­tica retorne 404 ou quebra silenciosamente.
 * Executar em CI a cada push para detectar regressÃµes de rota/componente.
 *
 * @tag @regression-guard
 */
import { test, expect } from "../../../support/fixtures/test";
import { configurarUsuarioSimulado } from "../../../support/functions/ui/apoio/autenticar-usuario-teste";

// â”€â”€ helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function assertPageLoads(
  page: import("@playwright/test").Page,
  path: string,
  label: string,
  timeoutMs = 20_000,
) {
  try {
    await page.goto(path, { waitUntil: "domcontentloaded", timeout: timeoutMs });
  } catch {
    // Retry Ãºnico para reduzir flakiness de pÃ¡ginas mais pesadas em CI/headed.
    await page.goto(path, { waitUntil: "domcontentloaded", timeout: Math.max(timeoutMs, 45_000) });
  }

  // NÃ£o deve cair em 404 do Next (componente not-found)
  const bodyText = await page.locator("body").innerText({ timeout: 10_000 });
  expect(bodyText, `${label}: nÃ£o deve mostrar "not found"`).not.toMatch(
    /this page could not be found|404|pÃ¡gina nÃ£o encontrada/i,
  );

  // NÃ£o deve ter erro de runtime exposto no DOM
  const errorOverlay = page.locator("#nextjs__container_errors_label");
  await expect(errorOverlay, `${label}: sem overlay de erro Next`).not.toBeVisible();
}

// â”€â”€ setup â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

test.beforeEach(async ({ page }) => {
  await configurarUsuarioSimulado(page, "admin");
});

// â”€â”€ ROTAS GLOBAIS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

test("@regression-guard home renderiza", async ({ page }) => {
  await assertPageLoads(page, "/home", "Home");
  await expect(page.locator("body")).toBeVisible();
});

test("@regression-guard dashboard operaÃ§Ãµes renderiza", async ({ page }) => {
  await assertPageLoads(page, "/operacoes/dashboard", "Dashboard OperaÃ§Ãµes");
});

test("@regression-guard repositÃ³rio casos de teste renderiza", async ({ page }) => {
  await assertPageLoads(page, "/casos-de-teste", "RepositÃ³rio Casos de Teste");
});

test("@regression-guard admin users renderiza", async ({ page }) => {
  await assertPageLoads(page, "/admin/users", "Admin Users");
});

test("@regression-guard admin clients renderiza", async ({ page }) => {
  await assertPageLoads(page, "/admin/clients", "Admin Clients");
});

test("@regression-guard admin permissÃµes renderiza", async ({ page }) => {
  await assertPageLoads(page, "/admin/permissoes", "Admin PermissÃµes");
});

test("@regression-guard audit logs renderiza", async ({ page }) => {
  test.slow();
  await assertPageLoads(page, "/admin/audit-logs", "Audit Logs (direto)", 45_000);
});

test("@regression-guard audit-logs redirect funciona", async ({ page }) => {
  await page.goto("/audit-logs?source=admin", { waitUntil: "domcontentloaded" });
  // Deve redirecionar para /admin/audit-logs
  expect(page.url()).toMatch(/\/admin\/audit-logs/);
  const bodyText = await page.locator("body").innerText({ timeout: 10_000 });
  expect(bodyText).not.toMatch(/this page could not be found|404|pÃ¡gina nÃ£o encontrada/i);
});

test("@regression-guard defeitos redirect funciona", async ({ page }) => {
  await page.goto("/defeitos", { waitUntil: "domcontentloaded" });
  // Deve redirecionar para /admin/defeitos
  expect(page.url()).toMatch(/\/admin\/defeitos/);
  const bodyText = await page.locator("body").innerText({ timeout: 10_000 });
  expect(bodyText).not.toMatch(/this page could not be found|404|pÃ¡gina nÃ£o encontrada/i);
});

// â”€â”€ AUTOMAÃ‡ÃƒO â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

test("@regression-guard playwright studio renderiza", async ({ page }) => {
  await assertPageLoads(page, "/automacoes/playwright", "Playwright Studio");
  // Garante que o placeholder de "editor nÃ£o disponÃ­vel" sumiu
  await expect(
    page.getByText("Instale @monaco-editor/react para habilitar"),
  ).not.toBeVisible();
});

test("@regression-guard api lab renderiza", async ({ page }) => {
  await assertPageLoads(page, "/automacoes/api-lab", "API Lab");
});

test("@regression-guard ferramentas automaÃ§Ã£o renderiza", async ({ page }) => {
  await assertPageLoads(page, "/automacoes/tools", "Automation Tools");
});

test("@regression-guard base64 studio renderiza", async ({ page }) => {
  await assertPageLoads(page, "/automacoes/base64", "Base64 Studio");
});

test("@regression-guard ui studio renderiza", async ({ page }) => {
  await assertPageLoads(page, "/automacoes/ui-studio", "UI Studio");
});

test("@regression-guard execuÃ§Ãµes automaÃ§Ã£o renderiza", async ({ page }) => {
  await assertPageLoads(page, "/automacoes/execucoes", "ExecuÃ§Ãµes AutomaÃ§Ã£o");
});

test("@regression-guard arquivos automaÃ§Ã£o renderiza", async ({ page }) => {
  await assertPageLoads(page, "/automacoes/arquivos", "Arquivos AutomaÃ§Ã£o");
});

// â”€â”€ BRAIN / BRIAN â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

test("@regression-guard brain/brian renderiza", async ({ page }) => {
  await assertPageLoads(page, "/brain", "Brain");
});

test("@regression-guard brain perguntar renderiza", async ({ page }) => {
  await assertPageLoads(page, "/brain/perguntar", "Brain - Perguntar");
});

// â”€â”€ DOCUMENTOS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

test("@regression-guard documentos renderiza", async ({ page }) => {
  await assertPageLoads(page, "/documentos", "Documentos");
});

test("@regression-guard repositÃ³rio documentos renderiza", async ({ page }) => {
  await assertPageLoads(page, "/documentos/repositorio", "RepositÃ³rio Documentos");
});

// â”€â”€ SUPORTE / CHAMADOS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

test("@regression-guard kanban-it renderiza", async ({ page }) => {
  await assertPageLoads(page, "/kanban-it", "Kanban IT");
});

test("@regression-guard suporte redireciona sem loop", async ({ page }) => {
  const response = await page.goto("/suporte", { waitUntil: "domcontentloaded" });
  // NÃ£o pode ficar em /suporte â€” deve redirecionar
  expect(page.url()).not.toMatch(/\/suporte\/?$/);
  // Resposta HTTP deve ser 200 (nÃ£o 404)
  expect(response?.status()).not.toBe(404);
});

// â”€â”€ SOLICITAÃ‡Ã•ES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

test("@regression-guard solicitaÃ§Ãµes renderiza", async ({ page }) => {
  await assertPageLoads(page, "/solicitacoes", "SolicitaÃ§Ãµes");
});

// â”€â”€ CHAT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

test("@regression-guard chat renderiza", async ({ page }) => {
  await assertPageLoads(page, "/chat", "Chat");
});

// â”€â”€ EMPRESA â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

test("@regression-guard planos de teste por empresa renderiza", async ({ page }) => {
  // Usar slug 'demo' como exemplo; se nÃ£o existir, tela deve renderizar de forma controlada
  await page.goto("/empresas/griaule/planos-de-teste", { waitUntil: "domcontentloaded" });
  const body = await page.locator("body").innerText({ timeout: 8_000 });
  // NÃ£o pode ser erro 500 ou crash
  expect(body).not.toMatch(/application error|internal server error|unhandled error/i);
});

test("@regression-guard runs por empresa renderiza", async ({ page }) => {
  await page.goto("/empresas/griaule/runs", { waitUntil: "domcontentloaded" });
  const body = await page.locator("body").innerText({ timeout: 8_000 });
  expect(body).not.toMatch(/application error|internal server error|unhandled error/i);
});

