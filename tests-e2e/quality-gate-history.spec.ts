import { test, expect } from "@playwright/test";
import { mockAuth } from "./helpers/mockAuth";

test("historico de quality gate e registrado", async ({ page, context }) => {
  await mockAuth(context, {
    role: "admin",
    companies: ["DEMO"],
    clientSlug: "DEMO",
  });

  await page.goto("/empresas/demo/releases/v1_8_0_reg", {
    waitUntil: "domcontentloaded",
  });

  await page.getByTestId("quality-gate-history").click();

  await expect(page.getByTestId("release-timeline").or(page.getByTestId("quality-gate-history-list"))).toBeVisible();
});
