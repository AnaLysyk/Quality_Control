"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import AccessDeniedState from "@/components/access/AccessDeniedState";
import { usePermissionAccess } from "@/hooks/usePermissionAccess";

function OperacoesMetricasRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/test-metric");
  }, [router]);

  return null;
}

export default function OperacoesMetricasPage() {
  const { loading, can } = usePermissionAccess();

  if (loading) return <AccessDeniedState state="loading" />;

  if (!can("operations", "metrics")) {
    return (
      <AccessDeniedState
        moduleName="Métricas operacionais"
        requiredPermission="operations:metrics"
        title="Permissão necessária"
        description="Esta tela depende da configuração do perfil ou usuário."
      />
    );
  }

  return <OperacoesMetricasRedirect />;
}
