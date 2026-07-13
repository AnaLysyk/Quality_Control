import { expect, test, type Page } from "@playwright/test";

import { loginDiretoComTentativas } from "../../../support/functions/ui/apoio/autenticar-usuario-teste";

const RELATIONAL_USER_EMAIL = "e2e-relational-user@testingcompany.local";
const COMPANY_A = {
  slug: "testing-company",
  name: "Testing Company E2E",
  projectSlug: "quality-control",
  projectName: "Quality Control",
};
const COMPANY_B = {
  slug: "empresa-e2e",
  name: "Empresa Cliente E2E",
  projectSlug: "portal-empresa-e2e",
  projectName: "Portal empresa-e2e",
};

async function loginRelationalUser(page: Page) {
  const password = process.env.E2E_PROFILE_PASSWORD;
  if (!password) throw new Error("E2E_PROFILE_PASSWORD não foi definido pelo Playwright.");

  const login = await loginDiretoComTentativas(page, RELATIONAL_USER_EMAIL, [password]);
  expect(login.ok).toBe(true);

  await page.goto("/home", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("sidebar-operational-shell")).toBeVisible();
  await expect(page.getByTestId("sidebar-company-combobox")).toContainText(COMPANY_A.name);
}

async function openProjectOptions(page: Page) {
  const selector = page.getByTestId("sidebar-project-selector");
  await expect(selector).toBeEnabled();
  await selector.click();
}

async function switchCompany(page: Page, companySlug: string) {
  await page.getByTestId("sidebar-company-combobox").click();
  await page.getByTestId(`sidebar-company-option-${companySlug}`).click();
}

test.describe("contexto relacional empresa + projeto", () => {
  test("exibe somente os projetos pertencentes à empresa ativa", async ({ page }) => {
    await loginRelationalUser(page);

    await expect(page.getByTestId("sidebar-project-selector")).toContainText(COMPANY_A.projectName);
    await openProjectOptions(page);
    await expect(page.getByTestId(`sidebar-project-option-${COMPANY_A.projectSlug}`)).toBeVisible();
    await expect(page.getByTestId(`sidebar-project-option-${COMPANY_B.projectSlug}`)).toHaveCount(0);
    await page.getByTestId(`sidebar-project-option-${COMPANY_A.projectSlug}`).click();

    await switchCompany(page, COMPANY_B.slug);
    await expect(page.getByTestId("sidebar-company-combobox")).toContainText(COMPANY_B.name);
    await expect(page.getByTestId("sidebar-project-selector")).toContainText(COMPANY_B.projectName);

    await openProjectOptions(page);
    await expect(page.getByTestId(`sidebar-project-option-${COMPANY_B.projectSlug}`)).toBeVisible();
    await expect(page.getByTestId(`sidebar-project-option-${COMPANY_A.projectSlug}`)).toHaveCount(0);
  });

  test("ignora resposta atrasada da empresa anterior após a troca de contexto", async ({ page }) => {
    let releaseCompanyA: (() => void) | null = null;
    const companyAReleased = new Promise<void>((resolve) => {
      releaseCompanyA = resolve;
    });

    await page.route("**/api/projects?**", async (route) => {
      const url = new URL(route.request().url());
      const companySlug = url.searchParams.get("companySlug");
      const response = await route.fetch();

      if (companySlug === COMPANY_A.slug) {
        await companyAReleased;
      }

      await route.fulfill({ response });
    });

    await loginRelationalUser(page);

    await switchCompany(page, COMPANY_B.slug);
    await expect(page.getByTestId("sidebar-company-combobox")).toContainText(COMPANY_B.name);
    await expect(page.getByTestId("sidebar-project-selector")).toContainText(COMPANY_B.projectName);

    releaseCompanyA?.();

    await page.waitForTimeout(300);
    await expect(page.getByTestId("sidebar-company-combobox")).toContainText(COMPANY_B.name);
    await expect(page.getByTestId("sidebar-project-selector")).toContainText(COMPANY_B.projectName);
    await expect(page.getByTestId("sidebar-project-selector")).not.toContainText(COMPANY_A.projectName);
  });
});
