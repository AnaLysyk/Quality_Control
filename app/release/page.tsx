"use client";

import { CompanySelector } from "../components/CompanySelector";
import { ReleasesList } from "./ReleasesList";
import { useAuthUser } from "@/hooks/useAuthUser";
import { useClientContext } from "@/context/ClientContext";
import { buildCompanyPathForAccess } from "@/lib/companyRoutes";

export default function ReleasesPage() {
  const { user } = useAuthUser();
  const { clients } = useClientContext();
  const routeInput = {
    isGlobalAdmin: user?.isGlobalAdmin === true,
    permissionRole: user?.permissionRole ?? null,
    role: user?.role ?? null,
    companyRole: user?.companyRole ?? null,
    userOrigin:
      (user as { userOrigin?: string | null } | null)?.userOrigin ??
      (user as { user_origin?: string | null } | null)?.user_origin ??
      null,
    companyCount: clients.length,
    clientSlug: user?.clientSlug ?? null,
  };

  return (
    <div className="min-h-screen bg-(--page-bg,#ffffff) text-(--page-text,#0b1a3c) px-4 sm:px-6 md:px-10 py-8 md:py-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-12">
        <CompanySelector
          title="Escolha uma empresa"
          description="As runs disponíveis são filtradas pela empresa selecionada."
          buildHref={(company) =>
            buildCompanyPathForAccess(company.clientSlug, "releases", {
              ...routeInput,
              clientSlug: company.clientSlug,
            })
          }
          ctaLabel={(company) => (company.role === "ADMIN" ? "Gerenciar runs" : "Ver runs")}
        />

        <ReleasesList className="rounded-2xl bg-white/95 p-6 shadow-xl" />
      </div>
    </div>
  );
}
