import { test, expect } from "@playwright/test";
import { mockAuth } from "../helpers/mockAuth";

test.describe("defeitos - criação manual", () => {
  test("user cria defeito na empresa ativa", async ({ page, context }) => {
    await mockAuth(context, {
      role: "user",
      companies: ["griaule"],
      clientSlug: "griaule",
    });

    await page.goto("/empresas/griaule/defeitos", { waitUntil: "networkidle" });

    await page.getByTestId("defect-title").fill("Erro no login");
    await page.getByTestId("defect-create").click();

    // Espera a inclusão refletir na lista (item com o título).
    await expect(page.getByText("Erro no login")).toBeVisible();
  });
});
