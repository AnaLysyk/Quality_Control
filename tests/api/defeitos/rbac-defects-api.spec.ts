import { test, expect } from "@playwright/test";
import { simularAutenticacao } from "../../../tools/functions/ui/apoio/simular-autenticacao";
import { criarDefeitoManual } from "../../../tools/functions/ui/apoio/operar-dashboard-e-defeitos";

test.describe("rbac - api defeitos manuais", () => {
  test("company não consegue deletar defeito manual via API (403)", async ({ page, context }) => {
    await simularAutenticacao(context, {
      role: "company",
      companies: ["DEMO"],
      clientSlug: "DEMO",
    });

    await page.goto("/empresas/demo/defeitos", { waitUntil: "networkidle" });

    // cria um defeito manual para garantir slug previsível
    await page.getByTestId("defect-title").fill("Defeito proibido");
    await page.getByTestId("defect-create").click();

    const response = await page.request.delete("/api/releases-manual/defeito_proibido");
    expect(response.status()).toBe(403);
  });
});

