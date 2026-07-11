import { normalizeLegacyRole, SYSTEM_ROLES } from "@/lib/auth/roles";
import { SYSTEM_ROUTES } from "@/lib/navigation/route-map";
import type { SystemRouteDefinition } from "@/lib/navigation/navigation.types";
import type { PermissionModule } from "@/lib/permissionCatalog";
import type { PermissionMatrix } from "@/lib/permissionMatrix";

export const SCREEN_PERMISSION_PREFIX = "screen:";
export const SCREEN_PERMISSION_ACTION = "view";
export const RELATIONSHIP_PERMISSION_MODULE_ID = "relationships";

const DISABLED_SCREEN_STATUSES = new Set([