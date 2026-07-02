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
} from "../../../../../support/functions/ui/usuarios/criar-usuario-por-perfil";
import { validarMeuPerfilUsuarioCriado } from "../../../../../support/functions/ui/usuarios/validar-meu-perfil-usuario-criado";

test.setTimeout(180000);

test.describe("Criar usuário - Usuário TC", () => {
  const createdUserIds: string[] = [];

  test.afterAll(async ({ request }) => {
    for (const id of createdUserIds) {
      await request.delete(`${BASE_URL}/api/admin/users/${id}`).catch(() => {});
    }
  });

  test("cria Usuário TC, lista o usuário, valida login e bloqueio administrativo", async ({ page }) => {
    const suffix = `${Date.now().toString().slice(-6)}-${Math.random().toString(36).slice(2, 5)}`;
    const email = `e2e-usuario-tc-${suffix}@demo.test`;
    const name = `Teste Usuário TC ${suffix}`;

    await autenticarAdminParaCriacaoUsuario(page);

    const created = await criarUsuarioViaApi(page, {
      name,
      email,
      role: "testing_company_user",
      companySlug: "DEMO",
      password: SENHA_USUARIO_NOVO,
    });

    if (created.id) createdUserIds.push(created.id);

    await aguardarUsuarioNaListaAdmin(page, email);

    await page.context().clearCookies();
    await loginDiretoUsuarioCriado(page, email, SENHA_USUARIO_NOVO);

    await validarMeuPerfilUsuarioCriado(page, { name, email });

    await validarSessaoUsuarioCriado(page, email, "testing_company_user");
    await validarBloqueioAdminParaPerfilCriado(page, "testing_company_user");
  });
});

