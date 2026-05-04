"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { CompanySelector } from "../components/CompanySelector";
import { useClientContext } from "@/context/ClientContext";
import { useAuthUser } from "@/hooks/useAuthUser";
import { buildCompanyPathForAccess } from "@/lib/companyRoutes";

export default function HomePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuthUser();
  const { activeClientSlug, clients, loading: clientsLoading } = useClientContext();
  const routeInput = useMemo(
    () => ({
      isGlobalAdmin: user?.isGlobalAdmin === true,
      permissionRole: user?.permissionRole ?? null,
      role: user?.role ?? null,
      companyRole: user?.companyRole ?? null,
      userOrigin:
        (user as { userOrigin?: string | null } | null)?.userOrigin ??
        (user as { user_origin?: string | null } | null)?.user_origin ??
        null,
      companyCount: clients.length,
      clientSlug: activeClientSlug ?? user?.clientSlug ?? null,
      defaultClientSlug: user?.defaultClientSlug ?? null,
    }),
    [activeClientSlug, clients.length, user],
  );

  useEffect(() => {
    if (authLoading || clientsLoading) return;
    if (activeClientSlug) {
      router.replace(buildCompanyPathForAccess(activeClientSlug, "aplicacoes", routeInput));
    }
  }, [authLoading, clientsLoading, activeClientSlug, routeInput, router]);

  return (
    <div className="min-h-screen bg-(--page-bg,#ffffff) text-(--page-text,#0b1a3c)">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-10 py-8 md:py-10 space-y-8">
        <CompanySelector
          title="Empresas vinculadas"
          description="Selecione a empresa para abrir a visão de aplicações e releases."
          buildHref={(company) =>
            buildCompanyPathForAccess(company.clientSlug, "aplicacoes", {
              ...routeInput,
              clientSlug: company.clientSlug,
            })
          }
          ctaLabel={(company) => (company.role === "ADMIN" ? "Entrar como admin" : "Acessar")}
        />
      </div>
    </div>
  );
}
