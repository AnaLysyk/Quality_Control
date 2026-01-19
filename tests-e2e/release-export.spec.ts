import { test, expect } from "@playwright/test";
import { mockAuth } from "./helpers/mockAuth";

test("admin consegue exportar release", async ({ page, context }) => {
  await mockAuth(context, {
    role: "admin",
    companies: ["griaule"],
    clientSlug: "griaule",
  });

  await page.goto("/empresas/griaule/releases/v1_8_0_reg", { waitUntil: "networkidle" });

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByTestId("release-export-pdf").click(),
  ]);

  const filename = download.suggestedFilename();
  expect(filename).toMatch(/release-.*\.(pdf|csv)$/);
});
