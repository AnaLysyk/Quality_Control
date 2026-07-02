"use client";

/**
 * ProfileContent â€” Loader e renderer da Profile Engine
 * ResponsÃ¡vel por: carregar contexto, validar permissÃµes, renderizar shell
 */

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ProfileShell,
  ProfileHeader,
  ProfileTabs,
  ProfileActions,
} from "@/components/profile";
import type { ProfileRuntimeContext, EntityType } from "@/lib/profile/types";

export default function ProfileContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [context, setContext] = useState<ProfileRuntimeContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [headerData, setHeaderData] = useState<any>(null);

  const entityType = (searchParams.get("type") || "user") as EntityType;
  const entityId = searchParams.get("id") || "self";

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        let targetId = entityId;
        if (entityId === "self") {
          const meResponse = await fetch("/api/me");
          if (!meResponse.ok) {
            router.push("/login");
            return;
          }
          const meData = await meResponse.json();
          targetId = meData?.user?.id;
          if (!targetId) {
            throw new Error("NÃ£o foi possÃ­vel resolver usuÃ¡rio atual");
          }
        }

        const endpoint = `/api/profile/${entityType}s/${targetId}`;

        const response = await fetch(endpoint);
        if (!response.ok) {
          const text = await response.text();
          throw new Error(`${response.status}: ${text}`);
        }

        const data = await response.json();
        setContext(data.context);
        setHeaderData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro desconhecido");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [entityType, entityId, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="mx-auto mb-2 h-8 w-8 animate-spin rounded-full border-4 border-(--tc-border) border-t-(--tc-accent)" />
          Carregando perfil...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-800 dark:border-red-400/40 dark:bg-red-950/30 dark:text-red-100">
          <h2 className="mb-2 font-semibold">Erro ao carregar perfil</h2>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!context || !headerData) {
    return (
      <div className="mx-auto max-w-2xl p-6">
<<<<<<< HEAD
        <div className="rounded-lg bg-yellow-50 p-6 text-yellow-800 border border-yellow-200">
          Contexto de perfil nÃ£o disponÃ­vel
=======
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-6 text-yellow-800 dark:border-yellow-400/40 dark:bg-yellow-950/30 dark:text-yellow-100">
          Contexto de perfil não disponível
>>>>>>> fix/governanca-perfis-rotas
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <ProfileShell
        context={context}
        header={
          <ProfileHeader
            title={headerData.name || headerData.id}
            subtitle={headerData.email || headerData.slug}
            status={headerData.status || "active"}
            mode={context.mode}
          />
        }
        tabs={
          <ProfileTabs defaultTab="overview">
            {{
              overview: <div className="p-4">VisÃ£o geral</div>,
              profile: <div className="p-4">Cadastro</div>,
              access: <div className="p-4">Acesso</div>,
              companies: <div className="p-4">Empresas</div>,
              users: <div className="p-4">UsuÃ¡rios</div>,
              applications: <div className="p-4">AplicaÃ§Ãµes</div>,
              integrations: <div className="p-4">IntegraÃ§Ãµes</div>,
              permissions: <div className="p-4">PermissÃµes</div>,
              preferences: <div className="p-4">PreferÃªncias</div>,
              security: <div className="p-4">SeguranÃ§a</div>,
              audit: <div className="p-4">HistÃ³rico</div>,
            }}
          </ProfileTabs>
        }
        actions={
          <ProfileActions
            buttons={[
              {
                label: "Editar",
                action: "edit",
                onClick: () => console.log("edit"),
              },
              {
                label: "Deletar",
                action: "delete",
                variant: "danger",
                onClick: () => console.log("delete"),
              },
            ]}
          />
        }
      />
    </div>
  );
}

