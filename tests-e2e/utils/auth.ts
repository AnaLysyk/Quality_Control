import type { Page } from "@playwright/test";

const rawBaseURL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3100";
const baseURL = /^https?:\/\//i.test(rawBaseURL) ? rawBaseURL : `http://${rawBaseURL}`;

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || "admin@demo.test";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || "Griaule@123";
const USER_EMAIL = process.env.E2E_USER_EMAIL || "user@demo.test";
const USER_PASSWORD = process.env.E2E_USER_PASSWORD || "Griaule@123";

function buildPasswordCandidates(primary: string) {
  return Array.from(new Set([primary, "Griaule@123", "Demo@123", "senha"]));
}

function buildEmailCandidates(primary: string, type: "admin" | "company" | "user") {
  const defaultsByType =
    type === "admin"
      ? ["admin@demo.test", "admin", "ana1"]
      : type === "company"
        ? ["company@demo.test", "demo"]
        : ["user@demo.test", "anapaula", "analysyk"];
  return Array.from(new Set([primary, ...defaultsByType].filter(Boolean)));
}

type MockRole = "admin" | "client" | "user";

let lastRole: MockRole | null = null;
let lastClientSlug: string | null = null;

function resolveCredentials(inputEmail: string, inputPassword: string) {
  const email = inputEmail.toLowerCase();
  if (lastRole === "admin" || email.includes("admin")) {
    return { email: ADMIN_EMAIL, password: ADMIN_PASSWORD, role: "admin" as const };
  }
  if (lastRole === "user" || email.includes("user")) {
    return { email: USER_EMAIL, password: USER_PASSWORD, role: "user" as const };
  }
  return { email: inputEmail, password: inputPassword, role: "user" as const };
}

function parseCookie(setCookie: string | string[] | undefined, name: string): string | null {
  if (!setCookie) return null;
  const raw = Array.isArray(setCookie) ? setCookie.join(";") : setCookie;
  const match = raw.match(new RegExp(`${name}=([^;]+)`));
  return match?.[1] ?? null;
}

export async function setMockUser(page: Page, role: MockRole, clientSlug?: string | null) {
  lastRole = role;
  lastClientSlug = clientSlug ?? null;
  const creds = resolveCredentials(role === "admin" ? "admin" : "user", "");
  const emailCandidates = buildEmailCandidates(creds.email, role === "admin" ? "admin" : "user");

  const loginUrl = new URL("/api/auth/login", baseURL).toString();
  let response = null as Awaited<ReturnType<typeof page.context().request.post>> | null;
  for (const emailCandidate of emailCandidates) {
    for (const passwordCandidate of buildPasswordCandidates(creds.password)) {
      response = await page.context().request.post(loginUrl, {
        data: {
          user: emailCandidate,
          password: passwordCandidate,
          ...(lastClientSlug ? { clientSlug: lastClientSlug } : {}),
        },
      });
      if (response.ok()) break;
    }
    if (response?.ok()) break;
  }

  if (!response?.ok()) {
    const text = response ? await response.text() : "";
    throw new Error(`setMockUser login failed: ${response?.status()} ${response?.statusText()} ${text}`);
  }

  const setCookie = response.headers()["set-cookie"];
  const sessionId = parseCookie(setCookie, "session_id");
  const authToken = parseCookie(setCookie, "auth_token");
  const activeCompany = parseCookie(setCookie, "active_company_slug");
  if (!sessionId) {
    throw new Error("setMockUser login failed: missing session_id cookie");
  }
  const cookies: Array<{ name: string; value: string; url: string }> = [
    { name: "session_id", value: sessionId, url: baseURL },
  ];
  if (authToken) {
    cookies.push({ name: "auth_token", value: authToken, url: baseURL });
  }
  if (activeCompany) {
    cookies.push({ name: "active_company_slug", value: activeCompany, url: baseURL });
  }
  await page.context().addCookies(cookies);
}

async function getMockCookie(page: Page, cookieName: string) {
  const cookies = await page.context().cookies(baseURL);
  const match = cookies.find((cookie) => cookie.name === cookieName);
  return match?.value ?? null;
}

export async function login(page: Page, email: string, password: string) {
  const sessionId = await getMockCookie(page, "session_id");
  const creds = resolveCredentials(email, password);
  if (!sessionId) {
    const loginUrl = new URL("/api/auth/login", baseURL).toString();
    let response = null as Awaited<ReturnType<typeof page.context().request.post>> | null;
    for (const emailCandidate of emailCandidates) {
      for (const passwordCandidate of buildPasswordCandidates(creds.password)) {
        response = await page.context().request.post(loginUrl, {
          data: {
            user: emailCandidate,
            password: passwordCandidate,
            ...(lastClientSlug ? { clientSlug: lastClientSlug } : {}),
          },
        });
        if (response.ok()) break;
      }
      if (response?.ok()) break;
    }
    if (!response?.ok()) {
      const text = response ? await response.text() : "";
      throw new Error(`login failed: ${response?.status()} ${response?.statusText()} ${text}`);
    }

    const setCookie = response.headers()["set-cookie"];
    const newSessionId = parseCookie(setCookie, "session_id");
    const authToken = parseCookie(setCookie, "auth_token");
    const activeCompany = parseCookie(setCookie, "active_company_slug");
    if (!newSessionId) {
      throw new Error("login failed: missing session_id cookie");
    }
    const cookies: Array<{ name: string; value: string; url: string }> = [
      { name: "session_id", value: newSessionId, url: baseURL },
    ];
    if (authToken) {
      cookies.push({ name: "auth_token", value: authToken, url: baseURL });
    }
    if (activeCompany) {
      cookies.push({ name: "active_company_slug", value: activeCompany, url: baseURL });
    }
    await page.context().addCookies(cookies);
  }

  const role = (lastRole ?? creds.role) === "admin" ? "admin" : "user";
  const companySlug = lastClientSlug || "DEMO";
  const defaultPath = role === "admin" ? "/admin/clients" : `/empresas/${companySlug}/dashboard`;
  await page.goto(defaultPath, { timeout: 120000, waitUntil: "domcontentloaded" });
  const authLoading = page.getByText(/Validando sessao/i);
  if (await authLoading.isVisible().catch(() => false)) {
    await authLoading.waitFor({ state: "hidden", timeout: 15000 }).catch(() => {});
  }
}

