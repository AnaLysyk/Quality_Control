import { test, expect } from "@playwright/test";
import { autenticarPerfilRuns, rotaDetalheRunEmpresa } from "../../../support/functions/ui/runs/rotas-runs";

test("timeline de quality gate aparece na run", async ({ page, context }) => {
  await autenticarPerfilRuns(context, "admin");

  await page.goto(rotaDetalheRunEmpresa("v1_8_0_reg"), { waitUntil: "networkidle" });

  await page.getByTestId("quality-gate-history").click();

  await expect(page.getByTestId("run-timeline")).toBeVisible();
  const items = page.getByTestId("timeline-event");
  await expect(items.first()).toBeVisible();
  const count = await items.count();
  expect(count).toBeGreaterThan(1);
});

