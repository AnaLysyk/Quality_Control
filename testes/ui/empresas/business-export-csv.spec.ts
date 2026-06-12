import fs from "fs";
import { test, expect } from "@playwright/test";
import { simularAutenticacao } from "../../../support/functions/interface/apoio/simular-autenticacao";

test("exporta relatorio CSV com dados do kanban", async ({ page, context }) => {
  await simularAutenticacao(context, {
    role: "company",
    companies: ["DEMO"],
    clientSlug: "DEMO",
  });

  await page.goto("/empresas/demo/defeitos/kanban", { waitUntil: "networkidle" });

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByTestId("export-csv").click(),
  ]);

  const filePath = await download.path();
  expect(filePath).toBeTruthy();
  expect(await download.suggestedFilename()).toMatch(/kanban-1\.csv$/);

  const csv = fs.readFileSync(filePath as string, "utf8");
  expect(csv.length).toBeGreaterThan(10);
  expect(csv).toContain("Erro no login");
});
