"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuthUser } from "@/hooks/useAuthUser";
import { useClientContext } from "@/context/ClientContext";
import { buildCompanyPathForAccess } from "@/lib/companyRoutes";

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
  const routeInput = useMemo(
    () => ({
      isGlobalAdmin: user?.isGlobalAdmin === true,
      permissionRole: user?.permissionRole ?? null,
      role: user?.role ?? null,
      companyRole: user?.companyRole ?? null,
      userOrigin:
        (user as { userOrigin?: string | null } | null)?.userOrigin ??
        (user as { user_origin?: string | null } | null)?.user_origin ??
        null,
      companyCount: clients.length,
      clientSlug: activeClientSlug ?? user?.clientSlug ?? null,
    }),
    [activeClientSlug, clients.length, user],
  );

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace("/login?next=%2Fmetricas");
      return;
    }

    if (activeClientSlug) {
      router.replace(buildCompanyPathForAccess(activeClientSlug, "metrics", routeInput));
      return;
    }

    if (clients.length === 1) {
      setActiveClientSlug(clients[0].slug);
      router.replace(
        buildCompanyPathForAccess(clients[0].slug, "metrics", {
          ...routeInput,
          clientSlug: clients[0].slug,
        }),
      );
      return;
    }

    // No active company selected; keep the page rendered to allow choosing one.
  }, [isLoading, user, activeClientSlug, clients, routeInput, router, setActiveClientSlug]);

  if (isLoading) return null;

  if (!user) return null;

  if (activeClientSlug) return null;

  return (
    <div className="min-h-screen bg-(--page-bg,#ffffff) text-(--page-text,#0b1a3c)">
      <div className="mx-auto w-full max-w-3xl px-4 pt-6 sm:px-6 sm:pt-10">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-(--tc-text-primary,#0b1a3c)">Métricas</h1>
        <p className="mt-2 text-sm sm:text-base text-(--tc-text-secondary,#4b5563)">
          Selecione uma empresa para ver as métricas por aplicação.
        </p>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          {clients.length === 0 ? (
            <p className="text-sm text-(--tc-text-secondary,#4b5563)">
              Nenhuma empresa vinculada/selecionável para este usuário.
            </p>
          ) : (
            <div className="grid gap-3">
              {clients.map((client) => (
                <button
                  key={client.slug}
                  type="button"
                  className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-left hover:bg-slate-50"
                  onClick={() => {
                    setActiveClientSlug(client.slug);
                    router.push(
                      buildCompanyPathForAccess(client.slug, "metrics", {
                        ...routeInput,
                        clientSlug: client.slug,
                      }),
                    );
                  }}
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900 truncate">{client.name}</div>
                    <div className="text-xs text-slate-500 truncate">{client.slug}</div>
                  </div>
                  <div className="text-xs font-semibold text-[#2563eb]">Abrir</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
