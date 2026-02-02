"use client";

import { ReactNode, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthUser } from "@/hooks/useAuthUser";
import { AuthSkeleton } from "@/components/AuthSkeleton";

type RequireAuthProps = {
  children: ReactNode;
  fallback?: ReactNode;
};

export function RequireAuth({ children, fallback }: RequireAuthProps) {
  const { user, loading } = useAuthUser();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      router.replace(`/login?next=${encodeURIComponent(pathname || "/")}`);
    }
  }, [loading, user, router, pathname]);

  if (loading) {
    return (fallback as ReactNode) ?? <AuthSkeleton message="Validando sessao..." />;
  }
  if (!user) return (fallback as ReactNode) ?? null;

  return <>{children}</>;
}
