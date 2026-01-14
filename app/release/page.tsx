"use client";

import { CompanySelector } from "../components/CompanySelector";
import { ReleasesList } from "./ReleasesList";

export default function ReleasesPage() {
  return (
    <div className="min-h-screen bg-(--page-bg,#ffffff) text-(--page-text,#0b1a3c) px-4 sm:px-6 md:px-10 py-8 md:py-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-12">
        <CompanySelector
          title="Escolha uma empresa"
          description="As runs disponíveis são filtradas pela empresa selecionada."
          buildHref={(company) => `/empresas/${encodeURIComponent(company.clientSlug)}/releases`}
          ctaLabel={(company) => (company.role === "ADMIN" ? "Gerenciar runs" : "Ver runs")}
        />

        <ReleasesList className="rounded-2xl bg-white/95 p-6 shadow-xl" />
      </div>
    </div>
  );
}
