import { test, expect } from "../../../../../support/fixtures/test";
import { BASE_URL } from "../../../../../support/functions/api/autenticacao/autenticar-por-cookie";
import {
  SENHA_USUARIO_NOVO,
  aguardarUsuarioNaListaAdmin,
  autenticarAdminParaCriacaoUsuario,
  criarUsuarioViaApi,
  loginDiretoUsuarioCriado,
  validarSessaoUsuarioCriado,
  validarBloqueioAdminParaPerfilCriado,
  temEmpresaE2E,
} from "../../../../../support/functions/ui/usuarios/criar-usuario-por-perfil";
import { validarMeuPerfilUsuarioCriado } from "../../../../../support/functions/ui/usuarios/validar-meu-perfil-usuario-criado";

test.setTimeout(180000);

test.describe("Criar usuário - Usuário da empresa", () => {
  const createdUserIds: string[] = [];

  test.afterAll(async ({ request }) => {
    for (const id of createdUserIds) {
      await request.delete(`${BASE_URL}/api/admin/users/${id}`).catch(() => {});
    }
  });

  test("cria Usuário da empresa, lista o usuário, valida login, empresa e bloqueio administrativo", async ({ page }) => {
    const suffix = `${Date.now().toString().slice(-6)}-${Math.random().toString(36).slice(2, 5)}`;
    const email = `e2e-usuario-empresa-${suffix}@demo.test`;
    const name = `Teste Usuário Empresa ${suffix}`;

    await autenticarAdminParaCriacaoUsuario(page);

    const created = await criarUsuarioViaApi(page, {
      name,
      email,
      role: "company_user",
      companySlug: "DEMO",
      password: SENHA_USUARIO_NOVO,
    });

    if (created.id) createdUserIds.push(created.id);

    await aguardarUsuarioNaListaAdmin(page, email);

    await page.context().clearCookies();
    await loginDiretoUsuarioCriado(page, email, SENHA_USUARIO_NOVO);

    await validarMeuPerfilUsuarioCriado(page, { name, email });

    const me = await validarSessaoUsuarioCriado(page, email, "company_user");
    expect(temEmpresaE2E(me)).toBeTruthy();
    await validarBloqueioAdminParaPerfilCriado(page, "company_user");
  });
});

