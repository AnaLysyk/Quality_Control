import { test, expect } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3100";
const adminUser = {
  email: "admin@griaule.test",
  password: "Griaule@123",
  role: "admin",
};
const normalUser = {
  email: "user@griaule.test",
  password: "Griaule@123",
  role: "user",
};

function parseCookie(setCookie: string | string[] | undefined, name: string): string | null {
  if (!setCookie) return null;
  const raw = Array.isArray(setCookie) ? setCookie.join(";") : setCookie;
  const match = raw.match(new RegExp(`${name}=([^;]+)`));
  return match?.[1] ?? null;
}

async function login(request: typeof test["request"], email: string, password: string) {
  const response = await request.post(`${baseURL}/api/auth/login`, {
    data: { user: email, password },
  });
  if (!response.ok()) {
    const text = await response.text();
    throw new Error(`login failed: ${response.status()} ${response.statusText()} ${text}`);
  }
  const headers = response.headers();
  const sessionId = parseCookie(headers["set-cookie"], "session_id");
  const authToken = parseCookie(headers["set-cookie"], "auth_token");
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
  expect(body.user.clientSlug).toBe("griaule");
  expect(Array.isArray(body.companies)).toBeTruthy();
  expect(body.companies.find((company: { slug: string }) => company.slug === "griaule")).toBeTruthy();
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
  expect(body.user.clientSlug).toBe("griaule");
});

test("auth: /api/me without session returns 401", async ({ request }) => {
  const me = await request.get(`${baseURL}/api/me`);
  const bodyText = await me.text();
  expect(me.status(), bodyText).toBe(401);
  const body = JSON.parse(bodyText);
  expect(body.error?.code).toBe("NO_SESSION");
});
