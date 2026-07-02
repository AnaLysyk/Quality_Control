import fs from "fs";
import { test, expect } from "@playwright/test";
import {
  autenticarPerfilRuns,
  rotaKanbanDefeitosEmpresa,
} from "../../../support/functions/ui/runs/rotas-runs";
import { criarRunManualPorApi } from "../../../support/functions/api/runs/criar-run-manual";

test("exporta relatorio CSV com dados do kanban", async ({ page, context }) => {
  await autenticarPerfilRuns(context, "empresa");

  const { slug: runSlug } = await criarRunManualPorApi(page.request, {
    titulo: "Run Kanban CSV",
    pass: 80,
    fail: 10,
    blocked: 0,
    notRun: 10,
  });

  await page.goto(`${rotaKanbanDefeitosEmpresa()}?run=${encodeURIComponent(runSlug)}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("export-csv")).toBeVisible({ timeout: 30000 });

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByTestId("export-csv").click(),
  ]);

  const filePath = await download.path();
  expect(filePath).toBeTruthy();
  expect(await download.suggestedFilename()).toMatch(/kanban-\d+\.csv$/);

  const csv = fs.readFileSync(filePath as string, "utf8");
  expect(csv.length).toBeGreaterThan(10);
  expect(csv).toContain("Erro no login");
});

