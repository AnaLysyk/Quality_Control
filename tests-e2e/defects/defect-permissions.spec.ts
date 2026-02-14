
import { test, expect } from "@playwright/test";
import { mockAuth } from "../helpers/mockAuth";

test.describe("Defeitos - Permissões", () => {
  test("Usuário comum não vê botão de edição de defeito manual", async ({ page, context }) => {
    await mockAuth(context, {
      role: "user",
      companies: ["griaule"],
      clientSlug: "griaule",
    });

    await page.goto("/empresas/griaule/defeitos", { waitUntil: "networkidle" });

    // Usuário não deve ver botão de edição
    await expect(page.getByTestId("defect-edit")).toBeHidden();
  });

  test("Admin acessa página e lista de defeitos", async ({ page, context }) => {
    await mockAuth(context, {
      role: "admin",
      companies: ["griaule", "testing-company"],
      clientSlug: "griaule",
    });

    await page.goto("/empresas/griaule/defeitos", { waitUntil: "networkidle" });

    // Admin deve ver página e lista de defeitos
    await expect(page.getByTestId("defects-page")).toBeVisible();
    await expect(page.getByTestId("defects-list")).toBeVisible();
  });
});
