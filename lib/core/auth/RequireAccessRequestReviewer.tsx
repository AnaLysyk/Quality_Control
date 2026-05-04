"use client";

import { ReactNode, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import { AuthSkeleton } from "@/components/AuthSkeleton";
import { useAuthUser } from "@/hooks/useAuthUser";
import { normalizeLegacyRole } from "@/lib/auth/roles";

type RequireAccessRequestReviewerProps = {
  children: ReactNode;
  fallback?: ReactNode;
};

function isReviewerUser(
  user?: { role?: string | null; permissionRole?: string | null; companyRole?: string | null } | null,
) {
  // Allow any authenticated user that participates in the access-request flow.
  // Global reviewers are resolved server-side from canonical roles and legacy aliases.
  if (!user) return false;
  return Boolean(
    normalizeLegacyRole(user.role) ||
      normalizeLegacyRole(user.permissionRole) ||
      normalizeLegacyRole(user.companyRole),
  );
}

export function RequireAccessRequestReviewer({ children, fallback }: RequireAccessRequestReviewerProps) {
  const { user, loading } = useAuthUser();
  const router = useRouter();
  const pathname = usePathname();

  const allowed = isReviewerUser(user);
  const clientSlug = typeof (user as { clientSlug?: string | null } | null)?.clientSlug === "string" ? String((user as { clientSlug?: string | null }).clientSlug) : null;
  const nonGlobalRedirect = user?.isGlobalAdmin ? "/admin/dashboard" : clientSlug ? `/empresas/${encodeURIComponent(clientSlug)}/home` : "/empresas";

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(pathname || "/")}`);
      return;
    }
    // if user exists but is not part of known roles, redirect to their home
    if (!allowed) {
      router.replace(nonGlobalRedirect);
    }
  }, [allowed, loading, nonGlobalRedirect, pathname, router, user]);

  if (loading) return fallback ?? <AuthSkeleton message="Validando sessao..." />;
  if (!user) return fallback ?? null;
  if (!allowed) return (
    <div className="p-8 text-center text-lg">
      <p>Acesso restrito.</p>
    </div>
  );
  return <>{children}</>;
}

export default RequireAccessRequestReviewer;
