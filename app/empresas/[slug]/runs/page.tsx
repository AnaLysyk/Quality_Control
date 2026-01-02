"use client";

import { useParams } from "next/navigation";
import ReleasesPage from "@/release/page";

export default function EmpresaRunsPage() {
  const params = useParams();
  const slug = (params?.slug as string) || "";

  return (
    <div className="min-h-screen bg-[var(--page-bg,#ffffff)] text-[var(--page-text,#0b1a3c)]">
      <div className="px-6 pt-6 md:px-10 md:pt-10 space-y-3">
        <nav className="text-xs text-[var(--tc-text-muted,#6B7280)]">
          <span>Empresas</span> <span className="mx-1">/</span>
          <span className="font-semibold text-[var(--tc-text-primary,#0b1a3c)] uppercase">{slug}</span>{" "}
          <span className="mx-1">/</span>
          <span>Runs</span>
        </nav>
        <h1 className="text-2xl md:text-3xl font-extrabold text-[var(--tc-text-primary,#0b1a3c)]">
          Runs — {slug}
        </h1>
        <p className="text-sm text-[var(--tc-text-secondary,#4B5563)]">
          Lista completa de runs desta empresa. Clique para ver detalhes, graficos e impressao.
        </p>
      </div>
      <ReleasesPage />
    </div>
  );
}
