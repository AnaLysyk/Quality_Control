"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePermissionAccess } from "@/hooks/usePermissionAccess";
import { canAccessGlobalSupportScope, canViewSupportBoard } from "@/lib/supportAccess";

export default function AdminChamadosPage() {
  const router = useRouter();
  const { user, loading } = usePermissionAccess();
  const canOpenSupport = canViewSupportBoard(user);
  const canAccessGlobalKanban = canAccessGlobalSupportScope(user);

  useEffect(() => {
    if (!loading && user && canOpenSupport) {
      router.replace(canAccessGlobalKanban ? "/kanban-it" : "/meus-chamados");
    }
  }, [loading, user, canOpenSupport, canAccessGlobalKanban, router]);

  if (loading) {
    return <div className="p-6 text-sm text-(--tc-text-muted,#6b7280)">Carregando...</div>;
  }

  if (!user) {
    return <div className="p-6 text-sm text-(--tc-text-muted,#6b7280)">Acesso restrito.</div>;
  }

  if (!canOpenSupport) {
    return <div className="p-6 text-sm text-(--tc-text-muted,#6b7280)">Acesso restrito.</div>;
  }

  return <div className="p-6 text-sm text-(--tc-text-muted,#6b7280)">Redirecionando...</div>;
}
