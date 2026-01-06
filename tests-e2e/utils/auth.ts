import type { Page } from "@playwright/test";

const rawBaseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
const baseURL = /^https?:\/\//i.test(rawBaseURL) ? rawBaseURL : `http://${rawBaseURL}`;
const adminUser = process.env.ADMIN_USER || "admin";

type MockRole = "admin" | "client" | "user";

export async function setMockUser(page: Page, role: MockRole, clientSlug?: string | null) {
  const cookies = [
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

export async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  const loginResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/auth/login") &&
      response.request().method() === "POST"
  );
  await page.getByRole("button", { name: /login/i }).click();
  const response = await loginResponse;
  if (!response.ok()) {
    throw new Error(`Login falhou: ${response.status()} ${response.url()}`);
  }
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}
