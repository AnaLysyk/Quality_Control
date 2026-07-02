import fs from "node:fs";
import path from "node:path";

import { SYSTEM_MODULES } from "@/lib/navigation/module-map";
import { NAV_CATALOG } from "@/lib/navigation/navigationCatalog";
import { SYSTEM_ROUTES } from "@/lib/navigation/route-map";

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

    for (const moduleDefinition of NAV_CATALOG) {
      if (moduleDefinition.routeId) {
        expect(knownRoutes.has(moduleDefinition.routeId)).toBe(true);
      }
      for (const itemDefinition of moduleDefinition.items) {
        expect(knownRoutes.has(itemDefinition.routeId)).toBe(true);
      }
    }
  });
});

