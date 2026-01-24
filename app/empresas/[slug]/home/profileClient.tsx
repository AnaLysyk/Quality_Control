"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useAuthUser } from "@/hooks/useAuthUser";
import CompanyTeamManager from "./teamManager";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

export default function CompanyProfileClient({
  clientId,
  clientSlug,
  clientName,
}: {
  clientId: string;
  clientSlug: string;
  clientName: string;
}) {
  const { user, loading } = useAuthUser();

  const canManage = useMemo(() => {
    if (!user) return false;
    const legacyIsGlobalAdmin = asRecord(user)?.is_global_admin === true;
    const role = typeof asRecord(user)?.role === "string" ? String(asRecord(user)?.role) : "";
    // Only global admins can manage team membership (link/unlink users).
    return !!user.isGlobalAdmin || legacyIsGlobalAdmin || ["admin", "global_admin"].includes(role);
  }, [user]);

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr] lg:items-start">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.35em] text-(--tc-text-muted)">Empresa</p>
            <h1
              className="text-2xl sm:text-3xl font-extrabold text-white truncate"
              title={clientName}
              aria-label={`Perfil da empresa ${clientName}`}
            >
              {clientName}
            </h1>
            <p className="text-sm text-(--tc-text-secondary)">Slug: {clientSlug}</p>
            {loading ? (
              <p className="text-sm text-(--tc-text-muted)">Carregando permissões...</p>
            ) : !user ? (
              <p className="text-sm text-(--tc-text-muted)">Você não está autenticado.</p>
            ) : (
              <p className="text-xs text-(--tc-text-muted)">
                Ações administrativas {canManage ? "habilitadas" : "restritas"}.
              </p>
            )}
          </div>

          <div className="flex flex-col items-start gap-3 sm:flex-row sm:justify-end">
            <Link
              href={`/empresas/${encodeURIComponent(clientSlug)}/dashboard`}
              className="w-full rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-center text-sm font-semibold text-white/90 hover:bg-white/15 transition focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Ir para dashboard
            </Link>
            {canManage && (
              <Link
                href={`/admin/defeitos?empresa=${encodeURIComponent(clientSlug)}`}
                className="w-full rounded-lg border border-transparent bg-(--tc-accent,#ef0001) px-3 py-2 text-center text-sm font-semibold text-white shadow hover:shadow-lg transition focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Ações rápidas
              </Link>
            )}
          </div>
        </div>
      </header>

      <section
        className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4"
        aria-label="Equipe da empresa"
      >
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Equipe</h2>
            <p className="text-sm text-(--tc-text-secondary)">Admins e usuários vinculados a esta empresa.</p>
          </div>
          <p className="text-xs text-(--tc-text-muted)">
            A lista se organiza automaticamente e respeita permissões de acesso atuais.
          </p>
        </div>

        <CompanyTeamManager clientId={clientId} canManage={canManage} />
      </section>
    </div>
  );
}
