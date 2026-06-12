import { test, expect } from "../../../support/fixtures/test";

test.describe("playwright test agents seed", () => {
  test("seed @agent-seed", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\//);
  });
});
