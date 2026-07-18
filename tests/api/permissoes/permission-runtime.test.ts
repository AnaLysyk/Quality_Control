import { SYSTEM_ROLES } from "@/backend/auth/roles";
import { getVisibleRouteIds } from "@/backend/navigation/get-visible-routes";
import { SYSTEM_ROUTE_BY_ID } from "@/backend/navigation/route-map";
import { canAccess, canAccessRoute } from "@/backend/permissions/can-access";
import { getUserAccessContext } from "@/backend/permissions/get-user-access-context";

function contextFor(
  role: string,
  permissions?: Record<string, string[]>,
) {
  return getUserAccessContext({
    id: `user-${role}`,
    role,
    permissionRole: role,
    ...(permissions === undefined ? {} : { permissions }),
  });
}

describe("runtime central de permissoes", () => {
  it("resolve os defaults do perfil sem espalhar regra na tela", () => {
    const leader = contextFor(SYSTEM_ROLES.LEADER_TC);
    const support = contextFor(SYSTEM_ROLES.TECHNICAL_SUPPORT);

    expect(canAccess(leader, "permissions.view")).toBe(true);
    expect(canAccess(leader, "permissions.edit")).toBe(true);
    expect(canAccess(support, "permissions.view")).toBe(true);
    expect(canAccess(support, "permissions.edit")).toBe(true);
  });

  it("mapeia usuario global legado para Lider TC sem ignorar matriz efetiva", () => {
    const context = getUserAccessContext({
      id: "usr_ana_paula_lysyk",
      role: SYSTEM_ROLES.TECHNICAL_SUPPORT,
      permissionRole: SYSTEM_ROLES.TECHNICAL_SUPPORT,
      globalRole: "global_admin",
      isGlobalAdmin: true,
      permissions: { users: ["view"] },
    });

    expect(context?.permissionRole).toBe(SYSTEM_ROLES.LEADER_TC);
    expect(canAccess(context, "users.view")).toBe(true);
    expect(canAccess(context, "users.delete")).toBe(false);
    expect(canAccess(context, "audit.export")).toBe(false);
  });

  it("trata a matriz efetiva vazia como override autoritativo", () => {
    const context = contextFor(SYSTEM_ROLES.LEADER_TC, {});

    expect(canAccess(context, "users.view")).toBe(false);
    expect(canAccess(context, "permissions.view")).toBe(false);
    expect(getVisibleRouteIds(context).size).toBe(
      Array.from(SYSTEM_ROUTE_BY_ID.values()).filter((route) => !route.requiredPermission).length,
    );
  });

  it("aceita escopos de leitura como acesso de visualizacao", () => {
    const context = contextFor(SYSTEM_ROLES.COMPANY_USER, {
      tickets: ["view_own"],
    });

    expect(canAccess(context, "tickets.view")).toBe(true);
    expect(canAccess(context, "tickets.edit")).toBe(false);
  });

  it("usa a permissao declarada na rota para liberar ou bloquear", () => {
    const route = SYSTEM_ROUTE_BY_ID.get("configuracoes.mapa-sistema");
    expect(route).toBeDefined();

    expect(canAccessRoute(contextFor(SYSTEM_ROLES.LEADER_TC), route!)).toBe(true);
    expect(canAccessRoute(contextFor(SYSTEM_ROLES.LEADER_TC, {}), route!)).toBe(false);
  });
});
