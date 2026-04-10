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
  const role = (user?.role ?? "").toLowerCase();
  const permissionRole = (user?.permissionRole ?? "").toLowerCase();
  const companyRole = (user?.companyRole ?? "").toLowerCase();

  const isGlobalDeveloper = role === "it_dev" || permissionRole === "dev" || companyRole === "it_dev";
  const isSupport = role === "support" || role === "technical_support" || role === "tech_support" || role === "support_tech" || permissionRole === "support" || companyRole === "support";

  return isGlobalDeveloper || isSupport;
}

export function RequireAccessRequestReviewer({ children, fallback }: RequireAccessRequestReviewerProps) {
  const { user, loading } = useAuthUser();
  const router = useRouter();
  const pathname = usePathname();

  const allowed = isReviewerUser(user);
  const clientSlug = typeof (user as { clientSlug?: string | null } | null)?.clientSlug === "string" ? String((user as { clientSlug?: string | null }).clientSlug) : null;
  const nonGlobalRedirect = user?.isGlobalAdmin ? "/admin/home" : clientSlug ? `/empresas/${encodeURIComponent(clientSlug)}/home` : "/empresas";
  const deniedFallback =
    fallback ?? (
      <div className="p-8 text-center text-lg">
        <p>Acesso restrito aos revisores de solicitações.</p>
      </div>
    );

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(pathname || "/")}`);
      return;
    }
    if (!allowed) {
      router.replace(nonGlobalRedirect);
    }
  }, [allowed, loading, nonGlobalRedirect, pathname, router, user]);

  if (loading) return fallback ?? <AuthSkeleton message="Validando sessao..." />;
  if (!user) return fallback ?? null;
  if (!allowed) return deniedFallback;
  return <>{children}</>;
}

export default RequireAccessRequestReviewer;
