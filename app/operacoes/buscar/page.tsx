"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import AccessDeniedState from "@/components/access/AccessDeniedState";
import { usePermissionAccess } from "@/hooks/usePermissionAccess";

function OperacoesBuscarRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/operacoes");
  }, [router]);

  return null;
}

export default function OperacoesBuscarPage() {
  const { loading, can } = usePermissionAccess();

  if (loading) return <AccessDeniedState state="loading" />;

  if (!can("operations", "search")) {
    return (
      <AccessDeniedState
        moduleName="Busca operacional"
        requiredPermission="operations:search"
        title="Permissão necessária"
        description="Esta tela depende da configuração do perfil ou usuário."
      />
    );
  }

  return <OperacoesBuscarRedirect />;
}
