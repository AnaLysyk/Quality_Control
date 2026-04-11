"use client";

import { ReactNode, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import { AuthSkeleton } from "@/components/AuthSkeleton";
import { useAuthUser } from "@/hooks/useAuthUser";
import { normalizeLegacyRole, SYSTEM_ROLES } from "@/lib/auth/roles";

type RequireGlobalSupportOperatorProps = {
  children: ReactNode;
  fallback?: ReactNode;
};

function canAccessGlobalSupport(
  user?: {
    role?: string | null;
    permissionRole?: string | null;
    companyRole?: string | null;
  } | null,
) {
  return (
    normalizeLegacyRole(user?.role) === SYSTEM_ROLES.TECHNICAL_SUPPORT ||
    normalizeLegacyRole(user?.permissionRole) === SYSTEM_ROLES.TECHNICAL_SUPPORT ||
    normalizeLegacyRole(user?.companyRole) === SYSTEM_ROLES.TECHNICAL_SUPPORT
  );
}

export function RequireGlobalSupportOperator({ children, fallback }: RequireGlobalSupportOperatorProps) {
  const { user, loading } = useAuthUser();
  const router = useRouter();
  const pathname = usePathname();

  const hasSupportAccess = canAccessGlobalSupport(user);
  const clientSlug =
    typeof (user as { clientSlug?: string | null } | null)?.clientSlug === "string"
      ? String((user as { clientSlug?: string | null }).clientSlug)
      : null;
  const nonSupportRedirect = user?.isGlobalAdmin
    ? "/admin/home"
    : clientSlug
      ? `/empresas/${encodeURIComponent(clientSlug)}/home`
      : "/empresas";
  const deniedFallback =
    fallback ?? (
      <div className="p-8 text-center text-lg">
        <p>Acesso restrito ao suporte tecnico.</p>
      </div>
    );

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(pathname || "/")}`);
      return;
    }
    if (!hasSupportAccess) {
      router.replace(nonSupportRedirect);
    }
  }, [hasSupportAccess, loading, nonSupportRedirect, pathname, router, user]);

  if (loading) {
    return fallback ?? <AuthSkeleton message="Validando sessao..." />;
  }

  if (!user) {
    return fallback ?? null;
  }

  if (!hasSupportAccess) {
    return deniedFallback;
  }

  return <>{children}</>;
}
