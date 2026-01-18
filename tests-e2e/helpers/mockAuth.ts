import type { BrowserContext } from "@playwright/test";

const rawBaseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
const baseURL = /^https?:\/\//i.test(rawBaseURL) ? rawBaseURL : `http://${rawBaseURL}`;

type MockAuthOptions = {
  role: "admin" | "company" | "user";
  companies?: string[];
  clientSlug?: string;
};

export async function mockAuth(
  context: BrowserContext,
  { role, companies = [], clientSlug }: MockAuthOptions
) {
  const cookies = [
    {
      name: "mock_role",
      value: role,
      url: baseURL,
    },
  ];

  if (companies.length > 0) {
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
}
