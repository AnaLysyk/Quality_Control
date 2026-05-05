import { test, expect } from "@playwright/test";
import { mockAuth } from "../helpers/mockAuth";
import { createManualDefect } from "../utils/current-ui";

test.describe("defeitos - criacao manual", () => {
  test("user cria defeito na empresa ativa", async ({ page, context }) => {
    await mockAuth(context, {
      role: "user",
      companies: ["DEMO"],
      clientSlug: "DEMO",
    });

    await page.goto("/empresas/demo/defeitos", { waitUntil: "domcontentloaded" });

    await createManualDefect(page, "Erro no login");
    await expect(page.getByText("Erro no login")).toBeVisible();
  });
});
