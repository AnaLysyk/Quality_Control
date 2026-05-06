import { test, expect } from "@playwright/test";
import { mockAuth } from "./utils/mockAuth";
import { expectCurrentDashboardReady } from "./utils/current-ui";

test("dashboard mostra qualidade por run", async ({ page, context }) => {
  await mockAuth(context, {
    role: "admin",
    companies: ["DEMO"],
    clientSlug: "DEMO",
  });

  await page.goto("/empresas/demo/dashboard", {
    waitUntil: "networkidle",
  });

  await expectCurrentDashboardReady(page);
  await page.getByRole("button", { name: /Comparativos/i }).click();
  await expect(page.getByText(/Runs com mais impacto|Sem comparativos para exibir/i)).toBeVisible({ timeout: 10000 });
});

