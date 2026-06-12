/**
 * Regression Guard — telas críticas da plataforma
 *
 * Garante que nenhuma tela crítica retorne 404 ou quebra silenciosamente.
 * Executar em CI a cada push para detectar regressões de rota/componente.
 *
 * @tag @regression-guard
 */
import { test, expect } from "../../../support/fixtures/test";
import { configurarUsuarioSimulado } from "../../../support/functions/interface/apoio/autenticar-usuario-teste";

// ── helpers ───────────────────────────────────────────────────────────────────

async function assertPageLoads(
  page: import("@playwright/test").Page,
  path: string,
  label: string,
  timeoutMs = 20_000,
) {
  try {
    await page.goto(path, { waitUntil: "domcontentloaded", timeout: timeoutMs });
  } catch {
    // Retry único para reduzir flakiness de páginas mais pesadas em CI/headed.
    await page.goto(path, { waitUntil: "domcontentloaded", timeout: Math.max(timeoutMs, 45_000) });
  }

  // Não deve cair em 404 do Next (componente not-found)
  const bodyText = await page.locator("body").innerText({ timeout: 10_000 });
  expect(bodyText, `${label}: não deve mostrar "not found"`).not.toMatch(
    /this page could not be found|404|página não encontrada/i,
  );

  // Não deve ter erro de runtime exposto no DOM
  const errorOverlay = page.locator("#nextjs__container_errors_label");
  await expect(errorOverlay, `${label}: sem overlay de erro Next`).not.toBeVisible();
}

// ── setup ─────────────────────────────────────────────────────────────────────

test.beforeEach(async ({ page }) => {
  await configurarUsuarioSimulado(page, "admin");
});

// ── ROTAS GLOBAIS ─────────────────────────────────────────────────────────────

test("@regression-guard home renderiza", async ({ page }) => {
  await assertPageLoads(page, "/home", "Home");
  await expect(page.locator("body")).toBeVisible();
});

test("@regression-guard dashboard operações renderiza", async ({ page }) => {
  await assertPageLoads(page, "/operacoes/dashboard", "Dashboard Operações");
});

test("@regression-guard repositório casos de teste renderiza", async ({ page }) => {
  await assertPageLoads(page, "/casos-de-teste", "Repositório Casos de Teste");
});

test("@regression-guard admin users renderiza", async ({ page }) => {
  await assertPageLoads(page, "/admin/users", "Admin Users");
});

test("@regression-guard admin clients renderiza", async ({ page }) => {
  await assertPageLoads(page, "/admin/clients", "Admin Clients");
});

test("@regression-guard admin permissões renderiza", async ({ page }) => {
  await assertPageLoads(page, "/admin/permissoes", "Admin Permissões");
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
  expect(bodyText).not.toMatch(/this page could not be found|404|página não encontrada/i);
});

test("@regression-guard defeitos redirect funciona", async ({ page }) => {
  await page.goto("/defeitos", { waitUntil: "domcontentloaded" });
  // Deve redirecionar para /admin/defeitos
  expect(page.url()).toMatch(/\/admin\/defeitos/);
  const bodyText = await page.locator("body").innerText({ timeout: 10_000 });
  expect(bodyText).not.toMatch(/this page could not be found|404|página não encontrada/i);
});

// ── AUTOMAÇÃO ─────────────────────────────────────────────────────────────────

test("@regression-guard playwright studio renderiza", async ({ page }) => {
  await assertPageLoads(page, "/automacoes/playwright", "Playwright Studio");
  // Garante que o placeholder de "editor não disponível" sumiu
  await expect(
    page.getByText("Instale @monaco-editor/react para habilitar"),
  ).not.toBeVisible();
});

test("@regression-guard api lab renderiza", async ({ page }) => {
  await assertPageLoads(page, "/automacoes/api-lab", "API Lab");
});

test("@regression-guard ferramentas automação renderiza", async ({ page }) => {
  await assertPageLoads(page, "/automacoes/tools", "Automation Tools");
});

test("@regression-guard base64 studio renderiza", async ({ page }) => {
  await assertPageLoads(page, "/automacoes/base64", "Base64 Studio");
});

test("@regression-guard ui studio renderiza", async ({ page }) => {
  await assertPageLoads(page, "/automacoes/ui-studio", "UI Studio");
});

test("@regression-guard execuções automação renderiza", async ({ page }) => {
  await assertPageLoads(page, "/automacoes/execucoes", "Execuções Automação");
});

test("@regression-guard arquivos automação renderiza", async ({ page }) => {
  await assertPageLoads(page, "/automacoes/arquivos", "Arquivos Automação");
});

// ── BRAIN / BRIAN ─────────────────────────────────────────────────────────────

test("@regression-guard brain/brian renderiza", async ({ page }) => {
  await assertPageLoads(page, "/brain", "Brain");
});

test("@regression-guard brain perguntar renderiza", async ({ page }) => {
  await assertPageLoads(page, "/brain/perguntar", "Brain - Perguntar");
});

// ── DOCUMENTOS ────────────────────────────────────────────────────────────────

test("@regression-guard documentos renderiza", async ({ page }) => {
  await assertPageLoads(page, "/documentos", "Documentos");
});

test("@regression-guard repositório documentos renderiza", async ({ page }) => {
  await assertPageLoads(page, "/documentos/repositorio", "Repositório Documentos");
});

// ── SUPORTE / CHAMADOS ────────────────────────────────────────────────────────

test("@regression-guard kanban-it renderiza", async ({ page }) => {
  await assertPageLoads(page, "/kanban-it", "Kanban IT");
});

test("@regression-guard suporte redireciona sem loop", async ({ page }) => {
  const response = await page.goto("/suporte", { waitUntil: "domcontentloaded" });
  // Não pode ficar em /suporte — deve redirecionar
  expect(page.url()).not.toMatch(/\/suporte\/?$/);
  // Resposta HTTP deve ser 200 (não 404)
  expect(response?.status()).not.toBe(404);
});

// ── SOLICITAÇÕES ──────────────────────────────────────────────────────────────

test("@regression-guard solicitações renderiza", async ({ page }) => {
  await assertPageLoads(page, "/solicitacoes", "Solicitações");
});

// ── CHAT ─────────────────────────────────────────────────────────────────────

test("@regression-guard chat renderiza", async ({ page }) => {
  await assertPageLoads(page, "/chat", "Chat");
});

// ── EMPRESA ─────────────────────────────────────────────────────────────────

test("@regression-guard planos de teste por empresa renderiza", async ({ page }) => {
  // Usar slug 'demo' como exemplo; se não existir, tela deve renderizar de forma controlada
  await page.goto("/empresas/griaule/planos-de-teste", { waitUntil: "domcontentloaded" });
  const body = await page.locator("body").innerText({ timeout: 8_000 });
  // Não pode ser erro 500 ou crash
  expect(body).not.toMatch(/application error|internal server error|unhandled error/i);
});

test("@regression-guard runs por empresa renderiza", async ({ page }) => {
  await page.goto("/empresas/griaule/runs", { waitUntil: "domcontentloaded" });
  const body = await page.locator("body").innerText({ timeout: 8_000 });
  expect(body).not.toMatch(/application error|internal server error|unhandled error/i);
});
