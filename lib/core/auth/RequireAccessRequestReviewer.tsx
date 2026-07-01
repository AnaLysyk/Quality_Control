"use client";

import { ReactNode, useEffect, useState } from "react";
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
  if (!user) return false;

  const roles = [
    normalizeLegacyRole(user.role),
    normalizeLegacyRole(user.permissionRole),
    normalizeLegacyRole(user.companyRole),
  ];

  return roles.some((role) => role === "leader_tc" || role === "technical_support" || role === "empresa");
}

export function RequireAccessRequestReviewer({ children, fallback }: RequireAccessRequestReviewerProps) {
  const [mounted, setMounted] = useState(false);
  const { user, loading } = useAuthUser();
  const router = useRouter();
  const pathname = usePathname();

  const allowed = isReviewerUser(user);
  const clientSlug = typeof (user as { clientSlug?: string | null } | null)?.clientSlug === "string" ? String((user as { clientSlug?: string | null }).clientSlug) : null;
  const nonGlobalRedirect = user?.isGlobalAdmin ? "/admin/dashboard" : clientSlug ? `/empresas/${encodeURIComponent(clientSlug)}/home` : "/empresas";

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setMounted(true), 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    if (!mounted || loading) return;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(pathname || "/")}`);
      return;
    }
    // usuÃ¡rio autenticado, mas sem permissÃ£o, permanece na pÃ¡gina com aviso de acesso restrito
    if (!allowed) {
      return;
    }
  }, [allowed, loading, mounted, nonGlobalRedirect, pathname, router, user]);

  if (!mounted || loading) return fallback ?? <AuthSkeleton message="Validando sessao..." />;
  if (!user) return fallback ?? null;
  if (!allowed) return (
    <div className="p-8 text-center text-lg">
      <p>Acesso restrito.</p>
    </div>
  );
  return <>{children}</>;
}

export default RequireAccessRequestReviewer;
