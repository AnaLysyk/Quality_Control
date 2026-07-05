"use client";

import AccessDeniedState from "@/components/access/AccessDeniedState";
import { usePermissionAccess } from "@/hooks/usePermissionAccess";
import ContextualDashboardClient from "./ContextualDashboardClient";

export const dynamic = "force-dynamic";

export default function OperacoesDashboardPage() {
  const { loading, can } = usePermissionAccess();

  if (loading) return <AccessDeniedState state="loading" />;

  if (!can("operations", "dashboard")) {
    return (
      <AccessDeniedState
        moduleName="Painel operacional"
        requiredPermission="operations:dashboard"
        title="Acesso restrito"
        description="Este painel depende da permissão configurada para o perfil ou usuário."
      />
    );
  }

  return <ContextualDashboardClient />;
}
