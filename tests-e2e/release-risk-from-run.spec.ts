import { test, expect } from "@playwright/test";
import { mockAuth } from "./helpers/mockAuth";

const DASHBOARD = "/empresas/griaule/dashboard";

test("run falha coloca release em risco", async ({ page, context }) => {
  await mockAuth(context, {
    role: "company",
    companies: ["griaule"],
    clientSlug: "griaule",
  });

  await page.goto(DASHBOARD, { waitUntil: "networkidle" });

  // cria run manual com falha
  await page.getByTestId("create-run").click();
  await page.waitForTimeout(300);
  await page.getByTestId("run-name").fill("run-falha");
  await page.getByTestId("run-status-fail").click();
  await page.waitForTimeout(300);
  await page.getByTestId("run-save").click();
  await page.waitForTimeout(1000);
  // valida impacto na release
  const release = page.getByTestId("release-card").first();
  await expect(release.getByTestId("release-status")).toHaveText(/risk|risco/i, { timeout: 10000 });
  await expect(release.getByTestId("release-risk")).toBeVisible({ timeout: 10000 });
});
