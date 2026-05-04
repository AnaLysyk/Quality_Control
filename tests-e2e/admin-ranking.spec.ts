import { test, expect } from "@playwright/test";
import { mockAuth } from "./utils/mockAuth";

test("admin vê ranking de empresas", async ({ page, context }) => {
  await mockAuth(context, {
    role: "admin",
    companies: ["griaule", "testing-company"],
  });

  await page.goto("/admin/dashboard", { waitUntil: "networkidle" });

  const table = page.getByTestId("ranking-table");
  await expect(table).toBeVisible();
  // Checa se há pelo menos duas empresas no ranking
  const rows = await table.locator("tbody tr").all();
  expect(rows.length).toBeGreaterThanOrEqual(2);
  // Checa se cada linha tem nome, score e status
  for (const row of rows) {
    await expect(row.locator("td").nth(0)).not.toBeEmpty(); // nome
    await expect(row.locator("td").nth(1)).not.toBeEmpty(); // score
    await expect(row.locator("td").nth(2)).not.toBeEmpty(); // status
  }
});
