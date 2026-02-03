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

test("quality gate reprova run com falhas", async ({ page, context }) => {
  await mockAuth(context, {
    role: "admin",
    companies: ["griaule"],
    clientSlug: "griaule",
  });

  const runTitle = "Run Gate E2E";
  const runSlug = slugify(runTitle);

  await page.goto("/empresas/griaule/runs", { waitUntil: "networkidle" });

  await page.getByTestId("run-create").click();
  await page.getByTestId("run-title").fill(runTitle);
  await page.getByTestId("run-stat-pass").fill("0");
  await page.getByTestId("run-stat-fail").fill("60");
  await page.getByTestId("run-stat-blocked").fill("40");
  await page.getByTestId("run-stat-not-run").fill("0");
  await page.getByTestId("run-submit").click();

  await page.waitForURL(new RegExp(`/empresas/griaule/runs/${runSlug}`));

  const runGate = page.getByTestId("quality-gate-status");
  await expect(runGate).toHaveAttribute("data-status", "failed");

  await page.goto("/admin/test-metric", { waitUntil: "domcontentloaded" });
  const authLoading = page.getByText(/Validando sessao/i);
  if (await authLoading.isVisible().catch(() => false)) {
    await authLoading.waitFor({ state: "hidden", timeout: 20000 }).catch(() => {});
  }

  const companyGate = page.getByTestId("company-quality-status").first();
  await expect(companyGate).toHaveAttribute("data-status", "failed");
});
