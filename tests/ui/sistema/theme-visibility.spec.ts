import { test, expect } from "../../../tools/fixtures/test";
import { autenticarUsuario, configurarUsuarioSimulado } from "../../../tools/functions/ui/apoio/autenticar-usuario-teste";

type Theme = "light" | "dark";

const themes: Theme[] = ["light", "dark"];

const publicRoutes = [
  "/",
  "/login",
  "/login/forgot-password",
  "/login/access-request",
  "/login/access-request/status",
];

const adminRoutes = [
  "/admin/dashboard",
  "/admin/runs",
  "/admin/defeitos",
  "/admin/requests",
];

const companySlug = "empresa-e2e";
const companyRoutes = [
  `/${companySlug}/dashboard`,
  `/${companySlug}/runs`,
  `/${companySlug}/defeitos`,
];

async function setThemeStorage(page: import("@playwright/test").Page, theme: Theme, userId?: string) {
  await page.addInitScript(
    ({ theme, userId }) => {
      const key = userId ? `tc-settings:${userId}` : "tc-settings:guest";
      const payload = JSON.stringify({ theme, language: "pt-BR" });
      sessionStorage.setItem(key, payload);
      if (userId) {
        sessionStorage.setItem("tc-settings:last-user-id", userId);
      }
    },
    { theme, userId }
  );
  await page.emulateMedia({ colorScheme: theme });
}

async function forceTheme(page: import("@playwright/test").Page, theme: Theme) {
  await page.evaluate((nextTheme) => {
    const root = document.documentElement;
    const useDark = nextTheme === "dark";
    root.classList.toggle("dark", useDark);
    root.style.colorScheme = useDark ? "dark" : "light";
  }, theme);
}

async function mockUserSettings(page: import("@playwright/test").Page, theme: Theme) {
  await page.route("**/api/user/settings", async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ settings: { theme, language: "pt-BR" } }),
    });
  });
}

async function assertThemeVisible(page: import("@playwright/test").Page, route: string, theme: Theme) {
  await page.waitForFunction(() => {
    const root = document.querySelector("main") ?? document.body;
    const text = root?.innerText?.trim() ?? "";
    return text.length > 0;
  });

  const result = await page.evaluate(() => {
    const root = document.querySelector("main") ?? document.body;
    const elements = Array.from(root.querySelectorAll<HTMLElement>("*"));
    const textElements = elements.filter((el) => {
      if (!el.textContent || !el.textContent.trim()) return false;
      const style = window.getComputedStyle(el);
      if (style.display === "none" || style.visibility !== "visible") return false;
      if (Number.parseFloat(style.opacity) < 0.15) return false;
      const rect = el.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return false;
      return true;
    });

    return {
      textCount: textElements.length,
      hasMain: Boolean(document.querySelector("main")),
    };
  });

  expect(result.textCount, `Sem texto visível em ${route} (${theme})`).toBeGreaterThan(0);
}

test.describe("theme visibility - public", () => {
  test.describe.configure({ timeout: 180000 });

  for (const theme of themes) {
    test(`public routes @ ${theme}`, async ({ page }) => {
      await setThemeStorage(page, theme);
      for (const route of publicRoutes) {
        await page.goto(route, { waitUntil: "domcontentloaded" });
        await forceTheme(page, theme);
        await assertThemeVisible(page, route, theme);
      }
    });
  }
});

test.describe("theme visibility - admin", () => {
  test.describe.configure({ timeout: 180000 });

  for (const theme of themes) {
    test(`admin routes @ ${theme}`, async ({ page }) => {
      await setThemeStorage(page, theme, "usr_admin_empresa_e2e_test");
      await mockUserSettings(page, theme);
      await configurarUsuarioSimulado(page, "admin");
      await autenticarUsuario(page, "admin@example.com", "senha");

      for (const route of adminRoutes) {
        await page.goto(route, { waitUntil: "domcontentloaded" });
        await forceTheme(page, theme);
        await assertThemeVisible(page, route, theme);
      }
    });
  }
});

test.describe("theme visibility - company", () => {
  test.describe.configure({ timeout: 180000 });

  for (const theme of themes) {
    test(`company routes @ ${theme}`, async ({ page }) => {
      await setThemeStorage(page, theme, "usr_user_empresa_e2e_test");
      await mockUserSettings(page, theme);
      await configurarUsuarioSimulado(page, "user", companySlug);
      await autenticarUsuario(page, "user@example.com", "senha");

      for (const route of companyRoutes) {
        await page.goto(route, { waitUntil: "domcontentloaded" });
        await forceTheme(page, theme);
        await assertThemeVisible(page, route, theme);
      }
    });
  }
});

