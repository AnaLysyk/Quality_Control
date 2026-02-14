/**
 * RequireClient: Client-side guard for company-specific routes.
 * Redirects to login if not authenticated, or to user's company if mismatched.
 * Shows fallback while loading.
 */
"use client";

import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthUser } from "@/hooks/useAuthUser";

type RequireClientProps = {
  slug?: string; // slug da rota /empresas/[slug]
  children: ReactNode;
  fallback?: ReactNode;
};

/**
 * Auth guard for company routes. Redirects if user is not allowed for the company.
 * @param slug - Expected company slug for the route
 * @param children - Content to render if allowed
 * @param fallback - Optional fallback while loading or if denied
 */
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
        router.replace(`/empresas/${user.clientSlug}/home`);
    }
  }, [loading, user, slug, router]);

  if (loading) return (fallback as ReactNode) ?? null;
  if (!user) return (fallback as ReactNode) ?? null;

  return <>{children}</>;
}
