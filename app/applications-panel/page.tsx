"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { CompanySelector } from "../components/CompanySelector";
import { useClientContext } from "@/context/ClientContext";

export default function HomePage() {
  const router = useRouter();
  const { activeClientSlug, loading: clientsLoading } = useClientContext();

  useEffect(() => {
    if (clientsLoading) return;
    if (activeClientSlug) {
      router.replace(`/empresas/${encodeURIComponent(String(activeClientSlug))}/aplicacoes`);
    }
  }, [clientsLoading, activeClientSlug, router]);

  let content: React.ReactNode;
  if (clientsLoading) {
    content = (
      <div className="flex items-center justify-center min-h-[40vh]" role="status" aria-live="polite" data-testid="company-loading">
        <span className="text-gray-500 text-lg">Carregando empresas...</span>
      </div>
    );
  } else {
    content = (
      <CompanySelector
        title="Empresas vinculadas"
        description="Selecione a empresa para abrir a visao de aplicacoes e releases."
        buildHref={(company) => `/empresas/${encodeURIComponent(String(company.clientSlug))}/aplicacoes`}
        ctaLabel={(company) => (company.role === "ADMIN" ? "Entrar como admin" : "Acessar")}
        data-testid="company-selector"
      />
    );
  }

  return (
    <div className="min-h-screen bg-(--page-bg,#ffffff) text-(--page-text,#0b1a3c)" data-testid="applications-panel-page">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-10 py-8 md:py-10 space-y-8">
        {content}
      </div>
    </div>
  );
}

