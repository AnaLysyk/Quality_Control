import { test, expect } from "./fixtures/test";
import type { Page } from "@playwright/test";
import { login, setMockUser } from "./utils/auth";

type Viewport = { width: number; height: number; label: string };

const viewports: Viewport[] = [
  { width: 360, height: 740, label: "mobile" },
  { width: 768, height: 1024, label: "tablet" },
  { width: 1280, height: 800, label: "desktop" },
];

const publicRoutes = [
  "/",
  "/login",
  "/dashboard",
  "/dashboard/apps",
  "/painel",
  "/release",
  "/release/release_1_teste_painel_qa_ace",
  "/applications",
  "/applications/smart",
  "/defects",
  "/run/1",
];

const adminRoutes = [
  "/admin/dashboard",
  "/admin/clients",
  "/admin/runs",
  "/admin/test-metric",
  "/admin/defeitos",
  "/admin/requests",
  "/admin/users",
  "/admin/support",
  "/admin/releases",
  "/clients",
  "/clientes",
  "/settings",
  "/settings/profile",
];

const companyRoutes = [
  "/empresas/griaule/dashboard",
  "/empresas/griaule/runs",
  "/empresas/griaule/releases",
  "/empresas/griaule/defeitos",
  "/empresas/griaule/planos-de-teste",
  "/empresas/griaule/aplicacoes",
];

async function assertNoHorizontalOverflow(page: Page, route: string) {
  await page.goto(route, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(250);

  const sizes = await page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    return {
      docScrollWidth: doc?.scrollWidth ?? 0,
      docClientWidth: doc?.clientWidth ?? 0,
      bodyScrollWidth: body?.scrollWidth ?? 0,
      bodyClientWidth: body?.clientWidth ?? 0,
    };
  });

  const scrollWidth = Math.max(sizes.docScrollWidth, sizes.bodyScrollWidth);
  const clientWidth = Math.max(sizes.docClientWidth, sizes.bodyClientWidth);

  expect(
    scrollWidth,
    `Horizontal overflow on ${route} (scrollWidth=${scrollWidth}, clientWidth=${clientWidth})`
  ).toBeLessThanOrEqual(clientWidth + 2);
}

test.describe("responsive layout audit - public", () => {
  test.describe.configure({ timeout: 120000 });
  for (const viewport of viewports) {
    test(`public routes @ ${viewport.label}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      for (const route of publicRoutes) {
        await assertNoHorizontalOverflow(page, route);
      }
    });
  }
});

test.describe("responsive layout audit - admin", () => {
  test.describe.configure({ timeout: 120000 });
  for (const viewport of viewports) {
    test(`admin routes @ ${viewport.label}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await setMockUser(page, "admin");
      await login(page, "admin@example.com", "senha");

      for (const route of adminRoutes) {
        await assertNoHorizontalOverflow(page, route);
      }
    });
  }
});

test.describe("responsive layout audit - company", () => {
  test.describe.configure({ timeout: 120000 });
  for (const viewport of viewports) {
    test(`company routes @ ${viewport.label}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await setMockUser(page, "admin", "griaule");
      await login(page, "admin@example.com", "senha");

      for (const route of companyRoutes) {
        await assertNoHorizontalOverflow(page, route);
      }
    });
  }
});
