import { expect, test } from "../../../../../support/fixtures/test";
import AxeBuilder from "@axe-core/playwright";

test("esqueci senha nao possui violacoes graves de acessibilidade", async ({ page }) => {
  await page.goto("/login/forgot-password", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("forgot-password-form")).toBeVisible({ timeout: 10000 });
  const result = await new AxeBuilder({ page })
    .exclude('[data-testid="toast"]')
    .analyze();
  const critical = result.violations.filter((violation) =>
    ["critical", "serious"].includes(violation.impact ?? ""),
  );
  expect(critical).toEqual([]);
});
