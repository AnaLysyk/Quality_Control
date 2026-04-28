"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuthUser } from "@/hooks/useAuthUser";
import { buildCompanyPathForAccess, resolveCompanyRouteAccessInput } from "@/lib/companyRoutes";

import { CompanySelector } from "../components/CompanySelector";

export default function EmpresasIndexPage() {
  const router = useRouter();
  const { user, loading, normalizedUser } = useAuthUser();

  const isAdmin = useMemo(() => {
    const role = typeof user?.role === "string" ? user.role.toLowerCase() : "";
    return user?.isGlobalAdmin === true || role === "leader_tc" || role === "technical_support";
  }, [user]);

  useEffect(() => {
    if (loading) return;
    if (!user) return;
    if (isAdmin) return;
    const slug = normalizedUser.primaryCompanySlug ?? "";
    if (!slug) return;
    router.replace(
      buildCompanyPathForAccess(
        slug,
        "home",
        resolveCompanyRouteAccessInput({
          user,
          normalizedUser,
          clientSlug: normalizedUser.primaryCompanySlug,
          companyCount: normalizedUser.companyCount,
        }),
      ),
    );
  }, [loading, user, isAdmin, normalizedUser, router]);

  if (!loading && user && !isAdmin && normalizedUser.primaryCompanySlug) {
    return null;
  }

  return (
    <div className="min-h-screen bg-(--page-bg,#eef2f7) text-(--page-text,#0b1a3c) px-4 py-12">
      <div className="mx-auto max-w-5xl space-y-10">
        <header className="space-y-2 text-center">
          <p className="text-xs uppercase tracking-[0.5em] text-(--tc-accent,#ef0001)">Empresas</p>
          <h1 className="text-3xl font-bold">Selecione a empresa ativa</h1>
          <p className="text-sm text-(--tc-text-muted,#6b7280)">
            Os módulos do painel só carregam dados para empresas vinculadas. Escolha uma empresa para continuar.
          </p>
        </header>

        <div className="rounded-[28px] border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#ffffff) p-8 shadow-[0_20px_55px_rgba(15,23,42,0.12)]">
          <CompanySelector
            title="Empresas disponíveis"
            description="Acesse o hub completo de cada empresa, incluindo releases, runs e defeitos."
            buildHref={(company) =>
              buildCompanyPathForAccess(
                company.clientSlug,
                "home",
                resolveCompanyRouteAccessInput({
                  user,
                  normalizedUser,
                  clientSlug: company.clientSlug,
                }),
              )
            }
            ctaLabel={(company) => (company.role === "ADMIN" ? "Gerenciar" : "Entrar")}
          />
        </div>
      </div>
    </div>
  );
}
