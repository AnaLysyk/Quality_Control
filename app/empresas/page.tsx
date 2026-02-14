"use client";

import { useMemo } from "react";
import { useAuthUser } from "@/hooks/useAuthUser";

import { CompanySelector } from "../components/CompanySelector";

export default function EmpresasIndexPage() {
  const { user, loading } = useAuthUser();

  const { isPrivileged, headerCopy } = useMemo(() => {
    const normalizedRole = typeof user?.role === "string" ? user.role.toLowerCase() : "";
    const normalizedGlobalRole = typeof user?.globalRole === "string" ? user.globalRole.toLowerCase() : "";
    const privileged =
      user?.isGlobalAdmin === true ||
      normalizedRole === "admin" ||
      normalizedRole === "global_admin" ||
      normalizedRole === "it_dev" ||
      normalizedGlobalRole === "global_admin";

    const description = privileged
      ? "Admin e Dev podem alternar entre todas as empresas cadastradas."
      : "Visualize e acesse apenas as empresas vinculadas ao seu perfil.";

    return {
      isPrivileged: privileged,
      headerCopy: {
        title: privileged ? "Selecione a empresa para gerenciar" : "Selecione uma empresa vinculada",
        description,
      },
    } as const;
  }, [user]);

  return (
    <div className="min-h-screen bg-(--page-bg) text-(--page-text) px-4 py-12">
      <div className="mx-auto max-w-5xl space-y-10">
        <header className="space-y-2 text-center">
          <p className="text-xs uppercase tracking-[0.5em] text-(--tc-accent)">Empresas</p>
          <h1 className="text-3xl font-bold">{headerCopy.title}</h1>
          <p className="text-sm text-(--tc-text-muted)">{headerCopy.description}</p>
        </header>

        <div className="rounded-[28px] border border-(--tc-border) bg-(--tc-surface) p-8 shadow-[0_20px_55px_rgba(15,23,42,0.12)]">
          <CompanySelector
            title="Empresas disponíveis"
            description="Acesse o hub completo de cada empresa, incluindo releases, runs e defeitos."
            buildHref={(company) => `/empresas/${encodeURIComponent(company.clientSlug)}/home`}
            ctaLabel={(company) => (company.role === "ADMIN" ? "Gerenciar" : "Entrar")}
          />

          {!loading && user && !isPrivileged && (
            <p className="mt-6 text-xs text-(--tc-text-secondary)">
              Precisa de acesso a outra empresa? Solicite a um administrador para ser vinculado.
            </p>
          )}

          {!loading && !user && (
            <p className="mt-6 text-xs text-(--tc-text-secondary)">
              Faça login para visualizar as empresas disponíveis para o seu perfil.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
