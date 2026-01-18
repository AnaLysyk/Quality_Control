import { test, expect } from "@playwright/test";
import { mockAuth } from "./helpers/mockAuth";

test("dashboard exibe alertas críticos recentes", async ({ page, context }) => {
  await mockAuth(context, {
    role: "company",
    companies: ["griaule"],
    clientSlug: "griaule",
  });

  await page.goto("/empresas/griaule/dashboard", {
    waitUntil: "networkidle",
  });

  // Espera pelo bloco de alertas
  await expect(page.getByTestId("alerts")).toBeVisible();

  // Deve mostrar pelo menos um alerta crítico se houver condição de negócio
  const alerts = await page.getByTestId("alerts").locator("li");
  if (await alerts.count() > 0) {
    await expect(alerts.first()).toContainText(["Quality Score", "SLA", "MTTR", "Release"]);
  } else {
    await expect(page.getByTestId("alerts")).toContainText("Nenhum alerta crítico recente");
  }
});
