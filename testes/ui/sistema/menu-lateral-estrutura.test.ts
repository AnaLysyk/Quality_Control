import {
  filtrarMenuPorPerfil,
  NAV_CATALOG,
  resolverPerfilVisual,
} from "@/features/menu-lateral";
import { SYSTEM_ROLES } from "@/lib/auth/roles";
import { resolveRoleDefaults } from "@/lib/permissions/roleDefaults";

function itemIds(modules: ReturnType<typeof filtrarMenuPorPerfil>) {
  return modules.flatMap((module) => module.items.map((item) => item.id));
}

describe("estrutura organizada do menu lateral", () => {
  it("reaproveita o catalogo real como fonte da verdade", () => {
    expect(NAV_CATALOG.map((module) => module.id)).toEqual(
      expect.arrayContaining(["home", "quality", "support", "brain", "admin"]),
    );
  });

  it("resolve o perfil visual sem criar tela duplicada", () => {
    expect(resolverPerfilVisual({ role: "global_admin" })).toMatchObject({
      grupo: "testing-company",
      isInterno: true,
      label: "Lider TC",
      perfil: SYSTEM_ROLES.LEADER_TC,
    });

    expect(resolverPerfilVisual({ companyRole: "client_user" })).toMatchObject({
      grupo: "empresa",
      isEmpresa: true,
      label: "Usuario da empresa",
      perfil: SYSTEM_ROLES.COMPANY_USER,
    });
  });

  it("filtra itens pelo perfil e pelas permissoes atuais", () => {
    const supportModules = filtrarMenuPorPerfil({
      perfil: SYSTEM_ROLES.TECHNICAL_SUPPORT,
      permissoes: resolveRoleDefaults(SYSTEM_ROLES.TECHNICAL_SUPPORT),
    });
    const supportItems = itemIds(supportModules);

    expect(supportItems).toContain("users-list");
    expect(supportItems).not.toContain("users-create-leader-tc");

    const leaderModules = filtrarMenuPorPerfil({
      perfil: SYSTEM_ROLES.LEADER_TC,
      permissoes: resolveRoleDefaults(SYSTEM_ROLES.LEADER_TC),
    });
    const leaderItems = itemIds(leaderModules);

    expect(leaderItems).toContain("admin-permissions");
    expect(leaderItems).toContain("users-create-leader-tc");
  });
});
