"use client";

import { ReactNode, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthUser } from "@/hooks/useAuthUser";
import { AuthSkeleton } from "@/components/AuthSkeleton";

type RequireGlobalAdminProps = {
  children: ReactNode;
  fallback?: ReactNode;
};

export function RequireGlobalAdmin({ children, fallback }: RequireGlobalAdminProps) {
  const { user, loading } = useAuthUser();
  const router = useRouter();
  const pathname = usePathname();

  const legacyUser = (user ?? null) as unknown as { is_global_admin?: boolean } | null;
  const normalizedRole = typeof user?.role === "string" ? user.role.toLowerCase() : null;
  const isAdmin =
    normalizedRole === "admin" ||
    normalizedRole === "global_admin" ||
    user?.globalRole === "global_admin" ||
    user?.isGlobalAdmin === true ||
    legacyUser?.is_global_admin === true;
  const clientSlug =
    typeof (user as { clientSlug?: string | null } | null)?.clientSlug === "string"
      ? String((user as { clientSlug?: string | null }).clientSlug)
      : null;
  const nonAdminRedirect = clientSlug
    ? `/empresas/${encodeURIComponent(clientSlug)}/home`
    : "/empresas";
  const deniedFallback =
    (fallback as ReactNode) ?? (
      <div className="p-8 text-center text-lg">
        <p>Acesso restrito ao admin. Acesso restrito a admin global.</p>
      </div>
    );

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(pathname || "/")}`);
      return;
    }
    if (!isAdmin) {
      router.replace(nonAdminRedirect);
    }
  }, [loading, user, isAdmin, router, pathname, nonAdminRedirect]);

  if (loading) {
    return (fallback as ReactNode) ?? <AuthSkeleton message="Validando sessao..." />;
  }
  if (!user) {
    return (fallback as ReactNode) ?? null;
  }
  if (!isAdmin) {
    return deniedFallback;
  }

  return <>{children}</>;
}
