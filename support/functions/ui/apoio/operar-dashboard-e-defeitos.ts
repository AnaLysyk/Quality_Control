import { expect, type Page } from "@playwright/test";

export async function validarDashboardAtualPronto(page: Page) {
  await expect(page.getByRole("heading", { name: /Recorte anal.tico/i })).toBeVisible({ timeout: 30000 });
  await expect(page.getByText(/Recorte atual:/i).first()).toBeVisible({ timeout: 30000 });
}

export async function abrirCriacaoDefeito(page: Page) {
  await expect(page.getByTestId("defects-page")).toBeVisible({ timeout: 30000 });
  await page.getByTestId("defect-open-create").first().click();
  await expect(page.getByTestId("defect-create-modal")).toBeVisible({ timeout: 10000 });
}

export async function criarDefeitoManual(page: Page, title: string, options: { runSlug?: string } = {}) {
  await abrirCriacaoDefeito(page);
  await page.getByTestId("defect-title").fill(title);
  if (options.runSlug) {
    await page.getByRole("button", { name: /Selecionar run vinculada/i }).click();
    await page.getByLabel(/Buscar run/i).fill(options.runSlug);
    const runOption = page.getByRole("option", { name: new RegExp(options.runSlug, "i") }).first();
    if (await runOption.isVisible().catch(() => false)) {
      await runOption.click();
    } else {
      // Click on defect title to fire mousedown outside RunSelectorField, closing the dropdown
      await page.getByTestId("defect-title").click();
      await page.waitForTimeout(100);
    }
  }
  // Ensure dropdown is closed by clicking the title field before submitting
  await page.getByTestId("defect-title").click();
  await page.waitForTimeout(150);
  await page.getByTestId("defect-create").click();
  await expect(page.getByText(title).first()).toBeVisible({ timeout: 20000 });
}
