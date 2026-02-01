import type { BrowserContext } from "@playwright/test";

const rawBaseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
const baseURL = /^https?:\/\//i.test(rawBaseURL) ? rawBaseURL : `http://${rawBaseURL}`;
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || "admin@griaule.test";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || "Griaule@123";
const USER_EMAIL = process.env.E2E_USER_EMAIL || "user@griaule.test";
const USER_PASSWORD = process.env.E2E_USER_PASSWORD || "Griaule@123";

export type MockAuthOptions = {
  role: "admin" | "company" | "client" | "user";
  companies?: string[];
  clientSlug?: string;
};

export async function mockAuth(context: BrowserContext, options: MockAuthOptions) {
  const { role } = options;
  const loginEmail = role === "admin" ? ADMIN_EMAIL : USER_EMAIL;
  const loginPassword = role === "admin" ? ADMIN_PASSWORD : USER_PASSWORD;
  const loginUrl = new URL("/api/auth/login", baseURL).toString();
  const response = await context.request.post(loginUrl, {
    data: {
      email: loginEmail,
      password: loginPassword,
    },
  });

  if (!response.ok()) {
    throw new Error(`mockAuth login failed: ${response.status()} ${response.statusText()}`);
  }

  const setCookie = response.headers()["set-cookie"];
  const raw = Array.isArray(setCookie) ? setCookie.join(";") : setCookie;
  const sessionMatch = raw?.match(/session_id=([^;]+)/);
  const authMatch = raw?.match(/auth_token=([^;]+)/);
  if (!sessionMatch?.[1]) {
    throw new Error("mockAuth login failed: missing session_id cookie");
  }
  const cookies = [{ name: "session_id", value: sessionMatch[1], url: baseURL }];
  if (authMatch?.[1]) {
    cookies.push({ name: "auth_token", value: authMatch[1], url: baseURL });
  }
  await context.addCookies(cookies);
}
