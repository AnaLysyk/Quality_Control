import { test, expect } from "@playwright/test";
import { mockAuth } from "../helpers/mockAuth";

test.describe("rbac - api defeitos manuais", () => {
  test("company nÃ£o consegue deletar defeito manual via API (403)", async ({ page, context }) => {
    await mockAuth(context, {
      role: "company",
      companies: ["DEMO"],
      clientSlug: "DEMO",
    });

    await page.goto("/empresas/demo/defeitos", { waitUntil: "networkidle" });

    // cria um defeito manual para garantir slug previsÃ­vel
    await page.getByTestId("defect-title").fill("Defeito proibido");
    await page.getByTestId("defect-create").click();

    const response = await page.request.delete("/api/releases-manual/defeito_proibido");
    expect(response.status()).toBe(403);
  });
});

