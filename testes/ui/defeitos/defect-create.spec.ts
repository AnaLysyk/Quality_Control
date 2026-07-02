import { test, expect } from "@playwright/test";
import { simularAutenticacao } from "../../../support/functions/ui/apoio/simular-autenticacao";
import { criarDefeitoManual } from "../../../support/functions/ui/apoio/operar-dashboard-e-defeitos";

test.describe("defeitos - criação manual", () => {
  test("user cria defeito na empresa ativa", async ({ page, context }) => {
    await simularAutenticacao(context, {
      role: "user",
      companies: ["DEMO"],
      clientSlug: "DEMO",
    });

    await page.goto("/empresas/demo/defeitos", { waitUntil: "networkidle" });

    await page.getByTestId("defect-title").fill("Erro no login");
    await page.getByTestId("defect-create").click();

    // Espera a inclusão refletir na lista (item com o título).
    await expect(page.getByText("Erro no login")).toBeVisible();
  });
});

