"use client";

export const dynamic = "force-dynamic";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { usePermissionAccess } from "@/hooks/usePermissionAccess";
import { canAccessGlobalSupportScope, canViewSupportBoard } from "@/lib/supportAccess";

export default function AdminChamadosPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = usePermissionAccess();
  const canOpenSupport = canViewSupportBoard(user);
  const canAccessGlobalKanban = canAccessGlobalSupportScope(user);
  const queryString = searchParams.toString();

  useEffect(() => {
    if (!loading && user && canOpenSupport) {
      const targetPath = canAccessGlobalKanban ? "/kanban-it" : "/meus-chamados";
      router.replace(`${targetPath}${queryString ? `?${queryString}` : ""}`);
    }
  }, [loading, user, canOpenSupport, canAccessGlobalKanban, queryString, router]);

  if (loading) {
    return <div className="p-6 text-sm text-[var(--tc-text-muted,#6b7280)]">Carregando...</div>;
  }

  if (!user) {
    return <div className="p-6 text-sm text-[var(--tc-text-muted,#6b7280)]">Acesso restrito.</div>;
  }

  if (!canOpenSupport) {
    return <div className="p-6 text-sm text-[var(--tc-text-muted,#6b7280)]">Acesso restrito.</div>;
  }

  return <div className="p-6 text-sm text-[var(--tc-text-muted,#6b7280)]">Redirecionando...</div>;
}

