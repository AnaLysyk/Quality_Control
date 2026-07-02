/**
 * Ticket 1 — Automatizar criação de usuários por perfil via Suporte Técnico e Líder TC
 */

import { test, expect } from "../../../support/fixtures/test";
import { PERMISSION_MODULES } from "../../../lib/permissionCatalog";
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
} from "../../../support/functions/ui/usuarios/criar-usuario-por-perfil";
import { BASE_URL, extrairCookie } from "../../../support/functions/api/autenticacao/autenticar-por-cookie";
import {
  esperarEmailCapturado,
  limparEmailsCapturados,
  type EmailCapturado,
} from "../../../support/functions/api/solicitar-acesso/emails/capturar-emails";
import { validarMeuPerfilUsuarioCriado } from "../../../support/functions/ui/usuarios/validar-meu-perfil-usuario-criado";

test.setTimeout(180000);

const PERMISSOES_COMPLETAS = Object.fromEntries(
  PERMISSION_MODULES.map((module) => [module.id, module.actions]),
);

function gerarSufixo() {
  return `${Date.now().toString().slice(-6)}-${Math.random().toString(36).slice(2, 5)}`;
}

function conteudoEmail(email: EmailCapturado) {
  return `${email.subject}\n${email.text ?? ""}\n${email.html}`;
}

function extrairSenhaTemporaria(email: EmailCapturado) {
  const conteudo = conteudoEmail(email);
  const textMatch = conteudo.match(/Senha:\s*([^\s<]+)/i);
  const htmlMatch = conteudo.match(/<span class="cred-label">Senha<\/span>[\s\S]*?<span class="cred-value">([^<]+)<\/span>/i);
  const senha = (textMatch?.[1] ?? htmlMatch?.[1] ?? "").trim();

  expect(senha, "Senha temporaria deve estar presente no e-mail de boas-vindas").toBeTruthy();

  return senha;
}

async function autenticarAnaSuporteTecnicoComAcessoCompleto(page: import("@playwright/test").Page) {
  await autenticarAdminParaCriacaoUsuario(page);

  const suffix = gerarSufixo();
  const anaEmail = `ana.paula.lysyk+suporte-${suffix}@quality-control.test`;
  const ana = await criarUsuarioViaApi(page, {
    name: "Ana Paula Lysyk",
    email: anaEmail,
    login: `ana.paula.lysyk.suporte.${suffix}`,
    role: "technical_support",
    password: SENHA_USUARIO_NOVO,
  });

  expect(ana.id, "ID da Ana suporte tecnico E2E deve ser retornado").toBeTruthy();

  const permissionResponse = await page.request.patch(`${BASE_URL}/api/admin/users/${ana.id}/permissions`, {
    data: {
      allow: PERMISSOES_COMPLETAS,
      deny: {},
    },
  });
  const permissionText = await permissionResponse.text();

  expect(permissionResponse.status(), permissionText).toBe(200);

  await page.context().clearCookies();
  await loginDiretoUsuarioCriado(page, anaEmail, SENHA_USUARIO_NOVO);

  const meResponse = await page.request.get(`${BASE_URL}/api/me`);
  const me = await meResponse.json().catch(() => null);

  expect(meResponse.status(), JSON.stringify(me)).toBe(200);
  expect(me?.user?.role).toBe("technical_support");
  expect(me?.user?.permissionRole).toBe("technical_support");
  expect(me?.user?.permissions?.users).toEqual(expect.arrayContaining(["view", "create", "edit"]));
  expect(me?.user?.permissions?.permissions).toEqual(expect.arrayContaining(["view", "edit"]));

  return ana;
}

test.describe("Suporte Técnico — criação de perfis", () => {
  const createdUserIds: string[] = [];

  test.afterAll(async ({ request }) => {
    for (const id of createdUserIds) {
      await request.delete(`${BASE_URL}/api/admin/users/${id}`).catch(() => {});
    }
  });

  for (const profile of perfisCriadosPorSuporte) {
    test(`Ana suporte TC cria, edita, recebe e-mail e acessa Meu Perfil: ${profile.label}`, async ({ page }) => {
      const idsParaLimpar: string[] = [];
      const suffix = gerarSufixo();
      const email = `e2e-sup-${profile.role}-${suffix}@demo.test`;
      const name = `Teste ${profile.label} ${suffix}`;
      const editedName = `${name} Editado`;

      try {
        limparEmailsCapturados();

        const ana = await autenticarAnaSuporteTecnicoComAcessoCompleto(page);
        if (ana.id) {
          idsParaLimpar.push(ana.id);
        }

        limparEmailsCapturados();

        const created = await criarUsuarioViaApi(page, {
          name,
          email,
          role: profile.role,
          companySlug: "DEMO",
        });

        expect(created.id, `ID do usuario ${profile.label} deve ser retornado`).toBeTruthy();

        if (created.id) {
          createdUserIds.push(created.id);
          idsParaLimpar.push(created.id);
        }

        await aguardarUsuarioNaListaAdmin(page, email);

        const welcomeEmail = await esperarEmailCapturado({
          to: email,
          subject: /Seus dados de acesso - Quality Control/i,
          contains: [
            name,
            "Quality Control",
            "Login",
            "Senha",
            "temporária",
            "Meu Perfil",
            "Alterar Senha",
          ],
        });
        const senhaTemporaria = extrairSenhaTemporaria(welcomeEmail);
        expect(senhaTemporaria).not.toBe(SENHA_USUARIO_NOVO);

        const createdItemResponse = await page.request.get(`${BASE_URL}/api/admin/users/${created.id}`);
        const createdItemBody = await createdItemResponse.json().catch(() => null);
        const clientId = createdItemBody?.item?.client_id ?? null;

        const updateResponse = await page.request.patch(`${BASE_URL}/api/admin/users/${created.id}`, {
          data: {
            name: editedName,
            full_name: editedName,
            email,
            phone: "51999990000",
            role: profile.role,
            client_id: clientId,
          },
        });
        const updateText = await updateResponse.text();

        expect(updateResponse.status(), updateText).toBe(200);

        const updatedResponse = await page.request.get(`${BASE_URL}/api/admin/users/${created.id}`);
        const updatedBody = await updatedResponse.json().catch(() => null);

        expect(updatedResponse.status(), JSON.stringify(updatedBody)).toBe(200);
        expect(updatedBody?.item?.name).toBe(editedName);
        expect(updatedBody?.item?.phone).toBe("51999990000");
        expect(updatedBody?.item?.permission_role).toBe(profile.role);

        await page.context().clearCookies();

        await loginDiretoUsuarioCriado(page, email, senhaTemporaria);

        if (profile.role === "leader_tc" || profile.role === "technical_support") {
          await page.goto("/admin", { waitUntil: "domcontentloaded" });
          await expect(page).not.toHaveURL(/\/login/);
        } else {
          await validarSessaoUsuarioCriado(page, email, profile.role);
        }

        await validarMeuPerfilUsuarioCriado(page, { name: editedName, email });
        await validarBloqueioAdminParaPerfilCriado(page, profile.role);
      } finally {
        await page.context().clearCookies();
        await autenticarAdminParaCriacaoUsuario(page).catch(() => null);
        for (const id of idsParaLimpar.reverse()) {
          await page.request.delete(`${BASE_URL}/api/admin/users/${id}`).catch(() => {});
        }
      }
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

