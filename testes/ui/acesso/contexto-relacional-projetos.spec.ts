import { expect, test, type BrowserContext, type Route } from "@playwright/test";

import { simularAutenticacao } from "../../../support/functions/ui/apoio/simular-autenticacao";

type ProjectFixture = {
  id: string;
  slug: string;
  name: string;
  companyId: string;
  status: string;
};

type ProjectResponse = {
  projects: ProjectFixture[];
  access: {
    mode: "all" | "selected" | "none";
    projectIds: string[];
  };
};

const COMPANY_A = { id: "empresa-a", slug: "empresa-a", name: "Empresa A" };
const COMPANY_B = { id: "empresa-b", slug: "empresa-b", name: "Empresa B" };

const PROJECT_A1: ProjectFixture = {
  id: "project-a1",
  slug: "projeto-a1",
  name: "Projeto A1",
  companyId: COMPANY_A.id,
  status: "active",
};

const PROJECT_B1: ProjectFixture = {
  id: "project-b1",
  slug: "projeto-b1",
  name: "Projeto B1",
  companyId: COMPANY_B.id,
  status: "active",
};

async function authenticateMultiCompany(context: BrowserContext) {
  await simularAutenticacao(context, {
    role: "testing_company_user",
    id: "e2e-relational-user",
    email: "e2e-relational-user@testingcompany.local",
    companies: [COMPANY_A.slug, COMPANY_B.slug],
    companySlug: COMPANY_A.slug,
    clientSlug: COMPANY_A.slug,
    permissions: {
      dashboard: ["view"],
      context: ["switch_company", "switch_project", "view_linked_companies", "view_linked_projects"],
    },
  });
}

function companySlugFromRoute(route: Route) {
  return new URL(route.request().url()).searchParams.get("companySlug");
}

async function fulfillProjects(route: Route, body: ProjectResponse, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

test.describe("contexto relacional empresa + projeto", () => {
  test.beforeEach(async ({ context }) => {
    await authenticateMultiCompany(context);
  });

  test("mostra somente os projetos vinculados à empresa ativa", async ({ page, context }) => {
    await context.route("**/api/projects?**", async (route) => {
      const companySlug = companySlugFromRoute(route);
      const response: ProjectResponse = companySlug === COMPANY_B.slug
        ? { projects: [PROJECT_B1], access: { mode: "selected", projectIds: [PROJECT_B1.id] } }
        : { projects: [PROJECT_A1], access: { mode: "selected", projectIds: [PROJECT_A1.id] } };
      await fulfillProjects(route, response);
    });

    await page.goto("/home", { waitUntil: "domcontentloaded" });

    await expect(page.getByTestId("sidebar-company-selector")).toContainText(COMPANY_A.name);
    await expect(page.getByTestId("sidebar-project-selector")).toContainText(PROJECT_A1.name);

    await page.getByTestId("sidebar-project-selector").click();
    await expect(page.getByTestId(`sidebar-project-option-${PROJECT_A1.slug}`)).toBeVisible();
    await expect(page.getByTestId(`sidebar-project-option-${PROJECT_B1.slug}`)).toHaveCount(0);

    await page.getByTestId("sidebar-company-selector").click();
    await page.getByTestId(`sidebar-company-option-${COMPANY_B.slug}`).click();

    await expect(page.getByTestId("sidebar-company-selector")).toContainText(COMPANY_B.name);
    await expect(page.getByTestId("sidebar-project-selector")).toContainText(PROJECT_B1.name);

    await page.getByTestId("sidebar-project-selector").click();
    await expect(page.getByTestId(`sidebar-project-option-${PROJECT_B1.slug}`)).toBeVisible();
    await expect(page.getByTestId(`sidebar-project-option-${PROJECT_A1.slug}`)).toHaveCount(0);
  });

  test("ignora resposta atrasada da empresa anterior após troca de contexto", async ({ page, context }) => {
    let releaseCompanyA: (() => void) | null = null;
    const companyARelease = new Promise<void>((resolve) => {
      releaseCompanyA = resolve;
    });

    await context.route("**/api/projects?**", async (route) => {
      const companySlug = companySlugFromRoute(route);
      if (companySlug === COMPANY_A.slug) {
        await companyARelease;
        await fulfillProjects(route, {
          projects: [PROJECT_A1],
          access: { mode: "selected", projectIds: [PROJECT_A1.id] },
        });
        return;
      }

      await fulfillProjects(route, {
        projects: [PROJECT_B1],
        access: { mode: "selected", projectIds: [PROJECT_B1.id] },
      });
    });

    await page.goto("/home", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("sidebar-company-selector")).toContainText(COMPANY_A.name);

    await page.getByTestId("sidebar-company-selector").click();
    await page.getByTestId(`sidebar-company-option-${COMPANY_B.slug}`).click();

    await expect(page.getByTestId("sidebar-project-selector")).toContainText(PROJECT_B1.name);
    releaseCompanyA?.();

    await page.waitForTimeout(100);
    await expect(page.getByTestId("sidebar-project-selector")).toContainText(PROJECT_B1.name);
    await expect(page.getByTestId("sidebar-project-selector")).not.toContainText(PROJECT_A1.name);
  });

  test("company_only não libera projetos e 403 limpa o seletor", async ({ page, context }) => {
    await context.route("**/api/projects?**", async (route) => {
      const companySlug = companySlugFromRoute(route);
      if (companySlug === COMPANY_A.slug) {
        await fulfillProjects(route, {
          projects: [],
          access: { mode: "none", projectIds: [] },
        });
        return;
      }

      await route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({ error: "Sem permissão para acessar projetos" }),
      });
    });

    await page.goto("/home", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("sidebar-project-selector")).toContainText("Sem projetos");
    await expect(page.getByTestId("sidebar-project-selector")).toBeDisabled();

    await page.getByTestId("sidebar-company-selector").click();
    await page.getByTestId(`sidebar-company-option-${COMPANY_B.slug}`).click();

    await expect(page.getByTestId("sidebar-project-selector")).toContainText("Sem acesso aos projetos");
    await expect(page.getByTestId("sidebar-project-selector")).toBeDisabled();
  });
});
