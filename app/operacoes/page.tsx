"use client";

import AccessDeniedState from "@/components/access/AccessDeniedState";
import { usePermissionAccess } from "@/hooks/usePermissionAccess";
import { OperationsWorkspaceClient } from "../runs/OperationsWorkspaceClient";

export const dynamic = "force-dynamic";

export default function OperacoesPage() {
  const { loading, can } = usePermissionAccess();

  if (loading) return <AccessDeniedState state="loading" />;

  if (!can("operations", "view")) {
    return (
      <AccessDeniedState
        moduleName="Operações"
        requiredPermission="operations:view"
        title="Acesso restrito"
        description="Esta entrada depende da permissão configurada para o perfil ou usuário."
      />
    );
  }

  return <OperationsWorkspaceClient />;
}
