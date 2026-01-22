import { readFile } from "node:fs/promises";
import { test, expect } from "@playwright/test";
import { mockAuth } from "./utils/mockAuth";

test("company consegue exportar CSV de qualidade", async ({ page, context }) => {
  await mockAuth(context, {
    role: "company",
    companies: ["griaule"],
    clientSlug: "griaule",
  });

  await page.goto("/empresas/griaule/dashboard", {
    waitUntil: "networkidle",
  });

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByTestId("export-quality").click(),
  ]);

  expect(download.suggestedFilename()).toContain("quality");
  const downloadPath = await download.path();
  if (!downloadPath) {
    throw new Error("Download path unavailable");
  }
  const csv = await readFile(downloadPath, "utf8");
  expect(csv).toContain("company,period,quality_score");
  expect(csv).toContain("id,title,origin,status,opened_at");
});
