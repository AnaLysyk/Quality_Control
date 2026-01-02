"use client";

import { useParams } from "next/navigation";
import ApplicationsPage from "@/applications/page";

export default function EmpresaAplicacoesPage() {
  const params = useParams();
  const slug = (params?.slug as string) || "empresa";

  return (
    <div className="min-h-screen bg-[var(--page-bg,#ffffff)] text-[var(--page-text,#0b1a3c)]">
      <div className="px-6 pt-6 md:px-10 md:pt-10 space-y-2">
        <nav className="text-xs text-[var(--tc-text-muted,#6B7280)]">
          <span>Empresas</span>
          <span className="mx-1">/</span>
          <span className="font-semibold text-[var(--tc-text-primary,#0b1a3c)] uppercase">{slug}</span>
          <span className="mx-1">/</span>
          <span className="text-[var(--tc-text-secondary,#4B5563)]">Aplicações</span>
        </nav>
        <h1 className="text-3xl md:text-4xl font-extrabold text-[var(--tc-text-primary,#0b1a3c)]">
          Aplicações da empresa
        </h1>
        <p className="text-sm text-[var(--tc-text-secondary,#4B5563)]">
          Listagem de aplicações no contexto da empresa — como era anteriormente.
        </p>
      </div>
      <div className="mt-4">
        <ApplicationsPage />
      </div>
    </div>
  );
}
