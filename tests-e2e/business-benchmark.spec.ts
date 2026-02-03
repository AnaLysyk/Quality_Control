import { test, expect, type Page } from "@playwright/test";
import { mockAuth } from "./helpers/mockAuth";

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
  await mockAuth(context, {
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

  await page.goto("/admin/home", { waitUntil: "domcontentloaded" });
  await waitForAuth(page);

  const griauleRow = page.getByTestId("benchmark-row-griaule");
  const testingRow = page.getByTestId("benchmark-row-testing-company");

  await expect(griauleRow).toBeVisible({ timeout: 15000 });
  await expect(testingRow).toBeVisible({ timeout: 15000 });

  const griauleRuns = parseRunsCount(await griauleRow.getByTestId("benchmark-runs-total").textContent());
  const testingRuns = parseRunsCount(await testingRow.getByTestId("benchmark-runs-total").textContent());

  expect(griauleRuns).toBeGreaterThanOrEqual(1);
  expect(testingRuns).toBeGreaterThanOrEqual(1);
});
