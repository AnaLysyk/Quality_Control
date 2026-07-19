import { test, expect, type APIRequestContext } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3100";
const useJsonSeed = process.env.E2E_USE_JSON === "1";
const sharedPassword = process.env.E2E_PROFILE_PASSWORD || "Demo@123";
const adminPassword = process.env.E2E_ADMIN_PASSWORD || sharedPassword;
const userPassword = process.env.E2E_USER_PASSWORD || sharedPassword;
const adminUser = {
  email: process.env.E2E_ADMIN_EMAIL || (useJsonSeed ? "e2e-leader-tc@testingcompany.local" : "admin@demo.test"),
  password: adminPassword,
  role: useJsonSeed ? "leader_tc" : "admin",
};
const normalUser = {
  email: process.env.E2E_USER_EMAIL || (useJsonSeed ? "e2e-user-tc@testingcompany.local" : "user@demo.test"),
  password: userPassword,
  role: useJsonSeed ? "testing_company_user" : "user",
};

function extrairCookie(setCookie: string | string[] | undefined, name: string): string | null {
  if (!setCookie) return null;
  const raw = Array.isArray(setCookie) ? setCookie.join(";") : setCookie;
  const match = raw.match(new RegExp(`${name}=([^;]+)`));
  return match?.[1] ?? null;
}

async function login(request: APIRequestContext, email: string, password: string) {
  const response = await request.post(`${baseURL}/api/auth/login`, {
    data: { user: email, password },
  });
  if (!response.ok()) {
    const text = await response.text();
    throw new Error(`login failed: ${response.status()} ${response.statusText()} ${text}`);
  }
  const headers = response.headers();
  const sessionId = extrairCookie(headers["set-cookie"], "session_id");
  const authToken = extrairCookie(headers["set-cookie"], "auth_token");
  expect(sessionId, "missing session_id cookie").toBeTruthy();
  return {
    sessionId: sessionId as string,
    authToken,
  };
}

test("auth: login admin and resolve /api/me from UserCompany", async ({ request }) => {
  const { sessionId, authToken } = await login(request, adminUser.email, adminUser.password);
  const headers: Record<string, string> = { cookie: `session_id=${sessionId}` };
  if (authToken) headers.authorization = `Bearer ${authToken}`;

  const me = await request.get(`${baseURL}/api/me`, { headers });
  expect(me.ok()).toBeTruthy();
  const body = await me.json();

  expect(body.user.email).toBe(adminUser.email);
  expect(body.user.role).toBe(adminUser.role);
  expect("clientSlug" in body.user).toBeTruthy();
  expect(Array.isArray(body.companies)).toBeTruthy();
  expect(body.companies.some((company: { slug?: string }) => typeof company.slug === "string" && company.slug.length > 0)).toBeTruthy();
});

test("auth: login user and resolve /api/me role= user", async ({ request }) => {
  const { sessionId, authToken } = await login(request, normalUser.email, normalUser.password);
  const headers: Record<string, string> = { cookie: `session_id=${sessionId}` };
  if (authToken) headers.authorization = `Bearer ${authToken}`;

  const me = await request.get(`${baseURL}/api/me`, { headers });
  expect(me.ok()).toBeTruthy();
  const body = await me.json();

  expect(body.user.email).toBe(normalUser.email);
  expect(body.user.role).toBe(normalUser.role);
  expect("clientSlug" in body.user).toBeTruthy();
});

test("auth: /api/me without session returns 401", async ({ request }) => {
  const me = await request.get(`${baseURL}/api/me`);
  const bodyText = await me.text();
  expect(me.status(), bodyText).toBe(401);
  const body = JSON.parse(bodyText);
  expect(body.error?.code).toBe("NO_SESSION");
});

