import { test, expect } from "@playwright/test";
import { simularAutenticacao } from "../../../support/functions/ui/apoio/simular-autenticacao";

test("timeline de quality gate aparece na release", async ({ page, context }) => {
  await simularAutenticacao(context, {
    role: "admin",
    companies: ["DEMO"],
    clientSlug: "DEMO",
  });

  await page.goto("/empresas/demo/releases/v1_8_0_reg", { waitUntil: "networkidle" });

  await page.getByTestId("quality-gate-history").click();

  await expect(page.getByTestId("release-timeline")).toBeVisible();
  const items = page.getByTestId("timeline-event");
  await expect(items.first()).toBeVisible();
  const count = await items.count();
  expect(count).toBeGreaterThan(1);
});
