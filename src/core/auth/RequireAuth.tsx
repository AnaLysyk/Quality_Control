/**
 * RequireAuth: Client-side auth guard for protected routes/components.
 * Redirects to /login if not authenticated, preserving intended destination.
 * Shows loading fallback or AuthSkeleton while validating session.
 */
"use client";

import { ReactNode, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthUser } from "@/hooks/useAuthUser";
import { AuthSkeleton } from "@/components/AuthSkeleton";

type RequireAuthProps = {
  children: ReactNode;
  fallback?: ReactNode;
};

/**
 * Auth guard component. Redirects to login if not authenticated.
 * @param children - Content to render if authenticated
 * @param fallback - Optional fallback while loading or if unauthenticated
 */
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
