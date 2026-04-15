"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuthUser } from "@/hooks/useAuthUser";
import { normalizeLegacyRole, SYSTEM_ROLES } from "@/lib/auth/roles";
import { COMPANY_ROUTE_PREFIXES } from "@/lib/companyRoutes";

export function TechnicalSupportHomeGuard() {
  const { user, loading } = useAuthUser();
  const router = useRouter();
  const params = useParams();

  useEffect(() => {
    if (loading || !user) return;
    const role =
      normalizeLegacyRole(user.permissionRole) ??
      normalizeLegacyRole(user.role) ??
      normalizeLegacyRole(user.companyRole);
    if (role !== SYSTEM_ROLES.TECHNICAL_SUPPORT) return;
    const slug = typeof params?.slug === "string" ? params.slug : Array.isArray(params?.slug) ? params.slug[0] : null;
    if (!slug) return;
    router.replace(`/${COMPANY_ROUTE_PREFIXES.technical_support}/${encodeURIComponent(slug)}/dashboard`);
  }, [loading, user, router, params]);

  return null;
}
