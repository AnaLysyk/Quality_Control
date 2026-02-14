
import { test, expect } from "@playwright/test";
import { mockAuth } from "../helpers/mockAuth";

test.describe("Defeitos - Criação Manual", () => {
  test("Usuário cria defeito na empresa ativa e visualiza na lista", async ({ page, context }) => {
    // Mocka autenticação como usuário comum
    await mockAuth(context, {
      role: "user",
      companies: ["griaule"],
      clientSlug: "griaule",
    });

    await page.goto("/empresas/griaule/defeitos", { waitUntil: "networkidle" });

    // Preenche o título e cria o defeito
    await page.getByTestId("defect-title").fill("Erro no login");
    await page.getByTestId("defect-create").click();

    // Aguarda o item aparecer na lista
    await expect(page.getByText("Erro no login", { exact: true })).toBeVisible();
  });
});
