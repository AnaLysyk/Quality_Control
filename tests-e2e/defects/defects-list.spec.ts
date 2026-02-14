
import { test, expect } from "@playwright/test";
import { mockAuth } from "../helpers/mockAuth";

test.describe("Defeitos - Listagem por Empresa Ativa", () => {
  test("Usuário vê página e lista de defeitos na empresa ativa", async ({ page, context }) => {
    await mockAuth(context, {
      role: "user",
      companies: ["griaule"],
      clientSlug: "griaule",
    });

    await page.goto("/empresas/griaule/defeitos", { waitUntil: "networkidle" });

    // Deve exibir página e lista de defeitos
    await expect(page.getByTestId("defects-page")).toBeVisible();
    await expect(page.getByTestId("defects-list")).toBeVisible();
  });
});
