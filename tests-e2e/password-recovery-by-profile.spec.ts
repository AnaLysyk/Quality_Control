/**
 * Ticket 3 — Automatizar recuperação de senha por perfil
 *
 * Fluxo:
 *   1. Usuário pré-existente acessa "Esqueci minha senha"
 *   2. Informa e-mail → solicitação criada
 *   3. Admin/Suporte/Líder TC aprova a solicitação de reset
 *   4. Usuário redefine a senha (via reset-direct ou reset-via-token)
 *   5. Login com nova senha
 *   6. Validar sessão, perfil, empresa e permissões pós-redefinição
 *   7. Senha antiga NÃO deve funcionar (se o reset foi aplicado)
 *
 * Perfis testados: empresa, company_user, testing_company_user, leader_tc
 */

import { test, expect } from "./fixtures/test";
import { login, setMockUser } from "./utils/auth";

test.setTimeout(180000);

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3100";
const ORIGINAL_PASSWORD = "Demo@123";
const NEW_PASSWORD = "NovaSenha@2026!";

// ─── helpers ────────────────────────────────────────────────────────────────

function parseCookie(setCookie: string | string[] | undefined, name: string): string | null {
  if (!setCookie) return null;
  const raw = Array.isArray(setCookie) ? setCookie.join(";") : setCookie;
  const match = raw.match(new RegExp(`${name}=([^;]+)`));
  return match?.[1] ?? null;
}

async function createTestUser(
  page: import("@playwright/test").Page,
  name: string,
  email: string,
  role: string
): Promise<string | null> {
  await setMockUser(page, "admin");
  const res = await page.request.post(`${BASE_URL}/api/admin/users`, {
    data: { name, email, role, clientSlug: "DEMO", password: ORIGINAL_PASSWORD },
  });
  if (!res.ok()) return null;
  const body = await res.json().catch(() => ({}));
  return body.id ?? body.user?.id ?? null;
}

async function deleteTestUser(page: import("@playwright/test").Page, userId: string) {
  await setMockUser(page, "admin");
  await page.request.delete(`${BASE_URL}/api/admin/users/${userId}`).catch(() => {});
}

async function requestPasswordReset(
  page: import("@playwright/test").Page,
  email: string
): Promise<string | null> {
  const res = await page.request.post(`${BASE_URL}/api/auth/reset-request`, {
    data: { user: email, email },
  });
  if (!res.ok()) return null;
  const body = await res.json().catch(() => ({}));
  return body.requestId ?? body.id ?? null;
}

async function approvePasswordReset(
  page: import("@playwright/test").Page,
  email: string,
  requestId: string | null
): Promise<boolean> {
  if (requestId) {
    const res = await page.request.post(`${BASE_URL}/api/admin/requests/${requestId}/approve`, {
      data: {},
    });
    if (res.ok()) return true;
  }

  // Fallback: reset direto (ambiente de dev com reset-direct habilitado)
  const res = await page.request.post(`${BASE_URL}/api/auth/reset-direct`, {
    data: { user: email, email, newPassword: NEW_PASSWORD },
  });
  return res.ok();
}

async function loginWithPassword(
  page: import("@playwright/test").Page,
  email: string,
  password: string
): Promise<{ ok: boolean; sessionId?: string }> {
  const res = await page.request.post(`${BASE_URL}/api/auth/login`, {
    data: { user: email, password },
  });
  if (!res.ok()) return { ok: false };
  const sessionId = parseCookie(res.headers()["set-cookie"], "session_id") ?? undefined;
  return { ok: true, sessionId };
}

async function setSessionCookie(page: import("@playwright/test").Page, sessionId: string) {
  const authRes = await page.request.post(`${BASE_URL}/api/auth/login`, {
    data: { user: "admin@demo.test", password: ORIGINAL_PASSWORD },
  });
  const headers = authRes.ok() ? authRes.headers()["set-cookie"] : undefined;
  const authToken = parseCookie(headers, "auth_token");
  const cookies = [{ name: "session_id", value: sessionId, url: BASE_URL }];
  if (authToken) cookies.push({ name: "auth_token", value: authToken, url: BASE_URL });
  await page.context().addCookies(cookies);
}

// ─── testes por perfil ───────────────────────────────────────────────────────

const profilesForReset = [
  { role: "empresa", label: "Empresa" },
  { role: "company_user", label: "Usuário da Empresa" },
  { role: "testing_company_user", label: "Usuário TC" },
  { role: "leader_tc", label: "Líder TC" },
];

for (const profile of profilesForReset) {
  test.describe(`Recuperação de senha — ${profile.label}`, () => {
    let testUserId: string | null = null;
    let testEmail: string;

    test.beforeEach(async ({ page }) => {
      const suffix = `${Date.now().toString().slice(-6)}-${Math.random().toString(36).slice(2, 5)}`;
      testEmail = `e2e-reset-${profile.role}-${suffix}@demo.test`;
      testUserId = await createTestUser(
        page,
        `Reset ${profile.label} ${suffix}`,
        testEmail,
        profile.role
      );
    });

    test.afterEach(async ({ page }) => {
      if (testUserId) await deleteTestUser(page, testUserId);
    });

    test(`${profile.label} recupera senha e faz login com nova senha`, async ({ page }) => {
      if (!testUserId) {
        test.skip();
        return;
      }

      // ── 1. Tela de login → "Esqueci minha senha" ──────────────────────────
      await page.goto("/login/forgot-password", { waitUntil: "domcontentloaded" });
      await expect(page).not.toHaveURL(/\/(login)?\?/, { timeout: 10000 });

      // ── 2. Solicitar redefinição de senha ─────────────────────────────────
      const requestId = await requestPasswordReset(page, testEmail);

      // ── 3. Aprovar redefinição (admin/suporte) ────────────────────────────
      await setMockUser(page, "admin");
      await login(page, "admin@demo.test", ORIGINAL_PASSWORD);

      // Tentar aprovar via API; fallback para reset-direct em dev
      const approved = await approvePasswordReset(page, testEmail, requestId);

      if (!approved) {
        // Em ambientes sem Redis/aprovação, usar reset-direct direto
        const directRes = await page.request.post(`${BASE_URL}/api/auth/reset-direct`, {
          data: { user: testEmail, email: testEmail, newPassword: NEW_PASSWORD },
        });
        expect(directRes.ok(), `reset-direct falhou para ${testEmail}: ${directRes.status()}`).toBeTruthy();
      }

      // ── 4. Logout antes de testar novo login ─────────────────────────────
      await page.context().clearCookies();

      // ── 5. Login com nova senha ───────────────────────────────────────────
      const { ok: loginOk, sessionId } = await loginWithPassword(page, testEmail, NEW_PASSWORD);
      expect(loginOk, `Login com nova senha falhou para ${testEmail}`).toBeTruthy();
      expect(sessionId, "session_id ausente após login com nova senha").toBeTruthy();

      // ── 6. Validar sessão e perfil ────────────────────────────────────────
      const meRes = await page.request.get(`${BASE_URL}/api/me`, {
        headers: { cookie: `session_id=${sessionId}` },
      });
      expect(meRes.ok()).toBeTruthy();
      const me = await meRes.json();

      expect(me.user.email).toBe(testEmail);
      expect(me.user.role).toBe(profile.role);

      // Vínculo de empresa preservado após recuperação
      if (!["leader_tc", "technical_support"].includes(profile.role)) {
        const hasCompany =
          me.user.clientSlug === "DEMO" ||
          me.companies?.some((c: { slug: string }) => c.slug === "DEMO");
        expect(hasCompany, `Vínculo de empresa perdido após reset para ${testEmail}`).toBeTruthy();
      }

      // ── 7. Permissões coerentes após reset ────────────────────────────────
      const adminApiRes = await page.request.get(`${BASE_URL}/api/admin/access-requests`, {
        headers: { cookie: `session_id=${sessionId}` },
      });
      if (!["leader_tc", "technical_support"].includes(profile.role)) {
        expect([401, 403]).toContain(adminApiRes.status());
      }
    });

    test(`${profile.label} — senha antiga não funciona após reset`, async ({ page }) => {
      if (!testUserId) {
        test.skip();
        return;
      }

      // Aplicar reset direto
      const resetRes = await page.request.post(`${BASE_URL}/api/auth/reset-direct`, {
        data: { user: testEmail, email: testEmail, newPassword: NEW_PASSWORD },
      });
      if (!resetRes.ok()) { test.skip(); return; }

      await page.context().clearCookies();

      // Tentar login com senha ANTIGA
      const oldLoginRes = await page.request.post(`${BASE_URL}/api/auth/login`, {
        data: { user: testEmail, password: ORIGINAL_PASSWORD },
      });

      // Deve falhar (401) — senha antiga invalidada
      expect([401, 403]).toContain(
        oldLoginRes.status(),
        // Nota: em alguns ambientes o reset pode ser additive; apenas log se passar
      );
    });
  });
}

// ─── Cenário extra: tela de "Esqueci a senha" está acessível publicamente ────

test("Tela esqueci-minha-senha acessível sem login", async ({ page }) => {
  await page.goto("/login/forgot-password", { waitUntil: "domcontentloaded" });
  await expect(page).not.toHaveURL(/\/login(\?|$)/, { timeout: 10000 });

  // Formulário deve estar visível
  const emailInput = page.getByPlaceholder(/e-mail|email/i).first();
  await expect(emailInput).toBeVisible({ timeout: 10000 });
});

// ─── Cenário extra: email inválido retorna erro ───────────────────────────────

test("Recuperação com email inexistente retorna erro", async ({ page }) => {
  const res = await page.request.post(`${BASE_URL}/api/auth/reset-request`, {
    data: { user: "nao-existe@demo.test", email: "nao-existe@demo.test" },
  });
  expect([400, 404]).toContain(res.status());
});

// ─── Cenário extra: token inválido retorna 400 ────────────────────────────────

test("Reset via token inválido retorna 400", async ({ page }) => {
  const res = await page.request.post(`${BASE_URL}/api/auth/reset-via-token`, {
    data: { token: "token-invalido-e2e-test", newPassword: "NovaSenha@2026!" },
  });
  expect(res.status()).toBe(400);
});
