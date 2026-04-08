"use client";

import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthUser } from "@/hooks/useAuthUser";
import { buildCompanyPathForAccess } from "@/lib/companyRoutes";

type RequireClientProps = {
  slug?: string; // slug da rota /empresas/[slug]
  children: ReactNode;
  fallback?: ReactNode;
};

export function RequireClient({ slug, children, fallback }: RequireClientProps) {
  const { user, loading } = useAuthUser();
  const router = useRouter();

  useEffect(() => {
    if (loading || !user) return;

    const role = typeof user.role === "string" ? user.role.toLowerCase() : null;
    const isAdmin = role === "admin" || role === "global_admin" || user.isGlobalAdmin;
    if (isAdmin) return; // admin pode acessar qualquer empresa

    if (!user.clientSlug) {
      router.replace("/login");
      return;
    }

    if (slug && user.clientSlug !== slug) {
      router.replace(
        buildCompanyPathForAccess(user.clientSlug, "home", {
          isGlobalAdmin: user.isGlobalAdmin === true,
          permissionRole: user.permissionRole ?? null,
          role: user.role ?? null,
          companyRole: user.companyRole ?? null,
          userOrigin:
            (user as { userOrigin?: string | null } | null)?.userOrigin ??
            (user as { user_origin?: string | null } | null)?.user_origin ??
            null,
          clientSlug: user.clientSlug,
        }),
      );
    }
  }, [loading, user, slug, router]);

  if (loading) return (fallback as ReactNode) ?? null;
  if (!user) return (fallback as ReactNode) ?? null;

  return <>{children}</>;
}
