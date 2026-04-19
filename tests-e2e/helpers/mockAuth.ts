import type { BrowserContext } from "@playwright/test";

const rawBaseURL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3100";
const baseURL = /^https?:\/\//i.test(rawBaseURL) ? rawBaseURL : `http://${rawBaseURL}`;
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || "admin@demo.test";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || "Griaule@123";
const COMPANY_EMAIL = process.env.E2E_COMPANY_EMAIL || "company@demo.test";
const COMPANY_PASSWORD = process.env.E2E_COMPANY_PASSWORD || "Griaule@123";
const USER_EMAIL = process.env.E2E_USER_EMAIL || "user@demo.test";
const USER_PASSWORD = process.env.E2E_USER_PASSWORD || "Griaule@123";
const NO_COMPANY_EMAIL = process.env.E2E_NO_COMPANY_EMAIL || "nocompany@demo.test";
const NO_COMPANY_PASSWORD = process.env.E2E_NO_COMPANY_PASSWORD || "Griaule@123";

function buildPasswordCandidates(primary: string) {
  return Array.from(new Set([primary, "Griaule@123", "Demo@123", "senha"]));
}

function buildEmailCandidates(primary: string, role: MockAuthOptions["role"], wantsNoCompany: boolean) {
  const defaultsByRole =
    role === "admin"
      ? ["admin@demo.test", "admin", "ana1"]
      : role === "company" || role === "client"
        ? ["company@demo.test", "demo"]
        : wantsNoCompany
          ? ["nocompany@demo.test"]
          : ["user@demo.test", "anapaula", "analysyk"];
  return Array.from(new Set([primary, ...defaultsByRole].filter(Boolean)));
}

export type MockAuthOptions = {
  role: "admin" | "company" | "client" | "user";
  companies?: string[];
  clientSlug?: string;
};

export async function mockAuth(context: BrowserContext, options: MockAuthOptions) {
  const { role, companies } = options;
  const wantsNoCompany = Array.isArray(companies) && companies.length === 0;
  const loginEmail =
    role === "admin"
      ? ADMIN_EMAIL
      : role === "company" || role === "client"
        ? COMPANY_EMAIL
        : wantsNoCompany
          ? NO_COMPANY_EMAIL
          : USER_EMAIL;
  const loginPassword =
    role === "admin"
      ? ADMIN_PASSWORD
      : role === "company" || role === "client"
        ? COMPANY_PASSWORD
        : wantsNoCompany
          ? NO_COMPANY_PASSWORD
          : USER_PASSWORD;
  const emailCandidates = buildEmailCandidates(loginEmail, role, wantsNoCompany);
  const loginUrl = new URL("/api/auth/login", baseURL).toString();
  let response = null as Awaited<ReturnType<typeof context.request.post>> | null;
  for (const emailCandidate of emailCandidates) {
    for (const passwordCandidate of buildPasswordCandidates(loginPassword)) {
      response = await context.request.post(loginUrl, {
        data: {
          user: emailCandidate,
          password: passwordCandidate,
          ...(options.clientSlug ? { clientSlug: options.clientSlug } : {}),
        },
      });
      if (response.ok()) break;
    }
    if (response?.ok()) break;
  }

  if (!response?.ok()) {
    throw new Error(`mockAuth login failed: ${response?.status()} ${response?.statusText()}`);
  }

  const setCookie = response.headers()["set-cookie"];
  const raw = Array.isArray(setCookie) ? setCookie.join(";") : setCookie;
  const sessionMatch = raw?.match(/session_id=([^;]+)/);
  const authMatch = raw?.match(/auth_token=([^;]+)/);
  const activeCompanyMatch = raw?.match(/active_company_slug=([^;]+)/);
  if (!sessionMatch?.[1]) {
    throw new Error("mockAuth login failed: missing session_id cookie");
  }
  const cookies = [{ name: "session_id", value: sessionMatch[1], url: baseURL }];
  if (authMatch?.[1]) {
    cookies.push({ name: "auth_token", value: authMatch[1], url: baseURL });
  }
  if (activeCompanyMatch?.[1]) {
    cookies.push({ name: "active_company_slug", value: activeCompanyMatch[1], url: baseURL });
  }
  await context.addCookies(cookies);
}


