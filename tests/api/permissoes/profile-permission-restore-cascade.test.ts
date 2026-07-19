import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * Regressão do incidente real: um deny de "dashboard.view" no perfil leader_tc
 * permaneceu ativo mesmo após tentativas de reativação, porque nada além do
 * próprio override de perfil era limpo no restore, e um override individual
 * pode continuar mascarando o padrão do perfil por baixo do editor.
 *
 * Roda inteiramente em modo de arquivo local (sem Postgres), no mesmo padrão
 * de tests/api/permissoes/user-permissions-store-json.test.ts.
 */
describe("Perfil leader_tc — deny preso e cascata de restore", () => {
  const originalLocalAuthDataDir = process.env.LOCAL_AUTH_DATA_DIR;
  const originalE2eUseJson = process.env.E2E_USE_JSON;
  let tempDir: string;

  beforeEach(async () => {
    jest.resetModules();
    tempDir = await mkdtemp(path.join(tmpdir(), "qc-profile-permissions-"));
    process.env.LOCAL_AUTH_DATA_DIR = tempDir;
    // userPermissionsStore só usa o fallback local (sem Postgres) com este flag.
    process.env.E2E_USE_JSON = "1";
  });

  afterEach(async () => {
    if (originalLocalAuthDataDir === undefined) {
      delete process.env.LOCAL_AUTH_DATA_DIR;
    } else {
      process.env.LOCAL_AUTH_DATA_DIR = originalLocalAuthDataDir;
    }
    if (originalE2eUseJson === undefined) {
      delete process.env.E2E_USE_JSON;
    } else {
      process.env.E2E_USE_JSON = originalE2eUseJson;
    }
    await rm(tempDir, { recursive: true, force: true });
  });

  it("nega dashboard.view ao salvar deny, e o restaura ao remover o deny (sem precisar de allow explícito)", async () => {
    const { setProfilePermissionOverride, resolveProfilePermissionDefaults } = await import(
      "@/backend/store/profilePermissionsStore"
    );
    const { hasPermissionAccess } = await import("@/backend/permissionMatrix");

    const before = await resolveProfilePermissionDefaults("leader_tc");
    expect(hasPermissionAccess(before, "dashboard", "view")).toBe(true);

    // Simula o ajuste em lote que negou várias telas de uma vez, incluindo dashboard.view.
    await setProfilePermissionOverride("leader_tc", {
      deny: {
        "screen:dashboards.geral": ["view"],
        dashboard: ["view"],
        chat: ["view", "use"],
      },
      reason: "Ajuste no perfil Lider TC",
      updatedBy: "ana.paula.lysyk@testingcompany.com",
    });

    const denied = await resolveProfilePermissionDefaults("leader_tc");
    expect(hasPermissionAccess(denied, "dashboard", "view")).toBe(false);

    // "Reativar": salva de novo só sem o dashboard.view no deny — não precisa de allow explícito,
    // porque dashboard.view já é padrão do sistema para leader_tc.
    await setProfilePermissionOverride("leader_tc", {
      deny: {
        "screen:dashboards.geral": ["view"],
        chat: ["view", "use"],
      },
      reason: "Restaura acesso a Home",
      updatedBy: "ana.paula.lysyk@testingcompany.com",
    });

    const restored = await resolveProfilePermissionDefaults("leader_tc");
    expect(hasPermissionAccess(restored, "dashboard", "view")).toBe(true);
    // As outras restrições da mesma edição continuam de pé — o restore é cirúrgico, não total.
    expect(hasPermissionAccess(restored, "chat", "view")).toBe(false);
  });

  it("restaurar o padrão do perfil também limpa overrides individuais dos usuários daquele perfil", async () => {
    const profileStore = await import("@/backend/store/profilePermissionsStore");
    const userStore = await import("@/backend/store/userPermissionsStore");

    const userId = "user-leader-tc-1";

    await profileStore.setProfilePermissionOverride("leader_tc", {
      deny: { dashboard: ["view"] },
      reason: "Ajuste no perfil Lider TC",
      updatedBy: "ana.paula.lysyk@testingcompany.com",
    });

    await userStore.setUserPermissionOverride(userId, {
      deny: { dashboard: ["view"] },
      updatedBy: "ana.paula.lysyk@testingcompany.com",
    });

    const beforeReset = await userStore.resolveUserPermissionsFromProfile(userId, "leader_tc");
    expect(beforeReset.dashboard ?? []).not.toContain("view");

    // Reproduz o que a rota DELETE /api/admin/profile-permissions/[role] faz agora:
    // limpa o override do perfil E os overrides individuais dos usuários daquele perfil.
    await profileStore.deleteProfilePermissionOverride("leader_tc");
    const cleared = await userStore.deleteUserPermissionOverridesForUserIds([userId]);
    expect(cleared).toBe(1);

    expect(await userStore.getUserPermissionOverride(userId)).toBeNull();

    const afterReset = await userStore.resolveUserPermissionsFromProfile(userId, "leader_tc");
    expect(afterReset.dashboard ?? []).toContain("view");
  });

  it("deleteUserPermissionOverridesForUserIds não afeta usuários fora da lista (isolamento)", async () => {
    const userStore = await import("@/backend/store/userPermissionsStore");

    await userStore.setUserPermissionOverride("user-a", { deny: { dashboard: ["view"] } });
    await userStore.setUserPermissionOverride("user-b", { deny: { dashboard: ["view"] } });

    const cleared = await userStore.deleteUserPermissionOverridesForUserIds(["user-a"]);
    expect(cleared).toBe(1);

    expect(await userStore.getUserPermissionOverride("user-a")).toBeNull();
    expect(await userStore.getUserPermissionOverride("user-b")).not.toBeNull();
  });
});
