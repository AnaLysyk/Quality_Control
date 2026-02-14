import type { Page } from "@playwright/test";

const rawBaseURL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3100";
const baseURL = /^https?:\/\//i.test(rawBaseURL) ? rawBaseURL : `http://${rawBaseURL}`;

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || "admin@griaule.test";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || "Griaule@123";
const USER_EMAIL = process.env.E2E_USER_EMAIL || "user@griaule.test";
const USER_PASSWORD = process.env.E2E_USER_PASSWORD || "Griaule@123";

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

  const loginUrl = new URL("/api/auth/login", baseURL).toString();
  const response = await page.context().request.post(loginUrl, {
    data: {
      user: creds.email,
      password: creds.password,
      ...(lastClientSlug ? { clientSlug: lastClientSlug } : {}),
    },
  });

  if (!response.ok()) {
    const text = await response.text();
    throw new Error(`setMockUser login failed: ${response.status()} ${response.statusText()} ${text}`);
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
    const response = await page.context().request.post(loginUrl, {
      data: {
        user: creds.email,
        password: creds.password,
        ...(lastClientSlug ? { clientSlug: lastClientSlug } : {}),
      },
    });
    if (!response.ok()) {
      const text = await response.text();
      throw new Error(`login failed: ${response.status()} ${response.statusText()} ${text}`);
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
  const companySlug = lastClientSlug || "griaule";
  const defaultPath = role === "admin" ? "/admin/clients" : `/empresas/${companySlug}/dashboard`;
  await page.goto(defaultPath, { timeout: 120000, waitUntil: "domcontentloaded" });
  const authLoading = page.getByText(/Validando sessao/i);
  if (await authLoading.isVisible().catch(() => false)) {
    await authLoading.waitFor({ state: "hidden", timeout: 15000 }).catch(() => {});
  }
}
