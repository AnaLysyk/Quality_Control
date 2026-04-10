"use client";

import { ReactNode, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import { AuthSkeleton } from "@/components/AuthSkeleton";
import { useAuthUser } from "@/hooks/useAuthUser";

type RequireAccessRequestReviewerProps = {
  children: ReactNode;
  fallback?: ReactNode;
};

function isReviewerUser(
  user?: { role?: string | null; permissionRole?: string | null; companyRole?: string | null } | null,
) {
  // Allow any authenticated user that participates in the access-request flow.
  // Global reviewers (support/dev/admin) will be detected server-side via `isGlobalReviewer`.
  if (!user) return false;
  const role = (user.role ?? "").toLowerCase().trim();
  const permissionRole = (user.permissionRole ?? "").toLowerCase().trim();
  const companyRole = (user.companyRole ?? "").toLowerCase().trim();

  // Recognized roles that participate in the flow
  const known = new Set([
    "company",
    "company_admin",
    "client_admin",
    "user",
    "testing_company_user",
    "testing_company_lead",
    "it_dev",
    "dev",
    "developer",
    "support",
    "technical_support",
  ]);

  return Boolean(role && (known.has(role) || known.has(permissionRole) || known.has(companyRole)));
}

export function RequireAccessRequestReviewer({ children, fallback }: RequireAccessRequestReviewerProps) {
  const { user, loading } = useAuthUser();
  const router = useRouter();
  const pathname = usePathname();

  const allowed = isReviewerUser(user);
  const clientSlug = typeof (user as { clientSlug?: string | null } | null)?.clientSlug === "string" ? String((user as { clientSlug?: string | null }).clientSlug) : null;
  const nonGlobalRedirect = user?.isGlobalAdmin ? "/admin/home" : clientSlug ? `/empresas/${encodeURIComponent(clientSlug)}/home` : "/empresas";

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
