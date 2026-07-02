import type { Page } from "@playwright/test";

import { expect, test } from "../../../support/fixtures/test";
import { simularAutenticacao } from "../../../support/functions/ui/apoio/simular-autenticacao";

const COMPANY_SLUG = "testing-company";

const CANONICAL_CASES_URL_REGEX = /\/casos-de-teste(?:[/?#]|$)/;
const LEGACY_CASES_URL_REGEX = /\/automacoes\/casos(?:[/?#]|$)/;

async function authenticateAutomationAccess(context: Parameters<typeof simularAutenticacao>[0]) {
  await simularAutenticacao(context, {
    role: "leader_tc",
    permissionRole: "leader_tc",
    companyRole: "leader_tc",
    companySlug: COMPANY_SLUG,
    companySlugs: [COMPANY_SLUG],
    clientSlug: COMPANY_SLUG,
    clientSlugs: [COMPANY_SLUG],
    isGlobalAdmin: true,
  });
}

async function openAutomationAreaWithSidebar(page: Page) {
  await page.goto("/automacoes/ui-studio", { waitUntil: "domcontentloaded" });
  const sidebar = page.locator("nav").filter({ hasText: "QA IDE" }).first();
  await expect(sidebar).toBeVisible({ timeout: 20_000 });
  const sidebarCasosLink = sidebar.locator('a[href="/casos-de-teste"]').filter({ hasText: /^Casos$/ }).first();
  await expect(sidebarCasosLink).toBeVisible();
  return { sidebarCasosLink };
}

async function openUiStudioWithShortcuts(page: Page) {
  await page.goto("/automacoes/ui-studio", { waitUntil: "domcontentloaded" });
  const scriptShortcut = page.locator('a[href="/automacoes/ui-studio?view=scripts"]').first();
  await expect(scriptShortcut).toBeVisible({ timeout: 20_000 });
  const shortcutsGroup = scriptShortcut.locator("xpath=..");
  const shortcutCasosLink = shortcutsGroup.locator('a[href="/casos-de-teste"]').filter({ hasText: /^Casos$/ }).first();
  await expect(shortcutCasosLink).toBeVisible();
  return { shortcutCasosLink };
}

async function assertCanonicalCasesLink(link: ReturnType<Page["locator"]>) {
  await expect(link).toHaveAttribute("href", /\/casos-de-teste(?:[/?#]|$)/);
  await expect(link).not.toHaveAttribute("href", /\/automacoes\/casos(?:[/?#]|$)/);
}

test.describe("Navegação central de casos", () => {
  test("@case=TC-NAV-001 Sidebar Casos navega para rota canônica", async ({ context, page }) => {
    await authenticateAutomationAccess(context);
    const { sidebarCasosLink } = await openAutomationAreaWithSidebar(page);
    await assertCanonicalCasesLink(sidebarCasosLink);
  });

  test("@case=TC-NAV-002 Atalho Casos do UI Studio navega para rota canônica", async ({ context, page }) => {
    await authenticateAutomationAccess(context);
    const { shortcutCasosLink } = await openUiStudioWithShortcuts(page);
    await assertCanonicalCasesLink(shortcutCasosLink);
    await page.goto("/casos-de-teste", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(CANONICAL_CASES_URL_REGEX);
    await expect(page).not.toHaveURL(LEGACY_CASES_URL_REGEX);
  });
});

