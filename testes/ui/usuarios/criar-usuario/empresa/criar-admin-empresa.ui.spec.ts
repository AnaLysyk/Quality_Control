import { test, expect } from "../../../../../support/fixtures/test";
import { BASE_URL } from "../../../../../support/functions/api/autenticacao/autenticar-por-cookie";
import {
  SENHA_USUARIO_NOVO,
  aguardarUsuarioNaListaAdmin,
  autenticarAdminParaCriacaoUsuario,
  criarUsuarioViaApi,
  loginDiretoUsuarioCriado,
  validarSessaoUsuarioCriado,
  temEmpresaE2E,
} from "../../../../../support/functions/ui/usuarios/criar-usuario-por-perfil";
import { validarMeuPerfilUsuarioCriado } from "../../../../../support/functions/ui/usuarios/validar-meu-perfil-usuario-criado";

test.setTimeout(180000);

test.describe("Criar usuário - Admin da empresa", () => {
  const createdUserIds: string[] = [];

  test.afterAll(async ({ request }) => {
    for (const id of createdUserIds) {
      await request.delete(`${BASE_URL}/api/admin/users/${id}`).catch(() => {});
    }
  });

  test("cria Admin da empresa, lista o usuário, valida login e vínculo com empresa", async ({ page }) => {
    const suffix = `${Date.now().toString().slice(-6)}-${Math.random().toString(36).slice(2, 5)}`;
    const email = `e2e-admin-empresa-${suffix}@demo.test`;
    const name = `Teste Admin Empresa ${suffix}`;

    await autenticarAdminParaCriacaoUsuario(page);

    const created = await criarUsuarioViaApi(page, {
      name,
      email,
      role: "empresa",
      companySlug: "DEMO",
      password: SENHA_USUARIO_NOVO,
    });

    if (created.id) createdUserIds.push(created.id);

    await aguardarUsuarioNaListaAdmin(page, email);

    await page.context().clearCookies();
    await loginDiretoUsuarioCriado(page, email, SENHA_USUARIO_NOVO);

    await validarMeuPerfilUsuarioCriado(page, { name, email });

    const me = await validarSessaoUsuarioCriado(page, email, "empresa");
    expect(temEmpresaE2E(me)).toBeTruthy();
  });
});

