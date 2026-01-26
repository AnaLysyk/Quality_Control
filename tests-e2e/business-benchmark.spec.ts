import { test, expect } from "@playwright/test";
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

test("admin compara metricas entre empresas", async ({ page, context }) => {
  await mockAuth(context, {
    role: "admin",
    companies: ["griaule", "testing-company"],
  });

  const griauleRun = "Run G Benchmark";
  const testingRun = "Run T Benchmark";


  // Criação da run para Griaule
  await page.goto("/empresas/griaule/runs", { waitUntil: "networkidle" });
  await page.getByTestId("run-create").click();
  await page.getByTestId("run-title").fill(griauleRun);
  await page.getByTestId("run-stat-pass").fill("10");
  await page.getByTestId("run-stat-fail").fill("0");
  await page.getByTestId("run-stat-blocked").fill("0");
  await page.getByTestId("run-stat-not-run").fill("0");
  await page.getByTestId("run-submit").click();
  await page.waitForURL(new RegExp(`/empresas/griaule/runs/${slugify(griauleRun)}`));

  // Garante que a navegação terminou antes de prosseguir
  await page.waitForLoadState("networkidle");

  // Criação da run para Testing Company
  await page.goto("/empresas/testing-company/runs", { waitUntil: "networkidle" });
  await page.getByTestId("run-create").click();
  await page.getByTestId("run-title").fill(testingRun);
  await page.getByTestId("run-stat-pass").fill("12");
  await page.getByTestId("run-stat-fail").fill("0");
  await page.getByTestId("run-stat-blocked").fill("0");
  await page.getByTestId("run-stat-not-run").fill("0");
  await page.getByTestId("run-submit").click();
  await page.waitForURL(new RegExp(`/empresas/testing-company/runs/${slugify(testingRun)}`));

  // Garante que a navegação terminou antes de prosseguir
  await page.waitForLoadState("networkidle");

  await page.goto("/admin/home", { waitUntil: "networkidle" });

  const griauleRow = page.getByTestId("benchmark-row-griaule");
  const testingRow = page.getByTestId("benchmark-row-testing-company");

  await expect(griauleRow).toBeVisible();
  await expect(testingRow).toBeVisible();

  const griauleRuns = parseRunsCount(await griauleRow.getByTestId("benchmark-runs-total").textContent());
  const testingRuns = parseRunsCount(await testingRow.getByTestId("benchmark-runs-total").textContent());

  expect(griauleRuns).toBeGreaterThanOrEqual(1);
  expect(testingRuns).toBeGreaterThanOrEqual(1);
});
