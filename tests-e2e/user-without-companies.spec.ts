import { test, expect } from "@playwright/test";
import { mockAuth } from "./helpers/mockAuth";

test("user sem empresas nao acessa contexto indevido", async ({ page, context }) => {
  await mockAuth(context, {
    role: "user",
    companies: [],
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });

  await expect(page.getByText(/Acesso negado|Nenhuma empresa vinculada|Selecione a empresa ativa/i).first()).toBeVisible({ timeout: 10000 });
});
