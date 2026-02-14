"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { CompanySelector } from "../components/CompanySelector";
import { useClientContext } from "@/context/ClientContext";

export default function ApplicationsPage() {
  const router = useRouter();
  const { activeClientSlug, loading: clientsLoading } = useClientContext();
  // Track navigation to prevent double replace
  useEffect(() => {
    if (clientsLoading) return;
    if (activeClientSlug) {
      router.replace(`/empresas/${encodeURIComponent(String(activeClientSlug))}/aplicacoes`);
    }
  }, [clientsLoading, activeClientSlug, router]);

  // Error boundary for context failures
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
        title="Escolha uma empresa"
        description="As aplicações listadas estarão disponíveis após selecionar a empresa."
        buildHref={(company) => `/empresas/${encodeURIComponent(String(company.clientSlug))}/aplicacoes`}
        ctaLabel={(company) => (company.role === "ADMIN" ? "Gerenciar aplicações" : "Ver aplicações")}
        data-testid="company-selector"
      />
    );
  }

  return (
    <div className="min-h-screen bg-(--page-bg,#ffffff) text-(--page-text,#0b1a3c) px-4 sm:px-6 md:px-10 py-8 md:py-10" data-testid="applications-page">
      <div className="mx-auto flex max-w-6xl flex-col gap-12">
        {content}
      </div>
    </div>
  );
}





