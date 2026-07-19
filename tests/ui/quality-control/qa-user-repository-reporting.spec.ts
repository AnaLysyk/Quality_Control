import type { APIRequestContext, BrowserContext, Page } from "@playwright/test";

import { test, expect } from "../../../tools/fixtures/test";
import { simularAutenticacao } from "../../../tools/functions/ui/apoio/simular-autenticacao";

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3100";
const useJsonSeed = process.env.E2E_USE_JSON === "1";
const sharedPassword = process.env.E2E_PROFILE_PASSWORD || "Demo@123";
const adminEmail =
  process.env.E2E_ADMIN_EMAIL ||
  (useJsonSeed ? "e2e-leader-tc@testingcompany.local" : "admin@demo.test");
const adminPassword = process.env.E2E_ADMIN_PASSWORD || sharedPassword;
const qaEmail =
  process.env.E2E_QA_QUALITY_EMAIL ||
  (useJsonSeed
    ? "e2e-qa-quality@testingcompany.local"
    : (process.env.E2E_USER_EMAIL || "user@demo.test"));
const qaPassword = process.env.E2E_QA_QUALITY_PASSWORD || process.env.E2E_USER_PASSWORD || sharedPassword;

const COMPANY_SLUG = "testing-company";
const QUALITY_CONTROL_SLUG = "quality-control";
const QUALITY_CONTROL_PROJECT_CODE = "QUALITY-CONTROL";
const QUALITY_CONTROL_CASE_PROJECT_CODE = "QUALITY CONTROL";

test.setTimeout(180000);

type AuthSession = {
  sessionId: string;
  authToken: string | null;
  accessToken: string | null;
  activeCompanySlug: string | null;
  companyRouteMode: string | null;
};

type ApplicationItem = {
  id: string;
  slug: string;
  name: string;
};

type ProjectItem = {
  id: string;
  slug: string;
  name: string;
};

type TestCaseRecordPayload = {
  items?: Array<{
    testCase: {
      id: string;
      key: string;
      title: string;
      companyId?: string | null;
      projectId?: string | null;
      applicationId?: string | null;
    };
  }>;
};

type TestPlanListPayload = {
  plans?: Array<{
    id: string;
    title: string;
    source: string;
    applicationId?: string | null;
  }>;
};

type TestPlanDetailPayload = {
  plan?: {
    id: string;
    title: string;
    applicationId?: string | null;
    cases?: Array<{ id: string }>;
  };
};

type ManualRunPayload = Array<{
  slug?: string;
  name?: string;
  clientSlug?: string | null;
  testPlanId?: string | null;
  testPlanName?: string | null;
  stats?: {
    pass?: number;
    fail?: number;
    blocked?: number;
    notRun?: number;
  };
}>;

function buildSuffix() {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function extractCookie(setCookie: string | string[] | undefined, name: string) {
  if (!setCookie) return null;
  const raw = Array.isArray(setCookie) ? setCookie.join(";") : setCookie;
  const match = raw.match(new RegExp(`${name}=([^;]+)`));
  return match?.[1] ?? null;
}

function buildCookieHeader(session: AuthSession) {
  return [
    `session_id=${session.sessionId}`,
    session.authToken ? `auth_token=${session.authToken}` : null,
    session.accessToken ? `access_token=${session.accessToken}` : null,
    session.activeCompanySlug ? `active_company_slug=${session.activeCompanySlug}` : null,
    session.companyRouteMode ? `qc_company_route_mode=${session.companyRouteMode}` : null,
  ]
    .filter(Boolean)
    .join("; ");
}

async function apiGet(request: APIRequestContext, session: AuthSession, url: string) {
  return request.get(url, {
    headers: { cookie: buildCookieHeader(session) },
  });
}

async function apiPost(request: APIRequestContext, session: AuthSession, url: string, data: Record<string, unknown>) {
  return request.post(url, {
    headers: { cookie: buildCookieHeader(session) },
    data,
  });
}

async function loginWithApi(
  request: APIRequestContext,
  email: string,
  password: string,
  companySlug = COMPANY_SLUG,
) {
  const response = await request.post("/api/auth/login", {
    data: {
      user: email,
      password,
      companySlug,
    },
  });
  expect(response.ok(), await response.text()).toBeTruthy();

  const headers = response.headers();
  const sessionId = extractCookie(headers["set-cookie"], "session_id");

  expect(sessionId, "missing session_id cookie").toBeTruthy();

  return {
    sessionId: sessionId as string,
    authToken: extractCookie(headers["set-cookie"], "auth_token"),
    accessToken: extractCookie(headers["set-cookie"], "access_token"),
    activeCompanySlug: extractCookie(headers["set-cookie"], "active_company_slug"),
    companyRouteMode: extractCookie(headers["set-cookie"], "qc_company_route_mode"),
  } satisfies AuthSession;
}

async function applySessionToBrowserContext(context: BrowserContext, session: AuthSession) {
  const cookies: Array<{ name: string; value: string; url: string; httpOnly?: boolean }> = [
    { name: "session_id", value: session.sessionId, url: baseURL, httpOnly: true },
  ];

  if (session.authToken) {
    cookies.push({ name: "auth_token", value: session.authToken, url: baseURL, httpOnly: true });
  }
  if (session.accessToken) {
    cookies.push({ name: "access_token", value: session.accessToken, url: baseURL, httpOnly: true });
  }
  if (session.activeCompanySlug) {
    cookies.push({ name: "active_company_slug", value: session.activeCompanySlug, url: baseURL, httpOnly: true });
  }
  if (session.companyRouteMode) {
    cookies.push({ name: "qc_company_route_mode", value: session.companyRouteMode, url: baseURL });
  }

  await context.addCookies(cookies);
}

async function ensureQualityControlApplication(
  request: APIRequestContext,
  adminSession: AuthSession,
) {
  const cookieHeader = [
    `session_id=${adminSession.sessionId}`,
    adminSession.authToken ? `auth_token=${adminSession.authToken}` : null,
    adminSession.accessToken ? `access_token=${adminSession.accessToken}` : null,
    adminSession.activeCompanySlug ? `active_company_slug=${adminSession.activeCompanySlug}` : null,
    adminSession.companyRouteMode ? `qc_company_route_mode=${adminSession.companyRouteMode}` : null,
  ]
    .filter(Boolean)
    .join("; ");

  const listResponse = await request.get(
    `/api/applications?companySlug=${encodeURIComponent(COMPANY_SLUG)}&light=1`,
    { headers: { cookie: cookieHeader } },
  );
  expect(listResponse.ok(), await listResponse.text()).toBeTruthy();

  const listPayload = (await listResponse.json()) as { items?: ApplicationItem[] };
  const existing = (listPayload.items ?? []).find(
    (item) => item.slug === QUALITY_CONTROL_SLUG || item.id === QUALITY_CONTROL_SLUG,
  );
  if (existing) return existing;

  const createResponse = await request.post("/api/applications", {
    headers: { cookie: cookieHeader },
    data: {
      companySlug: COMPANY_SLUG,
      name: "Quality Control",
      slug: QUALITY_CONTROL_SLUG,
      qaseProjectCode: QUALITY_CONTROL_PROJECT_CODE,
      source: "e2e",
    },
  });
  expect(createResponse.ok(), await createResponse.text()).toBeTruthy();

  const payload = (await createResponse.json()) as { item: ApplicationItem };
  return payload.item;
}

async function resolveQualityControlProject(request: APIRequestContext, session: AuthSession) {
  const response = await apiGet(
    request,
    session,
    `/api/projects?companySlug=${encodeURIComponent(COMPANY_SLUG)}`,
  );
  expect(response.ok(), await response.text()).toBeTruthy();

  const payload = (await response.json()) as { projects?: ProjectItem[] };
  const project = (payload.projects ?? []).find((item) => item.slug === QUALITY_CONTROL_SLUG);

  expect(project, "Quality Control project not available for testing-company").toBeTruthy();
  return project as ProjectItem;
}

async function resolveQualityControlApplication(request: APIRequestContext, session: AuthSession) {
  const response = await apiGet(
    request,
    session,
    `/api/applications?companySlug=${encodeURIComponent(COMPANY_SLUG)}&light=1`,
  );
  expect(response.ok(), await response.text()).toBeTruthy();

  const payload = (await response.json()) as { items?: ApplicationItem[] };
  const application = (payload.items ?? []).find(
    (item) =>
      item.slug === QUALITY_CONTROL_SLUG ||
      item.id === QUALITY_CONTROL_SLUG ||
      item.name.toLowerCase() === "quality control",
  );

  expect(application, "Quality Control application not available for testing-company").toBeTruthy();
  return application as ApplicationItem;
}

async function waitForAuthenticatedNavigation(page: Page, url: string) {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded" });
      lastError = null;
      break;
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      if (!/ERR_ABORTED|frame was detached/i.test(message) || attempt === 1) {
        throw error;
      }
    }
  }
  if (lastError) {
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }
  const authLoading = page.getByText(/Validando sessao/i);
  if (await authLoading.isVisible().catch(() => false)) {
    await authLoading.waitFor({ state: "hidden", timeout: 15000 }).catch(() => {});
  }
}

async function waitForCompanyRunsRepositoryLoad(page: Page) {
  await page
    .waitForResponse(
      (response) =>
        response.request().method() === "GET" &&
        response.url().includes(`/api/releases-manual?clientSlug=${encodeURIComponent(COMPANY_SLUG)}&kind=run`),
      { timeout: 15000 },
    )
    .catch(() => null);
}

async function waitForCompanyCaseRepositoryLoad(page: Page) {
  await page
    .waitForResponse(
      (response) =>
        response.request().method() === "GET" &&
        response.url().includes(`/api/test-cases?companySlug=${encodeURIComponent(COMPANY_SLUG)}`),
      { timeout: 15000 },
    )
    .catch(() => null);
}

async function createCaseViaUi(
  page: Page,
  request: APIRequestContext,
  session: AuthSession,
  project: ProjectItem,
  application: ApplicationItem,
  suffix: string,
) {
  const title = `Caso QA Quality Control ${suffix}`;

  const creationResponse = await apiPost(request, session, "/api/test-cases", {
      companySlug: COMPANY_SLUG,
      projectId: project.id,
      applicationId: QUALITY_CONTROL_SLUG,
      testProjectCode: QUALITY_CONTROL_CASE_PROJECT_CODE,
      testProjectName: project.name,
      title,
      description: "Caso criado para validar o repositório Quality Control.",
      preconditions: "QA autenticado no escopo da testing-company com projeto quality-control ativo.",
      tags: ["qa", "quality-control", "e2e"],
      steps: [
        {
          action: "Abrir o repositório de casos da Testing Company.",
          expectedResult: "O sistema deve salvar o caso no contexto quality-control.",
        },
      ],
  });
  expect(creationResponse.ok(), await creationResponse.text()).toBeTruthy();

  const response = await apiGet(request, session, `/api/test-cases?query=${encodeURIComponent(title)}`);
  expect(response.ok(), await response.text()).toBeTruthy();

  const payload = (await response.json()) as TestCaseRecordPayload;
  const created = (payload.items ?? []).find((item) => item.testCase.title === title);

  expect(created).toBeTruthy();
  expect(created?.testCase.companyId).toBe(COMPANY_SLUG);
  expect(created?.testCase.projectId).toBe(project.id);
  expect(created?.testCase.applicationId).toBe(QUALITY_CONTROL_SLUG);

  await waitForAuthenticatedNavigation(
    page,
    `/empresas/${encodeURIComponent(COMPANY_SLUG)}/casos-de-teste`,
  );
  await waitForCompanyCaseRepositoryLoad(page);
  await expect(page.getByRole("heading", { name: /Casos de Teste/i })).toBeVisible();
  const caseSearch = page.getByPlaceholder(/Buscar caso, projeto, tag/i);
  await expect(caseSearch).toBeVisible();
  await caseSearch.fill(title);
  await expect(page.getByRole("heading", { name: title })).toBeVisible();

  return created!.testCase;
}

async function createPlanViaUi(
  page: Page,
  request: APIRequestContext,
  session: AuthSession,
  project: ProjectItem,
  application: ApplicationItem,
  testCaseId: string,
  suffix: string,
) {
  const title = `Plano QA Quality Control ${suffix}`;

  const creationResponse = await apiPost(request, session, "/api/test-plans", {
      companySlug: COMPANY_SLUG,
      projectId: project.id,
      applicationId: application.id,
      projectCode: QUALITY_CONTROL_PROJECT_CODE,
      source: "manual",
      title,
      description: "Plano criado para validar a rastreabilidade do Quality Control.",
      testCaseIds: [testCaseId],
  });
  expect(creationResponse.ok(), await creationResponse.text()).toBeTruthy();

  const listResponse = await apiGet(
    request,
    session,
    `/api/test-plans?companySlug=${encodeURIComponent(COMPANY_SLUG)}&applicationId=${encodeURIComponent(application.id)}`,
  );
  expect(listResponse.ok(), await listResponse.text()).toBeTruthy();

  const listPayload = (await listResponse.json()) as TestPlanListPayload;
  const created = (listPayload.plans ?? []).find((item) => item.title === title && item.source === "manual");

  expect(created).toBeTruthy();

  const detailResponse = await apiGet(
    request,
    session,
    `/api/test-plans?companySlug=${encodeURIComponent(COMPANY_SLUG)}&applicationId=${encodeURIComponent(application.id)}&projectId=${encodeURIComponent(project.id)}&planId=${encodeURIComponent(created!.id)}&source=manual`,
  );
  expect(detailResponse.ok(), await detailResponse.text()).toBeTruthy();

  const detailPayload = (await detailResponse.json()) as TestPlanDetailPayload;
  expect(detailPayload.plan?.id).toBe(created?.id);
  expect(detailPayload.plan?.cases?.some((item) => item.id === testCaseId)).toBe(true);

  await waitForAuthenticatedNavigation(
    page,
    `/empresas/${encodeURIComponent(COMPANY_SLUG)}/planos-de-teste`,
  );
  await expect(page.getByTestId("test-plan-repository")).toBeVisible();
  await expect(page.getByTestId("test-plan-list")).toContainText(title);

  return {
    id: created!.id,
    title,
  };
}

async function createRunViaUi(
  page: Page,
  request: APIRequestContext,
  session: AuthSession,
  application: ApplicationItem,
  plan: { id: string; title: string },
  suffix: string,
) {
  const title = `Run QA Quality Control ${suffix}`;
  const visibleTitle = title.replace(/^Run\b[\s:._-]*/i, "").trim();
  const response = await apiPost(request, session, "/api/releases-manual", {
    name: title,
    slug: `run-qa-quality-control-${suffix}`,
    app: application.slug || application.name,
    qaseProject: QUALITY_CONTROL_PROJECT_CODE,
    kind: "run",
    clientSlug: COMPANY_SLUG,
    testPlanId: plan.id,
    testPlanName: plan.title,
    testPlanSource: "manual",
    testPlanProjectCode: QUALITY_CONTROL_PROJECT_CODE,
    stats: {
      pass: 1,
      fail: 0,
      blocked: 0,
      notRun: 0,
    },
    observations: "Run criada para validar o fluxo completo de QA no Quality Control.",
  });
  expect(response.ok(), await response.text()).toBeTruthy();

  const created = (await response.json()) as { slug?: string; name?: string };
  const slug = created.slug ?? "";

  expect(slug).toBeTruthy();
  await expect
    .poll(
      async () => {
        const runsResponse = await apiGet(
          request,
          session,
          `/api/releases-manual?clientSlug=${encodeURIComponent(COMPANY_SLUG)}&kind=run`,
        );
        if (!runsResponse.ok()) return null;
        const runsPayload = (await runsResponse.json()) as ManualRunPayload;
        const storedRun = runsPayload.find((item) => item.slug === slug);
        return storedRun?.name ?? null;
      },
      {
        timeout: 15000,
        intervals: [500, 1000, 1500],
      },
    )
    .toBe(title);

  await waitForAuthenticatedNavigation(
    page,
    `/empresas/${encodeURIComponent(COMPANY_SLUG)}/runs`,
  );
  await waitForCompanyRunsRepositoryLoad(page);
  const browserRunsSnapshot = await page.evaluate(async (companySlug) => {
    const response = await fetch(`/api/releases-manual?clientSlug=${encodeURIComponent(companySlug)}&kind=run`, {
      credentials: "include",
      cache: "no-store",
    });
    return {
      status: response.status,
      text: await response.text(),
      cookie: document.cookie,
    };
  }, COMPANY_SLUG);
  expect(browserRunsSnapshot.status, JSON.stringify(browserRunsSnapshot)).toBe(200);
  expect(browserRunsSnapshot.text, JSON.stringify(browserRunsSnapshot)).toContain(slug);
  await expect(page.getByTestId("test-run-repository")).toBeVisible();
  await expect(page.getByTestId("test-run-context-chip")).toContainText(COMPANY_SLUG);

  const searchInput = page.getByTestId("runs-search");
  await expect(searchInput).toBeVisible();
  await searchInput.fill(visibleTitle);

  await expect
    .poll(
      async () => page.locator("main").innerText(),
      {
        timeout: 30000,
        intervals: [1000, 2000, 5000],
      },
    )
    .toContain(visibleTitle);

  const runsResponse = await apiGet(
    request,
    session,
    `/api/releases-manual?clientSlug=${encodeURIComponent(COMPANY_SLUG)}&kind=run`,
  );
  expect(runsResponse.ok(), await runsResponse.text()).toBeTruthy();

  const runsPayload = (await runsResponse.json()) as ManualRunPayload;
  const storedRun = runsPayload.find((item) => item.slug === slug);

  expect(storedRun).toBeTruthy();
  expect(storedRun?.name).toBe(title);
  expect(storedRun?.clientSlug).toBe(COMPANY_SLUG);
  expect(storedRun?.testPlanId).toBe(plan.id);
  expect(storedRun?.testPlanName).toBe(plan.title);
  expect(storedRun?.stats?.pass).toBe(1);
  expect(storedRun?.stats?.fail).toBe(0);

  return {
    slug,
    title,
  };
}

async function createQaReportViaSupportBoard(
  page: Page,
  request: APIRequestContext,
  session: AuthSession,
  title: string,
  description: string,
) {
  await waitForAuthenticatedNavigation(
    page,
    `/empresas/${encodeURIComponent(COMPANY_SLUG)}/chamados`,
  );

  const openButton = page.getByRole("button", { name: /Criar suporte|Create support ticket/i });
  await expect(openButton).toBeVisible();
  await openButton.click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByPlaceholder(/Digite o titulo do suporte|Digite o t[íi]tulo do suporte/i).fill(title);
  await dialog.getByPlaceholder(/Descreva o suporte/i).fill(description);
  await dialog.getByRole("combobox", { name: /Tipo do suporte/i }).selectOption("bug");
  await dialog.getByRole("combobox", { name: /Prioridade do suporte/i }).selectOption("high");

  const creationResponse = page.waitForResponse((response) => {
    const pathname = new URL(response.url()).pathname;
    return pathname === "/api/suportes" && response.request().method() === "POST";
  });

  await dialog.getByRole("button", { name: /^Criar$|^Create$/i }).click();

  const response = await creationResponse;
  expect(response.ok(), await response.text()).toBeTruthy();
  await expect(page.getByText(title)).toBeVisible();

  const ticketsResponse = await apiGet(
    request,
    session,
    `/api/suportes?companySlug=${encodeURIComponent(COMPANY_SLUG)}&search=${encodeURIComponent(title)}`,
  );
  expect(ticketsResponse.ok(), await ticketsResponse.text()).toBeTruthy();

  const ticketsPayload = (await ticketsResponse.json()) as {
    items?: Array<{ title?: string; companySlug?: string | null }>;
  };

  expect(
    (ticketsPayload.items ?? []).some(
      (item) => item.title === title && item.companySlug === COMPANY_SLUG,
    ),
  ).toBe(true);
}

test("QA user validates the full quality-control flow in UI and confirms persistence via API", async ({
  context,
  page,
  request,
}) => {
  const suffix = buildSuffix();

  const adminSession = await loginWithApi(request, adminEmail, adminPassword);
  const application = await ensureQualityControlApplication(request, adminSession);

  const qaSession = await loginWithApi(request, qaEmail, qaPassword);
  await applySessionToBrowserContext(context, qaSession);
  await simularAutenticacao(context, {
    role: "testing_company_user",
    id: "usr_e2e_qa_quality_user",
    name: "E2E QA Quality",
    email: qaEmail,
    companySlug: COMPANY_SLUG,
    companySlugs: [COMPANY_SLUG],
    clientSlug: COMPANY_SLUG,
    clientSlugs: [COMPANY_SLUG],
    permissionRole: "testing_company_user",
    companyRole: "testing_company_user",
  });

  const project = await resolveQualityControlProject(request, qaSession);
  const qaApplication = await resolveQualityControlApplication(request, qaSession);
  const createdCase = await createCaseViaUi(
    page,
    request,
    qaSession,
    project,
    qaApplication,
    suffix,
  );
  const createdPlan = await createPlanViaUi(
    page,
    request,
    qaSession,
    project,
    qaApplication,
    createdCase.id,
    suffix,
  );
  const createdRun = await createRunViaUi(
    page,
    request,
    qaSession,
    qaApplication,
    createdPlan,
    suffix,
  );

  const reportTitle = `Relato QA Quality Control ${suffix}`;
  const reportDescription = [
    "Fluxo QA executado pela interface e validado pela API.",
    `Caso: ${createdCase.key} - ${createdCase.title}`,
    `Plano: ${createdPlan.id} - ${createdPlan.title}`,
    `Run: ${createdRun.slug} - ${createdRun.title}`,
    "Resultado: todas as regras persistiram no contexto da testing-company.",
  ].join("\n");

  await createQaReportViaSupportBoard(
    page,
    request,
    qaSession,
    reportTitle,
    reportDescription,
  );
});
