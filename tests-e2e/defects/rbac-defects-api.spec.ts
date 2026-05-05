import { test, expect } from "@playwright/test";
import { mockAuth } from "../helpers/mockAuth";
import { createManualDefect } from "../utils/current-ui";

test.describe("rbac - api defeitos manuais", () => {
  test("company nao consegue deletar defeito manual via API (403)", async ({ page, context }) => {
    await mockAuth(context, {
      role: "company",
      companies: ["DEMO"],
      clientSlug: "DEMO",
    });

    await page.goto("/empresas/demo/defeitos", { waitUntil: "domcontentloaded" });

    await createManualDefect(page, "Defeito proibido");

    const response = await page.request.delete("/api/releases-manual/defeito_proibido");
    expect(response.status()).toBe(403);
  });
});
