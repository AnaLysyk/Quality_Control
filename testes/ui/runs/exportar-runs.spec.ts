import { test, expect } from "@playwright/test";
import { criarRunManualPorApi } from "../../../support/functions/api/runs/criar-run-manual";
import { exportarPdfRunManualPorApi } from "../../../support/functions/api/runs/exportar-run-manual";
import { autenticarPerfilRuns } from "../../../support/functions/ui/runs/rotas-runs";

test("admin consegue exportar run", async ({ page, context }) => {
  await autenticarPerfilRuns(context, "admin");

  const { slug } = await criarRunManualPorApi(page.request, {
    titulo: "Run Export Admin",
    pass: 90,
    fail: 5,
    blocked: 0,
    notRun: 5,
  });

  const response = await exportarPdfRunManualPorApi(page.request, slug);

  expect(response.ok()).toBeTruthy();
  expect(response.headers()["content-disposition"]).toContain(`run-${slug}.pdf`);
  expect(response.headers()["content-type"]).toContain("application/pdf");
  expect((await response.body()).length).toBeGreaterThan(1000);
});
