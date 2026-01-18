import fs from "fs";
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

test("exporta relatorio PDF da run", async ({ page, context }) => {
  await mockAuth(context, {
    role: "company",
    companies: ["griaule"],
    clientSlug: "griaule",
  });

  const runTitle = "Run PDF Export";
  const runSlug = slugify(runTitle);

  await page.goto("/empresas/griaule/runs", { waitUntil: "networkidle" });

  await page.getByTestId("run-create").click();
  await page.getByTestId("run-title").fill(runTitle);
  await page.getByTestId("run-stat-pass").fill("80");
  await page.getByTestId("run-stat-fail").fill("10");
  await page.getByTestId("run-stat-blocked").fill("10");
  await page.getByTestId("run-stat-not-run").fill("0");
  await page.getByTestId("run-submit").click();

  await page.waitForURL(new RegExp(`/empresas/griaule/runs/${runSlug}`));

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByTestId("export-pdf").click(),
  ]);

  const filePath = await download.path();
  expect(filePath).toBeTruthy();
  expect(await download.suggestedFilename()).toBe(`${runSlug}.pdf`);

  const stat = fs.statSync(filePath as string);
  expect(stat.size).toBeGreaterThan(1000);
});
