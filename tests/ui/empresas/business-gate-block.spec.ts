import { test, expect } from "@playwright/test";
import { autenticarPerfilRuns } from "../../../tools/functions/ui/runs/rotas-runs";
import { criarRunManualPorApi } from "../../../tools/functions/api/runs/criar-run-manual";
import { finalizarRunManualPorApi } from "../../../tools/functions/api/runs/finalizar-run-manual";

test("quality gate falho bloqueia aprovacao de run manual", async ({ page, context }) => {
  await autenticarPerfilRuns(context, "empresa");

  const runTitle = "Run Bloqueada";

  const { slug: runSlug } = await criarRunManualPorApi(page.request, {
    titulo: runTitle,
    pass: 0,
    fail: 60,
    blocked: 40,
    notRun: 0,
  });

  const response = await finalizarRunManualPorApi(page.request, runSlug);

  expect(response.status()).toBe(403);
});

