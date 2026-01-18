import type { BrowserContext } from "@playwright/test";

export async function mockAuth(context: BrowserContext, opts: { role: "admin" | "client" | "user"; companies?: string[] }) {
  await context.addCookies([
    { name: "mock_role", value: opts.role, url: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000" },
    { name: "auth", value: opts.role === "admin" ? "admin" : "", url: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000" },
    { name: "mock_companies", value: (opts.companies || []).join(","), url: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000" },
  ]);
}
