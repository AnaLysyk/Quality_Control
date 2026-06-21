import type { BrowserContext } from "@playwright/test";

const rawBaseURL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3100";
const baseURL = /^https?:\/\//i.test(rawBaseURL) ? rawBaseURL : `http://${rawBaseURL}`;
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || "admin@demo.test";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || "Demo@123";
const COMPANY_EMAIL = process.env.E2E_COMPANY_EMAIL || "company@demo.test";
const COMPANY_PASSWORD = process.env.E2E_COMPANY_PASSWORD || "Demo@123";
const USER_EMAIL = process.env.E2E_USER_EMAIL || "user@demo.test";
const USER_PASSWORD = process.env.E2E_USER_PASSWORD || "Demo@123";
const NO_COMPANY_EMAIL = process.env.E2E_NO_COMPANY_EMAIL || "nocompany@demo.test";
const NO_COMPANY_PASSWORD = process.env.E2E_NO_COMPANY_PASSWORD || "Demo@123";

function montarSenhasCandidatas(primary: string) {
  return Array.from(new Set([primary, "Griaule@123", "Demo@123", "senha"]));
}

function montarEmailsCandidatos(primary: string, role: OpcoesAutenticacaoSimulada["role"], wantsNoCompany: boolean) {
  const defaultsByRole =
    role === "admin" || role === "leader_tc" || role === "technical_support"
      ? ["admin@demo.test", "admin", "ana1"]
      : role === "company" || role === "client" || role === "empresa" || role === "company_user"
        ? ["company@demo.test", "demo"]
        : wantsNoCompany
          ? ["nocompany@demo.test"]
          : ["user@demo.test", "anapaula", "analysyk"];
  return Array.from(new Set([primary, ...defaultsByRole].filter(Boolean)));
}

export type OpcoesAutenticacaoSimulada = {
  role:
    | "admin"
    | "company"
    | "client"
    | "user"
    | "empresa"
    | "technical_support"
    | "leader_tc"
    | "testing_company_user"
    | "company_user";
  id?: string;
  permissionRole?: string;
  companyRole?: string;
  companies?: string[];
  companySlug?: string;
  companySlugs?: string[];
  clientSlug?: string;
  clientSlugs?: string[];
  isGlobalAdmin?: boolean;
  permissions?: Record<string, string[]>;
  name?: string;
  email?: string;
};

function normalizeList(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => String(value ?? "").trim())
        .filter((value) => value.length > 0),
    ),
  );
}

function toCompanyName(slug: string) {
  const normalized = slug.trim().toLowerCase();
  if (normalized === "testing-company") return "Testing Company";
  return slug;
}

function buildMockMePayload(options: OpcoesAutenticacaoSimulada) {
  const companySlugs = normalizeList([
    ...(options.companySlugs ?? []),
    ...(options.clientSlugs ?? []),
    ...(options.companies ?? []),
    options.companySlug,
    options.clientSlug,
  ]);

  const effectiveCompanySlug =
    String(options.companySlug ?? options.clientSlug ?? companySlugs[0] ?? "testing-company").trim() || "testing-company";

  const user = {
    id: options.id ?? `e2e-${options.role}`,
    email: options.email ?? `e2e-${options.role}@testingcompany.local`,
    name: options.name ?? `E2E ${options.role}`,
    role: options.role,
    permissionRole: options.permissionRole ?? options.role,
    companyRole: options.companyRole ?? options.role,
    companySlug: effectiveCompanySlug,
    companySlugs,
    clientSlug: options.clientSlug ?? effectiveCompanySlug,
    clientSlugs: options.clientSlugs ?? companySlugs,
    isGlobalAdmin: options.isGlobalAdmin === true,
    permissions: options.permissions,
    defaultClientSlug: options.clientSlug ?? effectiveCompanySlug,
  };

  const companies = companySlugs
    .filter(Boolean)
    .map((slug) => ({
      id: slug,
      slug,
      name: toCompanyName(slug),
      role: (options.companyRole ?? options.role).toUpperCase() === "EMPRESA" ? "ADMIN" : "USER",
      active: true,
      companyRole: options.companyRole ?? options.role,
    }));

  return { user, companies };
}

export async function simularAutenticacao(context: BrowserContext, options: OpcoesAutenticacaoSimulada) {
  const { role, companies } = options;
  const wantsNoCompany = Array.isArray(companies) && companies.length === 0;
  const explicitLoginEmail = options.email && options.email.includes("@") ? options.email : null;
  const loginEmail =
    explicitLoginEmail ??
    (role === "admin" || role === "leader_tc" || role === "technical_support"
      ? ADMIN_EMAIL
      : role === "company" || role === "client" || role === "empresa" || role === "company_user"
        ? COMPANY_EMAIL
        : wantsNoCompany
          ? NO_COMPANY_EMAIL
          : USER_EMAIL);
  const loginPassword =
    role === "admin" || role === "leader_tc" || role === "technical_support"
      ? ADMIN_PASSWORD
      : role === "company" || role === "client" || role === "empresa" || role === "company_user"
        ? COMPANY_PASSWORD
        : wantsNoCompany
          ? NO_COMPANY_PASSWORD
          : USER_PASSWORD;
  const emailCandidates = montarEmailsCandidatos(loginEmail, role, wantsNoCompany);
  const loginUrl = new URL("/api/auth/login", baseURL).toString();
  let response = null as Awaited<ReturnType<typeof context.request.post>> | null;
  for (const emailCandidate of emailCandidates) {
    for (const passwordCandidate of montarSenhasCandidatas(loginPassword)) {
      response = await context.request.post(loginUrl, {
        data: {
          user: emailCandidate,
          password: passwordCandidate,
          ...(options.clientSlug ? { clientSlug: options.clientSlug } : {}),
        },
      });
      // In E2E mock mode, the login endpoint can be disabled (e.g. 405). In that case we only
      // need a stable session cookie and the mocked /api/me routes below.
      if (response.status() === 405 || response.status() === 404) {
        response = null;
        break;
      }
      if (response.ok()) break;
    }
    if (response?.ok()) break;
    if (response === null) break;
  }

  const setCookie = response?.ok() ? response.headers()["set-cookie"] : null;
  const raw = Array.isArray(setCookie) ? setCookie.join(";") : setCookie;
  const sessionMatch = raw?.match(/session_id=([^;]+)/);
  const authMatch = raw?.match(/auth_token=([^;]+)/);
  const activeCompanyMatch = raw?.match(/active_company_slug=([^;]+)/);
  const cookies = [
    {
      name: "session_id",
      value: sessionMatch?.[1] ?? `e2e-session-${Date.now().toString(36)}`,
      url: baseURL,
    },
  ];
  if (authMatch?.[1]) {
    cookies.push({ name: "auth_token", value: authMatch[1], url: baseURL });
  }
  if (activeCompanyMatch?.[1]) {
    cookies.push({ name: "active_company_slug", value: activeCompanyMatch[1], url: baseURL });
  }
  if (options.companySlug) {
    cookies.push({ name: "active_company_slug", value: options.companySlug, url: baseURL });
  }
  await context.addCookies(cookies);

  const mePayload = buildMockMePayload(options);
  const e2eAuthPayload = Buffer.from(
    JSON.stringify({
      id: mePayload.user.id,
      email: mePayload.user.email,
      role: mePayload.user.role,
      permissionRole: mePayload.user.permissionRole,
      companyRole: mePayload.user.companyRole,
      companySlug: mePayload.user.companySlug,
      companySlugs: mePayload.user.companySlugs,
      isGlobalAdmin: mePayload.user.isGlobalAdmin,
    }),
  ).toString("base64url");

  cookies.push({ name: "e2e_auth", value: e2eAuthPayload, url: baseURL });
  await context.addCookies([{ name: "e2e_auth", value: e2eAuthPayload, url: baseURL }]);

  await context.route("**/api/me", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mePayload),
    });
  });

  await context.route("**/api/auth/me", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mePayload),
    });
  });

  await context.route("**/api/me/clients", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items: mePayload.companies }),
    });
  });
}
