import { test, expect } from "@playwright/test";
import { mockAuth } from "./utils/mockAuth";

test("admin ve ranking de empresas", async ({ page, context }) => {
  await mockAuth(context, {
    role: "admin",
    companies: ["griaule", "testing-company"],
  });

  await page.goto("/admin/dashboard", { waitUntil: "domcontentloaded" });

  await expect(page.getByText(/Ranking de qualidade por empresa/i)).toBeVisible({ timeout: 20000 });
  await expect(page.getByText(/Comparativo operacional do ambiente/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /Abrir contexto/i }).first()).toBeVisible();
});
