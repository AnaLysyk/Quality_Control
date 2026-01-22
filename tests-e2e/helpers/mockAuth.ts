import type { BrowserContext } from "@playwright/test";

const rawBaseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
const baseURL = /^https?:\/\//i.test(rawBaseURL) ? rawBaseURL : `http://${rawBaseURL}`;
const adminUser = process.env.ADMIN_USER || "admin";

export type MockAuthOptions = {
  role: "admin" | "company" | "client" | "user";
  companies?: string[];
  clientSlug?: string;
};

export async function mockAuth(context: BrowserContext, options: MockAuthOptions) {
  const { role, companies = [], clientSlug } = options;
  const hasCompaniesProp = Object.prototype.hasOwnProperty.call(options, "companies");
  const cookies: { name: string; value: string; url: string }[] = [
    {
      name: "mock_role",
      value: role,
      url: baseURL,
    },
    {
      name: "auth",
      value: role === "admin" ? adminUser : "",
      url: baseURL,
    },
  ];

  if (hasCompaniesProp) {
    cookies.push({
      name: "mock_companies",
      value: companies.join(","),
      url: baseURL,
    });
  }

  if (clientSlug) {
    cookies.push({
      name: "mock_client_slug",
      value: clientSlug,
      url: baseURL,
    });
  }

  await context.addCookies(cookies);

  const loginEmail = role === "admin" ? "admin@example.com" : "user@example.com";
  const loginUrl = new URL("/api/auth/login", baseURL).toString();
  const response = await context.request.post(loginUrl, {
    data: {
      email: loginEmail,
      password: "senha",
    },
  });

  if (!response.ok()) {
    throw new Error(`mockAuth login failed: ${response.status()} ${response.statusText()}`);
  }

  const setCookie = response.headers()["set-cookie"];
  const match = typeof setCookie === "string" ? setCookie.match(/session_id=([^;]+)/) : null;
  if (!match?.[1]) {
    throw new Error("mockAuth login failed: missing session_id cookie");
  }
  await context.addCookies([{ name: "session_id", value: match[1], url: baseURL }]);
}
