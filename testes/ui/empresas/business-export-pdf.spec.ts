import { test, expect } from "@playwright/test";
import {
  autenticarPerfilRuns,
} from "../../../support/functions/ui/runs/rotas-runs";
import { criarRunManualPorApi } from "../../../support/functions/api/runs/criar-run-manual";
import { exportarPdfRunManualPorApi } from "../../../support/functions/api/runs/exportar-run-manual";

test("exporta relatorio PDF da run", async ({ page, context }) => {
  await autenticarPerfilRuns(context, "empresa");

  const runTitle = "Run PDF Export";

  const { slug: runSlug } = await criarRunManualPorApi(page.request, {
    titulo: runTitle,
    pass: 80,
    fail: 10,
    blocked: 10,
    notRun: 0,
  });

  const response = await exportarPdfRunManualPorApi(page.request, runSlug);

  expect(response.ok()).toBeTruthy();
  expect(response.headers()["content-disposition"]).toContain(`run-${runSlug}.pdf`);
  expect(response.headers()["content-type"]).toContain("application/pdf");
  expect((await response.body()).length).toBeGreaterThan(1000);
});

