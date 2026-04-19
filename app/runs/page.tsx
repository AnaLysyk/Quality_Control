"use client";

export const dynamic = "force-dynamic";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { CompanySelector } from "../components/CompanySelector";
import { useAuthUser } from "@/hooks/useAuthUser";
import { useClientContext } from "@/context/ClientContext";
import { buildCompanyPathForAccess } from "@/lib/companyRoutes";
import { isInstitutionalCompanyAccount } from "@/lib/activeIdentity";

export default function RunsIndexPage() {
  const router = useRouter();
  const { user } = useAuthUser();
  const { clients } = useClientContext();
  const institutionalCompanyContext = isInstitutionalCompanyAccount(user ?? null);
  const moduleLabel = "Runs";
  const pageTitle = "Selecione a empresa";
  const pageDescription = "As execuções de testes ficam organizadas por empresa. Escolha abaixo para abrir o hub de runs correspondente.";
  const selectorTitle = "Empresas com runs";
  const selectorDescription = "Acesso rápido às execuções mais recentes, métricas e histórico de resultados.";
  const fallbackClientSlug = clients[0]?.slug ?? null;
  const companySlug = user?.clientSlug ?? user?.defaultClientSlug ?? fallbackClientSlug;
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
    defaultClientSlug: user?.defaultClientSlug ?? null,
  };

  useEffect(() => {
    if (!institutionalCompanyContext || !companySlug) return;
    router.replace(
      buildCompanyPathForAccess(companySlug, "runs", {
        ...routeInput,
        clientSlug: companySlug,
      }),
    );
  }, [companySlug, institutionalCompanyContext, router, routeInput]);

  if (institutionalCompanyContext && companySlug) {
    return (
      <div className="min-h-screen bg-(--page-bg,#ffffff) text-(--page-text,#0b1a3c) px-4 sm:px-6 md:px-10 py-8 md:py-10">
        <div className="mx-auto flex max-w-5xl flex-col gap-2">
          <p className="text-xs uppercase tracking-[0.5em] text-(--tc-accent)">{moduleLabel}</p>
          <h1 className="text-2xl font-bold">Abrindo contexto da empresa...</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-(--page-bg,#ffffff) text-(--page-text,#0b1a3c) px-4 sm:px-6 md:px-10 py-8 md:py-10">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.5em] text-(--tc-accent)">{moduleLabel}</p>
          <h1 className="text-3xl font-bold">{pageTitle}</h1>
          <p className="text-sm text-(--tc-text-secondary,#4b5563)">{pageDescription}</p>
        </header>

        <CompanySelector
          title={selectorTitle}
          description={selectorDescription}
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
