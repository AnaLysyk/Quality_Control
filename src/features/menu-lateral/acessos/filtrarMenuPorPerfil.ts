import type { SystemRole } from "@/backend/auth/roles";
import type { PermissionMatrix } from "@/backend/permissionMatrix";
import { NAV_CATALOG, type NavItemDef, type NavModuleDef } from "../catalogo/menuLateral.catalog";
import {
  buildNavigationForUser,
  canSeeNavItem,
  filterNavModule,
} from "@/backend/navigation/navigationPermissions";

type FiltrarMenuPorPerfilInput = {
  catalogo?: NavModuleDef[];
  perfil: SystemRole | null;
  permissoes?: PermissionMatrix | null;
};

export function filtrarMenuPorPerfil({
  catalogo = NAV_CATALOG,
  perfil,
  permissoes,
}: FiltrarMenuPorPerfilInput): NavModuleDef[] {
  return buildNavigationForUser(catalogo, perfil, permissoes);
}

export function podeVerItemDoMenu(
  item: NavItemDef | NavModuleDef,
  perfil: SystemRole | null,
  permissoes?: PermissionMatrix | null,
) {
  return canSeeNavItem(item, perfil, permissoes);
}

export { buildNavigationForUser, filterNavModule };

