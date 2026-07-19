import fs from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";

type ScreenTarget = {
  fileName: string;
  route: string;
};

const baseUrl = (process.env.E2E_BASE_URL || process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3100").replace(/\/$/, "");
const leaderEmail = process.env.E2E_LEADER_EMAIL || process.env.E2E_ADMIN_EMAIL || "e2e-leader-tc@testingcompany.local";
const leaderPassword = process.env.E2E_LEADER_PASSWORD || process.env.E2E_ADMIN_PASSWORD || process.env.E2E_PROFILE_PASSWORD || "";
const companySlug = process.env.E2E_DOCUMENTATION_COMPANY_SLUG || "testing-company";
const outputDir = path.join(process.cwd(), "test-results", "documentation-quality-control");
const publicOutputDir = path.join(process.cwd(), "public", "docs", "quality-control", "screenshots");

const targets: ScreenTarget[] = [
  { fileName: "home-lider-tc.png", route: "/admin/home" },
  { fileName: "documentacao.png", route: `/empresas/${companySlug}/docs` },
  { fileName: "documentos.png", route: `/empresas/${companySlug}/documentos` },
  { fileName: "usuarios-listagem.png", route: "/admin/users" },
  { fileName: "chat.png", route: "/chat" },
  { fileName: "suporte-kanban.png", route: "/kanban-it" },
  { fileName: "brain.png", route: "/brain" },
  { fileName: "agenda.png", route: "/agenda" },
];

async function loginWithLeader(page: import("@playwright/test").Page) {
  const response = await page.context().request.post(`${baseUrl}/api/auth/login`, {
    data: {
      user: leaderEmail,
      password: leaderPassword,
      clientSlug: companySlug,
    },
  });

  expect(response.ok(), await response.text()).toBeTruthy();
  await page.context().addCookies([
    {
      name: "active_company_slug",
      value: companySlug,
      url: baseUrl,
    },
  ]);
}

test("captures the main documentation screenshots when environment is configured", async ({ page }) => {
  test.skip(
    !leaderEmail || !leaderPassword,
    "Configure E2E_LEADER_EMAIL e E2E_LEADER_PASSWORD para capturar evidencias reais.",
  );

  await fs.mkdir(outputDir, { recursive: true });
  await fs.mkdir(publicOutputDir, { recursive: true });
  await loginWithLeader(page);

  const manifest: Array<{ route: string; fileName: string; ok: boolean; finalUrl: string; error?: string }> = [];

  for (const target of targets) {
    try {
      await page.goto(`${baseUrl}${target.route}`, { waitUntil: "networkidle" });
      const screenshot = await page.screenshot({ fullPage: true });
      await fs.writeFile(path.join(outputDir, target.fileName), screenshot);
      await fs.writeFile(path.join(publicOutputDir, target.fileName), screenshot);
      manifest.push({
        route: target.route,
        fileName: target.fileName,
        ok: true,
        finalUrl: page.url(),
      });
    } catch (error) {
      manifest.push({
        route: target.route,
        fileName: target.fileName,
        ok: false,
        finalUrl: page.url(),
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  await fs.writeFile(
    path.join(outputDir, "screenshots-manifest.json"),
    JSON.stringify({ baseUrl, companySlug, capturedAt: new Date().toISOString(), items: manifest }, null, 2),
    "utf8",
  );
  await fs.writeFile(
    path.join(publicOutputDir, "screenshots-manifest.json"),
    JSON.stringify({ baseUrl, companySlug, capturedAt: new Date().toISOString(), items: manifest }, null, 2),
    "utf8",
  );

  expect(manifest.some((item) => item.ok)).toBe(true);
});
