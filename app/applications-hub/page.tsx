"use client";

import { ApplicationsList } from "./ApplicationsList";
import { CompanySelector } from "../components/CompanySelector";

export default function ApplicationsPage() {
  return (
    <div className="min-h-screen bg-(--page-bg,#ffffff) text-(--page-text,#0b1a3c) px-4 sm:px-6 md:px-10 py-8 md:py-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-12">
        <CompanySelector
          title="Escolha uma empresa"
          description="As aplicações listadas abaixo refletem os produtos disponíveis para a empresa selecionada."
          buildHref={(company) => `/empresas/${encodeURIComponent(company.clientSlug)}/aplicacoes`}
          ctaLabel={(company) => (company.role === "ADMIN" ? "Gerenciar aplicações" : "Ver aplicações")}
        />

        <div className="space-y-3">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.5em] text-(--tc-accent)">Aplicações</p>
            <h2 className="text-2xl font-bold">Visão geral</h2>
            <p className="text-sm text-(--tc-text-secondary,#4b5563)">
              Lista consolidada das aplicações suportadas. Use os cards acima para filtrar por empresa.
            </p>
          </div>

          <ApplicationsList />
        </div>
      </div>
    </div>
  );
}





