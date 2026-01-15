"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuthUser } from "@/hooks/useAuthUser";

import { CompanySelector } from "../components/CompanySelector";

export default function EmpresasIndexPage() {
  const router = useRouter();
  const { user, loading } = useAuthUser();

  const isAdmin = useMemo(() => {
    const role = typeof user?.role === "string" ? user.role.toLowerCase() : "";
    return user?.isGlobalAdmin === true || role === "admin" || role === "global_admin";
  }, [user]);

  useEffect(() => {
    if (loading) return;
    if (!user) return;
    if (isAdmin) return;
    const slug = typeof user.clientSlug === "string" ? user.clientSlug.trim() : "";
    if (!slug) return;
    router.replace(`/empresas/${encodeURIComponent(slug)}/home`);
  }, [loading, user, isAdmin, router]);

  if (!loading && user && !isAdmin && (user.clientSlug ?? "")) {
    return null;
  }

  return (
    <div className="min-h-screen bg-linear-to-b from-[#0a1533] via-[#0f1f4b] to-[#0a1533] px-4 py-12">
      <div className="mx-auto max-w-5xl space-y-10 text-white">
        <header className="space-y-2 text-center">
          <p className="text-xs uppercase tracking-[0.5em] text-indigo-200">Empresas</p>
          <h1 className="text-3xl font-bold">Selecione a empresa ativa</h1>
          <p className="text-sm text-indigo-200/80">
            Os módulos do painel só carregam dados para empresas vinculadas. Escolha uma empresa para continuar.
          </p>
        </header>

        <div className="rounded-[28px] bg-white/10 p-8 backdrop-blur">
          <CompanySelector
            title="Empresas disponíveis"
            description="Acesse o hub completo de cada empresa, incluindo releases, runs e defeitos."
            buildHref={(company) => `/empresas/${encodeURIComponent(company.clientSlug)}/home`}
            ctaLabel={(company) => (company.role === "ADMIN" ? "Gerenciar" : "Entrar")}
            accent="dark"
          />
        </div>
      </div>
    </div>
  );
}
