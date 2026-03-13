"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePermissionAccess } from "@/hooks/usePermissionAccess";

export default function AdminChamadosPage() {
  const router = useRouter();
  const { user, loading, can } = usePermissionAccess();
  const canAccessGlobalKanban =
    (can("tickets", "view_all") || can("tickets", "assign") || can("tickets", "status") || can("support", "assign") || can("support", "status")) &&
    (can("tickets", "view") || can("support", "view"));

  useEffect(() => {
    if (!loading && user) {
      router.replace(canAccessGlobalKanban ? "/kanban-it" : "/meus-chamados");
    }
  }, [loading, user, canAccessGlobalKanban, router]);

  if (loading) {
    return <div className="p-6 text-sm text-(--tc-text-muted,#6b7280)">Carregando...</div>;
  }

  if (!user) {
    return <div className="p-6 text-sm text-(--tc-text-muted,#6b7280)">Acesso restrito.</div>;
  }

  return <div className="p-6 text-sm text-(--tc-text-muted,#6b7280)">Redirecionando...</div>;
}
