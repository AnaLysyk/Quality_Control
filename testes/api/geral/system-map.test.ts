import fs from "node:fs";
import path from "node:path";

import { SYSTEM_MODULES } from "@/lib/navigation/module-map";
import { NAV_CATALOG } from "@/lib/navigation/navigationCatalog";
import { SYSTEM_ROUTES } from "@/lib/navigation/route-map";
import { PERMISSION_MODULES } from "@/lib/permissionCatalog";

function flattenMenuRouteIds() {
  return NAV_CATALOG.flatMap((moduleDefinition) => [
    moduleDefinition.routeId,
    ...moduleDefinition.items.flatMap((itemDefinition) => [
      itemDefinition.routeId,
      ...(itemDefinition.children ?? []).map((childDefinition) => childDefinition.routeId),
    ]),
  ]).filter((routeId): routeId is string => typeof routeId === "string" && routeId.length > 0);
}

describe("mapa do sistema", () => {
  it("mantem ids unicos e rotas ligadas a modulos existentes", () => {
    const moduleIds = SYSTEM_MODULES.map((moduleDefinition) => moduleDefinition.id);
    const routeIds = SYSTEM_ROUTES.map((routeDefinition) => routeDefinition.id);

    expect(new Set(moduleIds).size).toBe(moduleIds.length);
    expect(new Set(routeIds).size).toBe(routeIds.length);

    const knownModules = new Set(moduleIds);
    for (const routeDefinition of SYSTEM_ROUTES) {
      expect(knownModules.has(routeDefinition.moduleId)).toBe(true);
    }
  });

  it("aponta somente para arquivos existentes", () => {
    for (const routeDefinition of SYSTEM_ROUTES) {
      const absolutePath = path.join(process.cwd(), routeDefinition.mainFile);
      expect(fs.existsSync(absolutePath)).toBe(true);
    }
  });

  it("mantem todos os itens do menu ligados a rotas mapeadas", () => {
    const knownRoutes = new Set(SYSTEM_ROUTES.map((routeDefinition) => routeDefinition.id));

    for (const routeId of flattenMenuRouteIds()) {
      expect(knownRoutes.has(routeId)).toBe(true);
    }
  });

  it("mantem toda rota visual com permissao minima cadastrada na matriz", () => {
    const permissionModules = new Map(PERMISSION_MODULES.map((permissionModule) => [permissionModule.id, permissionModule]));

    for (const routeDefinition of SYSTEM_ROUTES) {
      expect(routeDefinition.requiredPermission).not.toBeNull();

      const requiredPermission = routeDefinition.requiredPermission;
      expect(requiredPermission).toBeDefined();
      if (!requiredPermission) continue;

      const permissionModule = permissionModules.get(requiredPermission.moduleId);
      expect(permissionModule).toBeDefined();
      expect(permissionModule?.actions).toContain(requiredPermission.action);
    }
  });
});
