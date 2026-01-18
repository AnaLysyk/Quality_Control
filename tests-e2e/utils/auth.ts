import type { Page } from "@playwright/test";

const rawBaseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
const baseURL = /^https?:\/\//i.test(rawBaseURL) ? rawBaseURL : `http://${rawBaseURL}`;
const adminUser = process.env.ADMIN_USER || "admin";

type MockRole = "admin" | "client" | "user";

export async function setMockUser(page: Page, role: MockRole, clientSlug?: string | null) {
  const cookies: Array<{ name: string; value: string; url: string }> = [
    { name: "mock_role", value: role, url: baseURL },
  ];

  if (role === "admin") {
    cookies.push({ name: "auth", value: adminUser, url: baseURL });
  } else {
    cookies.push({ name: "auth", value: "", url: baseURL });
  }

  if (typeof clientSlug !== "undefined") {
    cookies.push({
      name: "mock_client_slug",
      value: clientSlug ?? "",
      url: baseURL,
    });
  }

  await page.context().addCookies(cookies);
}

async function getMockCookie(page: Page, cookieName: string) {
  const cookies = await page.context().cookies(baseURL);
  const match = cookies.find((cookie) => cookie.name === cookieName);
  return match?.value ?? null;
}

export async function login(page: Page, email: string, _password: string) {
  await page.goto("/login", { timeout: 120000, waitUntil: "load" });
  const role = (await getMockCookie(page, "mock_role")) ?? "admin";
  const slug = (await getMockCookie(page, "mock_client_slug")) ?? "griaule";
  const companySlug = slug || "griaule";
  const defaultPath =
    role === "admin"
      ? "/admin/clients"
      : `/empresas/${companySlug}/dashboard`;
  await page.goto(defaultPath, { timeout: 120000, waitUntil: "networkidle" });
}
