import { test, expect, type Page } from "@playwright/test";
import { simularAutenticacao } from "../../../support/functions/ui/apoio/simular-autenticacao";

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_{2,}/g, "_");
}

function parseRunsCount(text: string | null) {
  if (!text) return 0;
  const match = text.match(/\d+/);
  return match ? Number(match[0]) : 0;
}

async function waitForAuth(page: Page) {
  const authLoading = page.getByText(/Validando sessao/i);
  if (await authLoading.isVisible().catch(() => false)) {
    await authLoading.waitFor({ state: "hidden", timeout: 20000 }).catch(() => {});
  }
}

async function createRun(
  page: Page,
  companySlug: string,
  name: string,
  stats: { pass: number; fail: number; blocked: number; notRun: number }
) {
  const res = await page.request.post("/api/releases-manual", {
    data: {
      kind: "run",
      name,
      app: "SMART",
      clientSlug: companySlug,
      stats,
    },
  });
  expect(res.status()).toBe(201);
  const payload = (await res.json().catch(() => null)) as { slug?: string } | null;
  return payload?.slug ?? slugify(name);
}

test("admin compara metricas entre empresas", async ({ page, context }) => {
  await simularAutenticacao(context, {
    role: "admin",
    companies: ["griaule", "testing-company"],
  });

  const griauleRun = "Run G Benchmark";
  const testingRun = "Run T Benchmark";


    await createRun(page, "griaule", griauleRun, {
    pass: 10,
    fail: 0,
    blocked: 0,
    notRun: 0,
  });
  await createRun(page, "testing-company", testingRun, {
    pass: 12,
    fail: 0,
    blocked: 0,
    notRun: 0,
  });

  await page.goto("/admin/dashboard", { waitUntil: "domcontentloaded" });
  await waitForAuth(page);

  const ranking = page.getByText(/Ranking de qualidade por empresa/i);
  await expect(ranking).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(/Atualizando\.\.\./).first()).toBeHidden({ timeout: 30000 });
  await expect(page.getByText(/Carregando ranking/i)).toHaveCount(0, { timeout: 30000 });

  await expect(page.getByText(/Seleção rápida de empresa/i)).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(/Compare empresas/i).first()).toBeVisible({ timeout: 15000 });

  const totalCompanies = parseRunsCount(await page.getByText(/empresas no escopo global/i).first().textContent());
  const totalRuns = parseRunsCount(await page.getByText(/Execuções consolidadas/i).locator("..").textContent());

  expect(totalCompanies).toBeGreaterThanOrEqual(1);
  expect(totalRuns).toBeGreaterThanOrEqual(1);
});
