import { test, expect } from "@playwright/test";
import { mockAuth } from "./helpers/mockAuth";

test("alerta é exibido para admin", async ({ page, context }) => {
  await mockAuth(context, {
    role: "admin",
    companies: ["griaule"],
    clientSlug: "griaule",
  });

  // Força cálculo de dashboard (pode gerar alertas novos)
  await page.goto("/empresas/griaule/dashboard", { waitUntil: "networkidle" });

  await page.goto("/admin/alerts", { waitUntil: "networkidle" });

  const alert = page.getByTestId("quality-alert");
  await expect(alert.first()).toBeVisible();
});
