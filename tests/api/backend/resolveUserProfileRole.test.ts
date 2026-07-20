import { SYSTEM_ROLES } from "@/backend/auth/roles";
import { resolveUserProfileRole } from "@/backend/permissions/resolveUserProfileRole";

function input(overrides: Partial<Parameters<typeof resolveUserProfileRole>[0]> = {}) {
  return {
    role: "user",
    globalRole: null,
    user_origin: null,
    user_scope: null,
    default_company_slug: null