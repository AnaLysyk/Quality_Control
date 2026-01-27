import { test, expect } from "@playwright/test";
import { mockAuth } from "./helpers/mockAuth";

test("admin troca empresa ativa", async ({ page, context }) => {
  await mockAuth(context, {
    role: "admin",
    companies: ["griaule", "testing-company"],
    clientSlug: "griaule",
  });

  await page.goto("/admin", { waitUntil: "networkidle" });

  await page.getByTestId("company-item-testing-company").click();
  await page.waitForTimeout(500);
  await page.waitForURL(/\/empresas\/testing-company\/home/, { timeout: 10000 });
});
