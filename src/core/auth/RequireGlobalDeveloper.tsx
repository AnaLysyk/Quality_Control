"use client";

import { ReactNode, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import { AuthSkeleton } from "@/components/AuthSkeleton";
import { useAuthUser } from "@/hooks/useAuthUser";

type RequireGlobalDeveloperProps = {
  children: ReactNode;
  fallback?: ReactNode;
};

function isGlobalDeveloperUser(
  user?: {
    role?: string | null;
    permissionRole?: string | null;
    companyRole?: string | null;
  } | null,
) {
  const role = (user?.role ?? "").toLowerCase();
  const permissionRole = (user?.permissionRole ?? "").toLowerCase();
  const companyRole = (user?.companyRole ?? "").toLowerCase();
  return role === "it_dev" || permissionRole === "dev" || companyRole === "it_dev";
}

export function RequireGlobalDeveloper({ children, fallback }: RequireGlobalDeveloperProps) {
  const { user, loading } = useAuthUser();
  const router = useRouter();
  const pathname = usePathname();

  const isGlobalDeveloper = isGlobalDeveloperUser(user);
  const clientSlug =
    typeof (user as { clientSlug?: string | null } | null)?.clientSlug === "string"
      ? String((user as { clientSlug?: string | null }).clientSlug)
      : null;
  const nonGlobalRedirect = user?.isGlobalAdmin ? "/admin/home" : clientSlug ? `/empresas/${encodeURIComponent(clientSlug)}/home` : "/empresas";
  const deniedFallback =
    fallback ?? (
      <div className="p-8 text-center text-lg">
        <p>Acesso restrito ao perfil Global.</p>
      </div>
    );

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(pathname || "/")}`);
      return;
    }
    if (!isGlobalDeveloper) {
      router.replace(nonGlobalRedirect);
    }
  }, [isGlobalDeveloper, loading, nonGlobalRedirect, pathname, router, user]);

  if (loading) {
    return fallback ?? <AuthSkeleton message="Validando sessao..." />;
  }

  if (!user) {
    return fallback ?? null;
  }

  if (!isGlobalDeveloper) {
    return deniedFallback;
  }

  return <>{children}</>;
}
