"use client";


import { Suspense } from "react";
import { CompanySelector } from "../components/CompanySelector";

export default function RunsIndexPage() {
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

        <Suspense fallback={<div className="text-sm text-(--tc-text-muted) mt-4">Carregando empresas...</div>}>
          <CompanySelector
            title="Empresas com runs"
            description="Acesso rápido às execuções mais recentes, métricas e histórico de resultados."
            buildHref={(company) => `/empresas/${encodeURIComponent(company.clientSlug)}/runs`}
            ctaLabel={(company) => (company.role === "ADMIN" ? "Gerenciar runs" : "Ver runs")}
          />
        </Suspense>
      </div>
    </div>
  );
}
