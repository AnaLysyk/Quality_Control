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
      router.replace(`/empresas/${encodeURIComponent(activeClientSlug)}/aplicacoes`);
    }
  }, [clientsLoading, activeClientSlug, router]);

  return (
    <div className="min-h-screen bg-(--page-bg,#ffffff) text-(--page-text,#0b1a3c)">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-10 py-8 md:py-10 space-y-8">
        <CompanySelector
          title="Empresas vinculadas"
          description="Selecione a empresa para abrir a visao de aplicacoes e releases."
          buildHref={(company) => `/empresas/${encodeURIComponent(company.clientSlug)}/aplicacoes`}
          ctaLabel={(company) => (company.role === "ADMIN" ? "Entrar como admin" : "Acessar")}
        />
      </div>
    </div>
  );
}

