import { test, expect } from "../../../../../support/fixtures/test";
import { BASE_URL } from "../../../../../support/functions/api/autenticacao/autenticar-por-cookie";
import {
  SENHA_USUARIO_NOVO,
  aguardarUsuarioNaListaAdmin,
  autenticarAdminParaCriacaoUsuario,
  criarUsuarioViaApi,
  loginDiretoUsuarioCriado,
} from "../../../../../support/functions/ui/usuarios/criar-usuario-por-perfil";

test.setTimeout(180000);

test.describe("Criar usuário - Líder TC", () => {
  const createdUserIds: string[] = [];

  test.afterAll(async ({ request }) => {
    for (const id of createdUserIds) {
      await request.delete(`${BASE_URL}/api/admin/users/${id}`).catch(() => {});
    }
  });

  test("cria Líder TC, lista o usuário e valida login com acesso administrativo", async ({ page }) => {
    const suffix = `${Date.now().toString().slice(-6)}-${Math.random().toString(36).slice(2, 5)}`;
    const email = `e2e-lider-tc-${suffix}@demo.test`;
    const name = `Teste Líder TC ${suffix}`;

    await autenticarAdminParaCriacaoUsuario(page);

    const created = await criarUsuarioViaApi(page, {
      name,
      email,
      role: "leader_tc",
      password: SENHA_USUARIO_NOVO,
    });

    if (created.id) createdUserIds.push(created.id);

    await aguardarUsuarioNaListaAdmin(page, email);

    await page.context().clearCookies();
    await loginDiretoUsuarioCriado(page, email, SENHA_USUARIO_NOVO);

    await page.goto("/admin", { waitUntil: "domcontentloaded" });
    await expect(page).not.toHaveURL(/\/login/);
  });
});
