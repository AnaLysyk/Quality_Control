import { expect, type Page } from "@playwright/test";

export async function expectCurrentDashboardReady(page: Page) {
  await expect(page.getByRole("heading", { name: /Resumo executivo de qualidade/i })).toBeVisible({ timeout: 30000 });
  await expect(page.getByText(/Recorte atual:/i).first()).toBeVisible({ timeout: 30000 });
}

export async function openCreateDefect(page: Page) {
  await expect(page.getByTestId("defects-page")).toBeVisible({ timeout: 30000 });
  await page.getByTestId("defect-open-create").first().click();
  await expect(page.getByTestId("defect-create-modal")).toBeVisible({ timeout: 10000 });
}

export async function createManualDefect(page: Page, title: string, options: { runSlug?: string } = {}) {
  await openCreateDefect(page);
  await page.getByTestId("defect-title").fill(title);
  if (options.runSlug) {
    await page.getByRole("button", { name: /Selecionar run vinculada/i }).click();
    await page.getByLabel(/Buscar run/i).fill(options.runSlug);
    const runOption = page.getByRole("option", { name: new RegExp(options.runSlug, "i") }).first();
    if (await runOption.isVisible().catch(() => false)) {
      await runOption.click();
    }
  }
  await page.getByTestId("defect-create").click();
  await expect(page.getByText(title)).toBeVisible({ timeout: 20000 });
}
