import { test, expect } from "@playwright/test";
import { simularAutenticacao } from "../../../support/functions/ui/apoio/simular-autenticacao";
import { criarAlertaQualidade } from "../../../support/functions/banco-de-dados/geradores-dados/criar-dados-base";

test("alerta é exibido para admin", async ({ page, context }) => {
  // Primeiro faz simularAutenticacao para garantir contexto/cookies
  await simularAutenticacao(context, {
    role: "admin",
    companies: ["DEMO"],
    clientSlug: "DEMO",
  });
  // Limpa e faz seed
  await criarAlertaQualidade({ companySlug: "DEMO", type: "sla", severity: "critical", message: "Defeitos fora do SLA: 1" });
  // Navega e força reload para garantir leitura do seed
  await page.goto("/admin/alerts", { waitUntil: "networkidle" });
  await page.reload({ waitUntil: "networkidle" });
  // Aguarda explicitamente o elemento para evitar falso negativo
  await page.waitForSelector('[data-testid="quality-alert"]', { timeout: 10000 });
  const alert = page.getByTestId("quality-alert");
  await expect(alert.first()).toBeVisible();
});

