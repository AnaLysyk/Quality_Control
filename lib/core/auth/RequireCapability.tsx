"use client";

import { ReactNode, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthUser } from "@/hooks/useAuthUser";
import { hasCapability, type Capability } from "@/lib/permissions";
import { AuthSkeleton } from "@/components/AuthSkeleton";

type RequireCapabilityProps = {
  capability: Capability;
  children: ReactNode;
  fallback?: ReactNode;
};

export function RequireCapability({ capability, children, fallback }: RequireCapabilityProps) {
  const { user, loading } = useAuthUser();
  const router = useRouter();
  const pathname = usePathname();

  const capabilities = (Array.isArray(user?.capabilities) ? user?.capabilities : []) as Capability[];
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
