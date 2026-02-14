"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthUser } from "@/hooks/useAuthUser";
import { useClientContext } from "@/context/ClientContext";

export default function MetricasPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuthUser();
  const {
    clients,
    activeClientSlug,
    setActiveClientSlug,
    loading: clientsLoading,
  } = useClientContext();

  const isLoading = authLoading || clientsLoading;

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace("/login?next=%2Fmetricas");
      return;
    }

    if (activeClientSlug) {
      router.replace(`/empresas/${encodeURIComponent(activeClientSlug)}/metrics`);
      return;
    }

    if (clients.length === 1) {
      setActiveClientSlug(clients[0].slug);
      router.replace(`/empresas/${encodeURIComponent(clients[0].slug)}/metrics`);
      return;
    }

    // No active company selected; keep the page rendered to allow choosing one.
  }, [isLoading, user, activeClientSlug, clients, router, setActiveClientSlug]);

  if (isLoading) return null;

  if (!user) return null;

  if (activeClientSlug) return null;

  return (
    <div className="min-h-screen bg-[--tc-surface,#fff] text-[--tc-text,#0b1a3c]">
      <div className="mx-auto w-full max-w-3xl px-4 pt-6 sm:px-6 sm:pt-10">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[--tc-text-primary,#0b1a3c]">Métricas</h1>
        <p className="mt-2 text-sm sm:text-base text-[--tc-text-secondary,#4b5563]">
          Selecione uma empresa para ver as métricas por aplicação.
        </p>

        <div className="mt-6 rounded-2xl border border-[--tc-border,#e5e7eb] bg-[--tc-surface,#fff] p-4 shadow-sm">
          {clients.length === 0 ? (
            <p className="text-sm text-[--tc-text-secondary,#4b5563]">
              Nenhuma empresa vinculada/selecionável para este usuário.
            </p>
          ) : (
            <div className="grid gap-3">
              {clients.map((client) => (
                <button
                  key={client.slug}
                  type="button"
                  className="flex items-center justify-between rounded-xl border border-[--tc-border,#e5e7eb] px-4 py-3 text-left hover:bg-[--tc-surface-hover,#f8fafc]"
                  onClick={() => {
                    setActiveClientSlug(client.slug);
                    router.push(`/empresas/${encodeURIComponent(client.slug)}/metrics`);
                  }}
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-[--tc-text,#0b1a3c] truncate">{client.name}</div>
                    <div className="text-xs text-[--tc-text-secondary,#4b5563] truncate">{client.slug}</div>
                  </div>
                  <div className="text-xs font-semibold text-[--tc-link,#2563eb]">Abrir</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
