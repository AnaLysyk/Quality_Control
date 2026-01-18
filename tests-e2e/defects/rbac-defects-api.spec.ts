import { test, expect } from "@playwright/test";
import { mockAuth } from "../helpers/mockAuth";

test.describe("rbac - api defeitos manuais", () => {
  test("company não consegue deletar defeito manual via API (403)", async ({ page, context }) => {
    await mockAuth(context, {
      role: "company",
      companies: ["griaule"],
      clientSlug: "griaule",
    });

    await page.goto("/empresas/griaule/defeitos", { waitUntil: "networkidle" });

    // cria um defeito manual para garantir slug previsível
    await page.getByTestId("defect-title").fill("Defeito proibido");
    await page.getByTestId("defect-create").click();

    const response = await page.request.delete("/api/releases-manual/defeito_proibido");
    expect(response.status()).toBe(403);
  });
});
