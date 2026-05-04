"use client";

import { ReactNode, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AuthSkeleton } from "@/components/AuthSkeleton";
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
  const pathname = usePathname() || "/";

  const role = typeof user?.role === "string" ? user.role.toLowerCase() : null;
  const permissionRole = typeof user?.permissionRole === "string" ? user.permissionRole.toLowerCase() : null;
  const isAdmin = role === "leader_tc" || role === "technical_support" || permissionRole === "leader_tc" || permissionRole === "technical_support" || user?.isGlobalAdmin === true;
  // testing_company_user can be linked to multiple companies; allow access to any of their clientSlugs
  const isTcUser = role === "testing_company_user" || permissionRole === "testing_company_user";
  const linkedSlugs: string[] = Array.isArray(user?.clientSlugs) ? (user.clientSlugs as string[]) : [];
  const isLinkedTcUser = isTcUser && !!slug && linkedSlugs.some((s) => s.toLowerCase() === slug.toLowerCase());
  const loginHref =
    pathname.startsWith("/") && pathname !== "/login" ? `/login?next=${encodeURIComponent(pathname)}` : "/login";
  const shouldRedirectToLogin = !loading && !user;
  const shouldRedirectToCompanyHome =
    !loading && !!user && !isAdmin && !isLinkedTcUser && !!slug && !!user.clientSlug && user.clientSlug !== slug;
  const shouldBlockContent = loading || shouldRedirectToLogin || (!isAdmin && !isLinkedTcUser && !!user && !user.clientSlug) || shouldRedirectToCompanyHome;

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(loginHref);
      return;
    }
    if (isAdmin || isLinkedTcUser) return;

    if (!user.clientSlug) {
      router.replace(loginHref);
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
          defaultClientSlug: user.defaultClientSlug ?? null,
        }),
      );
    }
  }, [isAdmin, loading, loginHref, router, slug, user]);

  if (shouldBlockContent) {
    return (fallback as ReactNode) ?? <AuthSkeleton message="Validando acesso da empresa" />;
  }

  return <>{children}</>;
}
