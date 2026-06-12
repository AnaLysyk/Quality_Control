import { test, expect } from "@playwright/test";
import { simularAutenticacao } from "../../../support/functions/interface/apoio/simular-autenticacao";

test("admin consegue exportar release", async ({ page, context }) => {
  await simularAutenticacao(context, {
    role: "admin",
    companies: ["DEMO"],
    clientSlug: "DEMO",
  });

  await page.goto("/empresas/demo/releases/v1_8_0_reg", { waitUntil: "networkidle" });

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByTestId("release-export-pdf").click(),
  ]);

  const filename = download.suggestedFilename();
  expect(filename).toMatch(/release-.*\.(pdf|csv)$/);
});
