"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { CompanySelector } from "../components/CompanySelector";
import { useClientContext } from "@/context/ClientContext";

export default function ApplicationsPage() {
  const router = useRouter();
  const { activeClientSlug, loading: clientsLoading } = useClientContext();

  useEffect(() => {
    if (clientsLoading) return;
    if (activeClientSlug) {
      router.replace(`/empresas/${encodeURIComponent(activeClientSlug)}/aplicacoes`);
    }
  }, [clientsLoading, activeClientSlug, router]);

  return (
    <div className="min-h-screen bg-(--page-bg,#ffffff) text-(--page-text,#0b1a3c) px-4 sm:px-6 md:px-10 py-8 md:py-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-12">
        <CompanySelector
          title="Escolha uma empresa"
          description="As aplicações listadas estarão disponíveis após selecionar a empresa."
          buildHref={(company) => `/empresas/${encodeURIComponent(company.clientSlug)}/aplicacoes`}
          ctaLabel={(company) => (company.role === "ADMIN" ? "Gerenciar aplicações" : "Ver aplicações")}
        />
      </div>
    </div>
  );
}





