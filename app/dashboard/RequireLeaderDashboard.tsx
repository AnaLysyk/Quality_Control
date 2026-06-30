"use client";

import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthUser } from "@/hooks/useAuthUser";
import { useClientContext } from "@/context/ClientContext";
import { normalizeLegacyRole, SYSTEM_ROLES } from "@/lib/auth/roles";
import { buildCompanyPathForAccess } from "@/lib/companyRoutes";

export default function RequireLeaderDashboard({ children }: { children: ReactNode }) {
  const { user, loading } = useAuthUser();
  const { activeClientSlug, activeClient } = useClientContext();
  const router = useRouter();

  const permissionRole = typeof user?.permissionRole === "string" ? user.permissionRole : null;
  const role = typeof user?.role === "string" ? user.role : null;
  const companyRole = typeof user?.companyRole === "string" ? user.companyRole : null;
  const normalizedRole = normalizeLegacyRole(permissionRole) ?? normalizeLegacyRole(role) ?? normalizeLegacyRole(companyRole);
  const allowed =
    user?.isGlobalAdmin === true ||
    normalizedRole === SYSTEM_ROLES.LEADER_TC ||
    normalizedRole === SYSTEM_ROLES.TECHNICAL_SUPPORT;
  const typedUser = user as { clientSlug?: string | null; companySlug?: string | null; userOrigin?: string | null; user_origin?: string | null } | null;
  const companySlug = activeClientSlug ?? activeClient?.slug ?? typedUser?.clientSlug ?? typedUser?.companySlug ?? null;
  const userOrigin = typedUser?.userOrigin ?? typedUser?.user_origin ?? null;

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (allowed) return;

    router.replace(
      companySlug
        ? buildCompanyPathForAccess(companySlug, "dashboard", {
            isGlobalAdmin: false,
            permissionRole,
            role,
            companyRole,
            userOrigin,
            clientSlug: companySlug,
          })
        : "/empresas",
    );
  }, [allowed, companyRole, companySlug, loading, permissionRole, role, router, user, userOrigin]);

  if (loading) return <div className="tc-empty-state min-h-80">Carregando painel.</div>;
  if (!user) return <div className="tc-empty-state min-h-80">Redirecionando para login.</div>;
  if (!allowed) return <div className="tc-empty-state min-h-80">Redirecionando para o dashboard da empresa.</div>;

  return <>{children}</>;
}
