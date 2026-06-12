import { expect, test, type BrowserContext, type Page } from "../../../support/fixtures/test";
import { simularAutenticacao } from "../../../support/functions/interface/apoio/simular-autenticacao";

type ProfileScenario = {
  key: string;
  label: string;
  role: "empresa" | "technical_support" | "leader_tc" | "testing_company_user" | "company_user";
  permissionRole: string;
  companyRole: string;
  companySlug: string;
  companySlugs: string[];
  isGlobal: boolean;
};

const COMPANY_MAIN = "testing-company";
const COMPANY_SECONDARY = "griaule";

const profiles: ProfileScenario[] = [
  {
    key: "empresa",
    label: "Empresa",
    role: "empresa",
    permissionRole: "empresa",
    companyRole: "empresa",
    companySlug: COMPANY_MAIN,
    companySlugs: [COMPANY_MAIN],
    isGlobal: false,
  },
  {
    key: "suporte-tecnico",
    label: "Suporte Técnico",
    role: "technical_support",
    permissionRole: "technical_support",
    companyRole: "technical_support",
    companySlug: COMPANY_MAIN,
    companySlugs: [COMPANY_MAIN, COMPANY_SECONDARY],
    isGlobal: true,
  },
  {
    key: "lider-tc",
    label: "Líder TC",
    role: "leader_tc",
    permissionRole: "leader_tc",
    companyRole: "leader_tc",
    companySlug: COMPANY_MAIN,
    companySlugs: [COMPANY_MAIN, COMPANY_SECONDARY],
    isGlobal: true,
  },
  {
    key: "usuario-tc",
    label: "Usuário TC",
    role: "testing_company_user",
    permissionRole: "testing_company_user",
    companyRole: "testing_company_user",
    companySlug: COMPANY_MAIN,
    companySlugs: [COMPANY_MAIN],
    isGlobal: false,
  },
  {
    key: "usuario-empresa",
    label: "Usuário da Empresa",
    role: "company_user",
    permissionRole: "company_user",
    companyRole: "company_user",
    companySlug: COMPANY_MAIN,
    companySlugs: [COMPANY_MAIN],
    isGlobal: false,
  },
];

function makeSuffix(profile: ProfileScenario) {
  return `${profile.key}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

async function loginAsProfile(context: BrowserContext, page: Page, profile: ProfileScenario) {
  await simularAutenticacao(context, {
    role: profile.role,
    permissionRole: profile.permissionRole,
    companyRole: profile.companyRole,
    companySlug: profile.companySlug,
    companySlugs: profile.companySlugs,
    clientSlug: profile.companySlug,
    clientSlugs: profile.companySlugs,
    isGlobalAdmin: profile.role === "leader_tc",
    name: `E2E ${profile.label}`,
    email: `e2e-${profile.key}@testingcompany.local`,
  });

  await page.goto("/casos-de-teste");
}

async function assertRepositoryContext(page: Page, profile: ProfileScenario) {
  await expect(page).toHaveURL(/\/casos-de-teste/);
  await expect(page).not.toHaveURL(/\/automacoes\/casos/);

  await expect(page.getByTestId("test-case-repository")).toBeVisible();
  await expect(page.getByRole("heading", { name: /casos de teste/i })).toBeVisible();

  await expect(page.getByTestId("test-case-context-chip")).toContainText(profile.label);

  if (profile.isGlobal) {
    await expect(page.getByTestId("test-case-company-filter")).toBeVisible();
  } else {
    await expect(page.getByTestId("test-case-company-filter")).toBeHidden();
  }
}

async function selectCompanyIfGlobal(page: Page, profile: ProfileScenario) {
  if (!profile.isGlobal) return;

  const filter = page.getByTestId("test-case-company-filter");
  await expect(filter).toBeVisible();
  await filter.selectOption(profile.companySlug);

  await expect(page.getByTestId("test-case-context-chip")).toContainText(profile.companySlug);
}

async function resolveCaseIdByTitle(context: BrowserContext, title: string) {
  const response = await context.request.get(`/api/test-cases?query=${encodeURIComponent(title)}`);
  expect(response.ok()).toBeTruthy();
  const payload = (await response.json()) as { items?: Array<{ testCase?: { id?: string; title?: string } }> };
  const found = (payload.items ?? []).find((item) => item.testCase?.title === title);
  expect(found?.testCase?.id).toBeTruthy();
  return String(found?.testCase?.id);
}

async function createCase(page: Page, context: BrowserContext, profile: ProfileScenario, suffix: string) {
  const title = `Caso E2E ${profile.label} ${suffix}`;

  await page.getByTestId("test-case-new-button").click();
  await page.getByTestId("test-case-new-manual").click();
  await expect(page.getByTestId("test-case-create-modal")).toBeVisible();

  await page.getByTestId("test-case-title-input").fill(title);
  await page
    .getByTestId("test-case-description-input")
    .fill(`Caso criado no Playwright para validar o perfil ${profile.label}.`);

  await page
    .getByTestId("test-case-preconditions-input")
    .fill("Usuário autenticado e contexto correto carregado.");

  await page.getByTestId("test-case-add-step-button").click();

  await page
    .getByTestId("test-case-step-action-input")
    .fill("Acessar o Repositório Central de Casos de Teste.");

  await page
    .getByTestId("test-case-step-expected-input")
    .fill("A tela deve abrir no contexto correto do perfil autenticado.");

  await page.getByTestId("test-case-save-button").click();

  await expect(page.getByTestId("test-case-list")).toContainText(title);

  const card = page.getByTestId("test-case-card").filter({ hasText: title }).first();
  await expect(card).toBeVisible();
  await card.click();

  await expect(page.getByTestId("test-case-detail")).toBeVisible();
  await expect(page.getByTestId("test-case-detail-title")).toContainText(title);

  const key = (await page.getByTestId("test-case-key").first().innerText()).trim();
  const id = await resolveCaseIdByTitle(context, title);

  return {
    title,
    key,
    id,
  };
}

async function createPlanAndLinkCase(
  page: Page,
  profile: ProfileScenario,
  suffix: string,
  testCase: { title: string; key: string; id: string },
) {
  const title = `Plano E2E ${profile.label} ${suffix}`;

  await page.goto(`/empresas/${encodeURIComponent(profile.companySlug)}/planos-de-teste`);

  await expect(page.getByTestId("test-plan-repository")).toBeVisible();
  await expect(page.getByTestId("test-plan-context-chip")).toContainText(profile.label);

  await page.getByTestId("test-plan-new-button").click();
  await expect(page.getByTestId("test-plan-create-modal")).toBeVisible();

  await page.getByTestId("test-plan-title-input").fill(title);
  await page
    .getByTestId("test-plan-description-input")
    .fill(`Plano criado no Playwright para validar vínculo com caso do perfil ${profile.label}.`);

  const caseIdInput = page.getByLabel(/ID do caso|Case ID/i).first();
  await caseIdInput.fill(testCase.id);

  await page.getByTestId("test-plan-save-button").click();

  await expect(page.getByTestId("test-plan-list")).toContainText(title);

  const card = page.getByTestId("test-plan-card").filter({ hasText: title }).first();
  await expect(card).toBeVisible();
  await card.click();

  await expect(page.getByTestId("test-plan-detail")).toContainText(testCase.id);

  const key = (await page.getByTestId("test-plan-key").first().innerText()).trim();

  return {
    title,
    key,
  };
}

async function createRunFromPlan(
  page: Page,
  profile: ProfileScenario,
  suffix: string,
  plan: { title: string; key: string },
  testCase: { title: string; key: string; id: string },
) {
  const title = `Run E2E ${profile.label} ${suffix}`;

  await page.goto(`/empresas/${encodeURIComponent(profile.companySlug)}/runs`);

  await expect(page.getByTestId("test-run-repository")).toBeVisible();
  await expect(page.getByTestId("test-run-context-chip")).toContainText(profile.label);

  await page.getByTestId("test-run-new-button").click();
  await expect(page.getByTestId("test-run-create-modal")).toBeVisible();

  await page.getByTestId("test-run-title-input").first().fill(title);

  const planSelect = page.getByTestId("test-run-plan-search-input").first();
  const optionCount = await planSelect.locator("option").count();
  let selected = false;
  for (let index = 0; index < optionCount; index += 1) {
    const option = planSelect.locator("option").nth(index);
    const label = (await option.textContent()) ?? "";
    if (label.toLowerCase().includes(plan.title.toLowerCase())) {
      const value = await option.getAttribute("value");
      if (value) {
        await planSelect.selectOption(value);
        selected = true;
        break;
      }
    }
  }
  if (!selected && optionCount > 1) {
    await planSelect.selectOption({ index: 1 });
  }

  await page.getByRole("button", { name: /Aplicar plano/i }).first().click();
  await page.getByTestId("test-run-save-button").first().click();

  await expect(page.getByTestId("test-run-list")).toContainText(title);

  const card = page.getByTestId("test-run-card").filter({ hasText: title }).first();
  await expect(card).toBeVisible();
  await card.click();

  await expect(page.getByTestId("test-run-detail")).toBeVisible();
  await expect(page.getByTestId("test-run-linked-case")).toContainText(testCase.title);

  const key = (await page.getByTestId("test-run-key").first().innerText()).trim();

  return {
    title,
    key,
  };
}

async function assertProfileCannotSwitchContext(page: Page, profile: ProfileScenario) {
  if (profile.isGlobal) return;

  await page.goto("/casos-de-teste");

  await expect(page.getByTestId("test-case-repository")).toBeVisible();
  await expect(page.getByTestId("test-case-company-filter")).toBeHidden();
}

test.describe("Repositório Central - ciclo completo por perfil", () => {
  for (const profile of profiles) {
    test(`@case=TC-PROFILE-CYCLE-${profile.key} ${profile.label} cria caso, plano e run no próprio contexto`, async ({
      context,
      page,
    }) => {
      const suffix = makeSuffix(profile);

      await loginAsProfile(context, page, profile);

      await assertRepositoryContext(page, profile);

      await selectCompanyIfGlobal(page, profile);

      const createdCase = await createCase(page, context, profile, suffix);

      const createdPlan = await createPlanAndLinkCase(page, profile, suffix, createdCase);

      const createdRun = await createRunFromPlan(page, profile, suffix, createdPlan, createdCase);

      await assertProfileCannotSwitchContext(page, profile);

      await test.step("Validar rastreabilidade do ciclo", async () => {
        expect(createdCase.title).toContain(profile.label);
        expect(createdPlan.title).toContain(profile.label);
        expect(createdRun.title).toContain(profile.label);
      });
    });
  }
});
