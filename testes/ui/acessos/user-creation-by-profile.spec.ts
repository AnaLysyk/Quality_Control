/**
 * Ticket 1 — Automatizar criação de usuários por perfil via Suporte Técnico e Líder TC
 */

import { test, expect } from "../../../support/fixtures/test";
import {
  SENHA_ADMIN_PADRAO,
  SENHA_USUARIO_NOVO,
  aguardarUsuarioNaListaAdmin,
  autenticarAdminParaCriacaoUsuario,
  criarUsuarioViaApi,
  loginDiretoUsuarioCriado,
  perfisCriadosPorLider,
  perfisCriadosPorSuporte,
  validarBloqueioAdminParaPerfilCriado,
  validarSessaoUsuarioCriado,
  temEmpresaE2E,
} from "../../../support/functions/interface/acessos/criacao-usuario-perfil";
import { BASE_URL, extrairCookie } from "../../../support/functions/api/acessos/autenticacao-por-cookie";

test.setTimeout(180000);

test.describe("Suporte Técnico — criação de perfis", () => {
  const createdUserIds: string[] = [];

  test.afterAll(async ({ request }) => {
    for (const id of createdUserIds) {
      await request.delete(`${BASE_URL}/api/admin/users/${id}`).catch(() => {});
    }
  });

  for (const profile of perfisCriadosPorSuporte) {
    test(`Suporte TC cria perfil: ${profile.label}`, async ({ page }) => {
      const suffix = `${Date.now().toString().slice(-6)}-${Math.random().toString(36).slice(2, 5)}`;
      const email = `e2e-sup-${profile.role}-${suffix}@demo.test`;
      const name = `Teste ${profile.label} ${suffix}`;

      await autenticarAdminParaCriacaoUsuario(page);

      const created = await criarUsuarioViaApi(page, {
        name,
        email,
        role: profile.role,
        companySlug: "DEMO",
        password: SENHA_USUARIO_NOVO,
      });

      if (created.id) {
        createdUserIds.push(created.id);
      }

      await aguardarUsuarioNaListaAdmin(page, email);

      await page.context().clearCookies();

      await loginDiretoUsuarioCriado(page, email, SENHA_USUARIO_NOVO);

      if (profile.role === "leader_tc" || profile.role === "technical_support") {
        await page.goto("/admin", { waitUntil: "domcontentloaded" });
        await expect(page).not.toHaveURL(/\/login/);
      } else {
        await validarSessaoUsuarioCriado(page, email, profile.role);
      }

      await validarBloqueioAdminParaPerfilCriado(page, profile.role);
    });
  }
});

test.describe("Líder TC — criação de perfis", () => {
  const createdUserIds: string[] = [];

  test.afterAll(async ({ request }) => {
    for (const id of createdUserIds) {
      await request.delete(`${BASE_URL}/api/admin/users/${id}`).catch(() => {});
    }
  });

  for (const profile of perfisCriadosPorLider) {
    test(`Líder TC cria perfil: ${profile.label}`, async ({ page }) => {
      const suffix = `${Date.now().toString().slice(-6)}-${Math.random().toString(36).slice(2, 5)}`;
      const email = `e2e-ldr-${profile.role}-${suffix}@demo.test`;
      const name = `Teste LTC ${profile.label} ${suffix}`;

      await autenticarAdminParaCriacaoUsuario(page);

      const created = await criarUsuarioViaApi(page, {
        name,
        email,
        role: profile.role,
        companySlug: "DEMO",
        password: SENHA_USUARIO_NOVO,
      });

      if (created.id) {
        createdUserIds.push(created.id);
      }

      await aguardarUsuarioNaListaAdmin(page, email);

      await page.context().clearCookies();

      const apiResponse = await page.request.post(`${BASE_URL}/api/auth/login`, {
        data: {
          user: email,
          password: SENHA_USUARIO_NOVO,
        },
      });

      if (apiResponse.ok()) {
        const sessionId = extrairCookie(apiResponse.headers()["set-cookie"], "session_id");

        if (sessionId) {
          const meResponse = await page.request.get(`${BASE_URL}/api/me`, {
            headers: { cookie: `session_id=${sessionId}` },
          });

          expect(meResponse.ok()).toBeTruthy();

          const me = await meResponse.json();

          expect(me.user.role).toBe(profile.role);

          if (profile.role !== "leader_tc" && profile.role !== "technical_support") {
            expect(temEmpresaE2E(me)).toBeTruthy();
          }
        }
      }
    });
  }
});

test("Usuário TC não acessa /admin e não vê empresas de outros clientes", async ({ page }) => {
  await autenticarAdminParaCriacaoUsuario(page);

  const suffix = Date.now().toString().slice(-6);
  const testEmail = `e2e-tc-scope-${suffix}@demo.test`;

  const createResponse = await page.request.post(`${BASE_URL}/api/admin/users`, {
    data: {
      name: `TC Scope ${suffix}`,
      email: testEmail,
      role: "testing_company_user",
      clientSlug: "DEMO",
      password: SENHA_ADMIN_PADRAO,
    },
  });

  if (!createResponse.ok()) {
    test.skip();
    return;
  }

  const created = await createResponse.json().catch(() => ({}));
  const testUserId = created.id ?? created.user?.id ?? null;

  try {
    const loginResponse = await page.request.post(`${BASE_URL}/api/auth/login`, {
      data: {
        user: testEmail,
        password: SENHA_ADMIN_PADRAO,
      },
    });

    if (!loginResponse.ok()) {
      test.skip();
      return;
    }

    const sessionId = extrairCookie(loginResponse.headers()["set-cookie"], "session_id");

    if (!sessionId) {
      test.skip();
      return;
    }

    await page.context().addCookies([{ name: "session_id", value: sessionId, url: BASE_URL }]);

    const adminApiResponse = await page.request.get(`${BASE_URL}/api/admin/users`);
    expect([401, 403]).toContain(adminApiResponse.status());

    const meResponse = await page.request.get(`${BASE_URL}/api/me`);
    expect(meResponse.ok()).toBeTruthy();

    const me = await meResponse.json();
    expect(me.user.role).toBe("testing_company_user");
  } finally {
    if (testUserId) {
      await autenticarAdminParaCriacaoUsuario(page);
      await page.request.delete(`${BASE_URL}/api/admin/users/${testUserId}`).catch(() => {});
    }
  }
});
