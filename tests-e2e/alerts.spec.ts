import { test, expect } from "@playwright/test";
import { mockAuth } from "./helpers/mockAuth";
import { seedQualityAlert } from "./utils/seed";

test("alerta Ã© exibido para admin", async ({ page, context }) => {
  // Primeiro faz mockAuth para garantir contexto/cookies
  await mockAuth(context, {
    role: "admin",
    companies: ["DEMO"],
    clientSlug: "DEMO",
  });
  // Limpa e faz seed
  await seedQualityAlert({ companySlug: "DEMO", type: "sla", severity: "critical", message: "Defeitos fora do SLA: 1" });
  // Navega e forÃ§a reload para garantir leitura do seed
  await page.goto("/admin/alerts", { waitUntil: "networkidle" });
  await page.reload({ waitUntil: "networkidle" });
  // Aguarda explicitamente o elemento para evitar falso negativo
  await page.waitForSelector('[data-testid="quality-alert"]', { timeout: 10000 });
  const alert = page.getByTestId("quality-alert");
  await expect(alert.first()).toBeVisible();
});

