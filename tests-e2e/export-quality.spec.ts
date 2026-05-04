import { readFile } from "node:fs/promises";
import { test, expect } from "@playwright/test";
import { mockAuth } from "./utils/mockAuth";
import { expectCurrentDashboardReady } from "./utils/current-ui";

test("company consegue exportar CSV de qualidade", async ({ page, context }) => {
  await mockAuth(context, {
    role: "company",
    companies: ["DEMO"],
    clientSlug: "DEMO",
  });

  await page.goto("/empresas/demo/dashboard", {
    waitUntil: "domcontentloaded",
  });
  await expectCurrentDashboardReady(page);

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: /Exportar CSV/i }).click(),
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
