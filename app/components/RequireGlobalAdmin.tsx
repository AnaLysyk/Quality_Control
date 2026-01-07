"use client";

import { ReactNode, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthUser } from "@/hooks/useAuthUser";
import { AuthSkeleton } from "./AuthSkeleton";

type RequireGlobalAdminProps = {
  children: ReactNode;
  fallback?: ReactNode;
};

export function RequireGlobalAdmin({ children, fallback }: RequireGlobalAdminProps) {
  const { user, loading } = useAuthUser();
  const router = useRouter();
  const pathname = usePathname();
  const isAdmin =
    user?.role === "admin" ||
    user?.role === "global_admin" ||
    user?.isGlobalAdmin === true ||
    (user as any)?.is_global_admin === true;

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(pathname || "/")}`);
      return;
    }
    if (!isAdmin) {
      router.replace("/login");
    }
  }, [loading, user, isAdmin, router, pathname]);

  if (loading) {
    return (fallback as ReactNode) ?? <AuthSkeleton message="Validando sessao..." />;
  }
  if (!user || !isAdmin) {
    return (fallback as ReactNode) ?? null;
  }

  return <>{children}</>;
}
