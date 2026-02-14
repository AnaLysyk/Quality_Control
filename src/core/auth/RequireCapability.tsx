/**
 * RequireCapability: Client-side guard for capability-based access control.
 * Redirects to /login if not authenticated, or /403 if lacking capability.
 * Shows loading fallback or AuthSkeleton while validating access.
 */
"use client";

import { ReactNode, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthUser } from "@/hooks/useAuthUser";
import { hasCapability } from "@/lib/permissions";
import { AuthSkeleton } from "@/components/AuthSkeleton";

// Capability type is not exported from permissions, so define as string for now
type Capability = string;
type RequireCapabilityProps = {
  capability: Capability;
  children: ReactNode;
  fallback?: ReactNode;
};

/**
 * Auth guard for required capability. Redirects to login or 403 as needed.
 * @param capability - Required capability string
 * @param children - Content to render if allowed
 * @param fallback - Optional fallback while loading or if denied
 */
export function RequireCapability({ capability, children, fallback }: RequireCapabilityProps) {
  const { user, loading } = useAuthUser();
  const router = useRouter();
  const pathname = usePathname();

  const capabilities = (Array.isArray(user?.capabilities) ? user?.capabilities : []) as string[];
  const allowed = hasCapability(capabilities, capability) || user?.isGlobalAdmin === true || user?.globalRole === "global_admin";

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(pathname || "/")}`);
      return;
    }
    if (!allowed) {
      router.replace("/403");
    }
  }, [loading, user, allowed, router, pathname]);

  if (loading) {
    return (fallback as ReactNode) ?? <AuthSkeleton message="Validando acesso..." />;
  }
  if (!user) return (fallback as ReactNode) ?? null;
  if (!allowed) return (fallback as ReactNode) ?? null;
  return <>{children}</>;
}
