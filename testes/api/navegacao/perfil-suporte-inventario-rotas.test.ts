import fs from "fs";
import path from "path";

import { SYSTEM_ROLES } from "@/lib/auth/roles";
import { NAV_CATALOG, type NavItemDef } from "@/lib/navigation/navigationCatalog";
import { buildNavigationForUser } from "@/lib/navigation/navigationPermissions";
import { resolveRoleDefaults } from "@/lib/permissions/roleDefaults";

function buildSupportItems() {
  const modules = buildNavigationForUser(
    NAV_CATALOG,
    SYSTEM_ROLES.TECHNICAL_SUPPORT,
    resolveRoleDefaults(SYSTEM_ROLES.TECHNICAL_SUPPORT),
  );

  return modules.flatMap((module) => module.items);
}

function normalizeHref(href: string) {
  const clean = href.split("?")[0].split("#")[0];

  if (clean.length > 1 && clean.endsWith("/")) {
    return clean.slice(0, -1);
  }

  return clean || "/";
}

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) {
    return [];
  }

  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      return walk(fullPath);
    }

    return fullPath;
  });
}

function appPageRoutes() {
  const appDir = path.join(process.cwd(), "app");

  return new Set(
    walk(appDir)
      .filter((file) => file.endsWith(`${path.sep}page.tsx`))
      .map((file) => {
        const relative = path.relative(appDir, file);
        const withoutPage = relative.replace(new RegExp(`\\${path.sep}?page\\.tsx$`), "");
        const route = `/${withoutPage.split(path.sep).filter(Boolean).join("/")}`;

        return route === "/" ? "/" : route;
      }),
  );
}

function itemRouteInventory(items: NavItemDef[]) {
  const routes = appPageRoutes();

  return items
    .filter((item) => item.href)
    .map((item) => {
      const route = normalizeHref(item.href!);

      return {
        id: item.id,
        label: item.label,
        href: item.href,
        route,
        hasPage: routes.has(route),
      };
    });
}

describe("perfil suporte - inventario de rotas", () => {
  it("todos os hrefs visiveis para suporte tecnico apontam para paginas existentes", () => {
    const inventory = itemRouteInventory(buildSupportItems());
    const missingRoutes = inventory.filter((item) => !item.hasPage);

    expect(missingRoutes).toEqual([]);
  });

  it("mantem inventario minimo de rotas criticas do suporte tecnico", () => {
    const inventory = itemRouteInventory(buildSupportItems());

    expect(inventory).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "companies-listing", route: "/admin/clients", hasPage: true }),
        expect.objectContaining({ id: "requests-list", route: "/solicitacoes", hasPage: true }),
        expect.objectContaining({ id: "support-create", route: "/suporte", hasPage: true }),
        expect.objectContaining({ id: "support-kanban", route: "/suporte/kanban", hasPage: true }),
        expect.objectContaining({ id: "support-chamados", route: "/chamados", hasPage: true }),
        expect.objectContaining({ id: "brain-graph", route: "/brain", hasPage: true }),
        expect.objectContaining({ id: "brain-ask", route: "/brain/perguntar", hasPage: true }),
        expect.objectContaining({ id: "users-list", route: "/admin/users", hasPage: true }),
        expect.objectContaining({ id: "admin-permissions", route: "/admin/permissoes", hasPage: true }),
        expect.objectContaining({ id: "admin-audit-logs", route: "/audit-logs", hasPage: true }),
      ]),
    );
  });
});
