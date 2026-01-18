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
  const csv = await download.text();
  expect(csv).toContain("company,period,quality_score");
  expect(csv).toContain("id,title,origin,status,opened_at");
});
