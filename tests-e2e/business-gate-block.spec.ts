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

test("quality gate falho bloqueia aprovacao de run manual", async ({ page, context }) => {
  await mockAuth(context, {
    role: "company",
    companies: ["griaule"],
    clientSlug: "griaule",
  });

  const runTitle = "Run Bloqueada";
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

  const approve = page.getByTestId("release-approve");
  await expect(approve).toHaveAttribute("aria-disabled", "true");
  await expect(page.getByTestId("quality-gate-blocked-message")).toBeVisible();

  const status = await page.evaluate(async (slug) => {
    const res = await fetch(`/api/releases-manual/${slug}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "FINALIZADA" }),
    });
    return res.status;
  }, runSlug);

  expect(status).toBe(403);
});
