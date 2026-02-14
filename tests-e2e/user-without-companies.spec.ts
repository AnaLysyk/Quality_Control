import { test, expect } from "@playwright/test";
import { mockAuth } from "./helpers/mockAuth";
 
test.beforeEach(async ({ page }) => {
  await page.addStyleTag({ content: `
    .sidebar-shell, .sidebar-link, .sidebar-label {
      display: none !important;
      pointer-events: none !important;
      opacity: 0 !important;
      z-index: -1 !important;
      visibility: hidden !important;
    }
  ` });
});

test("user sem empresas vê seleção de empresas", async ({ page, context }) => {
  await mockAuth(context, {
    role: "user",
    companies: [],
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });

  await expect(page.getByText(/Selecione a empresa ativa/i)).toBeVisible({ timeout: 10000 });
  await expect(page.getByText(/Nenhuma empresa vinculada/i)).toBeVisible();
});
