import { expect, test, type BrowserContext, type Page } from "./fixtures/test";
import { mockAuth } from "./helpers/mockAuth";

type Scenario = {
  label: string;
  role: "technical_support" | "leader_tc";
  permissionRole: "technical_support" | "leader_tc";
  companySlug: string;
  companySlugs: string[];
};

const SCENARIOS: Scenario[] = [
  {
    label: "Suporte Técnico",
    role: "technical_support",
    permissionRole: "technical_support",
    companySlug: "testing-company",
    companySlugs: ["testing-company", "griaule"],
  },
  {
    label: "Líder TC",
    role: "leader_tc",
    permissionRole: "leader_tc",
    companySlug: "testing-company",
    companySlugs: ["testing-company", "griaule"],
  },
];

function uniqueSuffix(label: string) {
  return `${label.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

async function authenticateAs(page: Page, context: BrowserContext, scenario: Scenario) {
  await mockAuth(context, {
    id: `e2e-automation-${scenario.role}`,
    name: `E2E ${scenario.label}`,
    email: `e2e-automation-${scenario.role}@testingcompany.local`,
    role: scenario.role,
    permissionRole: scenario.permissionRole,
    companyRole: scenario.role,
    companySlug: scenario.companySlug,
    companySlugs: scenario.companySlugs,
    clientSlug: scenario.companySlug,
    clientSlugs: scenario.companySlugs,
    isGlobalAdmin: scenario.role === "leader_tc",
  });

  await page.goto("/casos-de-teste");
}

async function findCaseIdsByTitle(context: BrowserContext, title: string) {
  const response = await context.request.get(`/api/test-cases?query=${encodeURIComponent(title)}`);
  expect(response.ok()).toBeTruthy();
  const payload = (await response.json()) as {
    items?: Array<{ testCase?: { id?: string; title?: string; automationStatus?: string } }>;
  };
  const matches = (payload.items ?? [])
    .filter((item) => item.testCase?.title === title && item.testCase?.id)
    .map((item) => ({
      id: String(item.testCase?.id),
      automationStatus: String(item.testCase?.automationStatus ?? "none"),
    }));
  return matches;
}

async function createCase(page: Page, title: string) {
  await page.getByTestId("test-case-new-button").click();
  await page.getByTestId("test-case-new-manual").click();
  await expect(page.getByTestId("test-case-create-modal")).toBeVisible();

  await page.getByTestId("test-case-title-input").fill(title);
  await page.getByTestId("test-case-description-input").fill("Caso criado para validar vínculo de automação Playwright.");
  await page.getByTestId("test-case-preconditions-input").fill("Caso disponível no repositório central.");

  await page.getByTestId("test-case-add-step-button").click();
  await page.getByTestId("test-case-step-action-input").fill("Clicar em Automatizar no detalhe do caso.");
  await page.getByTestId("test-case-step-expected-input").fill("Abrir contexto de automação sem criar outro caso.");

  await page.getByTestId("test-case-save-button").click();
  await expect(page.getByTestId("test-case-list")).toContainText(title);

  const card = page.getByTestId("test-case-card").filter({ hasText: title }).first();
  await expect(card).toBeVisible();
  await card.click();
  await expect(page.getByTestId("test-case-detail-title")).toContainText(title);
}

test.describe("Automação Playwright vinculada ao caso existente", () => {
  for (const scenario of SCENARIOS) {
    test(`@case=TC-AUTOMATION-LINK-${scenario.role} ${scenario.label} vincula automação sem duplicar caso`, async ({ page, context }) => {
      const title = `Caso automacao ${uniqueSuffix(scenario.label)}`;

      await authenticateAs(page, context, scenario);
      await expect(page.getByTestId("test-case-repository")).toBeVisible();

      await createCase(page, title);

      const before = await findCaseIdsByTitle(context, title);
      expect(before.length).toBe(1);

      await page.getByTestId("test-case-automation-action").click();

      await expect(page).toHaveURL(/\/automacoes\/playwright\?testCaseId=/);
      await expect(page.getByTestId("automation-context")).toBeVisible();
      await expect(page.getByTestId("automation-linked-test-case")).toContainText(title);

      await page.getByTestId("automation-spec-file-input").fill(`tests-e2e/${scenario.role}.spec.ts`);
      await page.getByTestId("automation-test-title-input").fill(`Fluxo Playwright ${scenario.label}`);
      await page.getByTestId("automation-save-link-button").click();

      await page.getByRole("link", { name: /Voltar ao repositório/i }).click();
      await expect(page).toHaveURL(/\/casos-de-teste/);

      await page.getByTestId("test-case-search").fill(title);
      await expect(page.getByTestId("test-case-list")).toContainText(title);

      const after = await findCaseIdsByTitle(context, title);
      expect(after.length).toBe(1);
      expect(after[0]?.id).toBe(before[0]?.id);
      expect(["linked", before[0]?.automationStatus]).toContain(after[0]?.automationStatus);
    });
  }
});
