"use client";

import { CompanySelector } from "../components/CompanySelector";
import { useAuthUser } from "@/hooks/useAuthUser";
import { useClientContext } from "@/context/ClientContext";
import { buildCompanyPathForAccess } from "@/lib/companyRoutes";

export default function RunsIndexPage() {
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
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.5em] text-(--tc-accent)">Runs</p>
          <h1 className="text-3xl font-bold">Selecione a empresa</h1>
          <p className="text-sm text-(--tc-text-secondary,#4b5563)">
            As execuções de testes ficam organizadas por empresa. Escolha abaixo para abrir o hub de runs correspondente.
          </p>
        </header>

        <CompanySelector
          title="Empresas com runs"
          description="Acesso rápido às execuções mais recentes, métricas e histórico de resultados."
          buildHref={(company) =>
            buildCompanyPathForAccess(company.clientSlug, "runs", {
              ...routeInput,
              clientSlug: company.clientSlug,
            })
          }
          ctaLabel={(company) => (company.role === "ADMIN" ? "Gerenciar runs" : "Ver runs")}
        />
      </div>
    </div>
  );
}
