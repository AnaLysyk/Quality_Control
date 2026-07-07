"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthUser } from "@/hooks/useAuthUser";
import { normalizeLegacyRole, SYSTEM_ROLES, type SystemRole } from "@/lib/auth/roles";

const INTERNAL_HOME_ROLES: ReadonlySet<SystemRole> = new Set([
  SYSTEM_ROLES.LEADER_TC,
  SYSTEM_ROLES.TECHNICAL_SUPPORT,
]);

export function TechnicalSupportHomeGuard() {
  const { user, loading } = useAuthUser();
  const router = useRouter();

  useEffect(() => {
    if (loading || !user) return;
    const role =
      normalizeLegacyRole(user.permissionRole) ??
      normalizeLegacyRole(user.role) ??
      normalizeLegacyRole(user.companyRole);

    if (!role || !INTERNAL_HOME_ROLES.has(role)) return;
    router.replace("/admin/home");
  }, [loading, user, router]);

  return null;
}
