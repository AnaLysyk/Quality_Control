"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthUser } from "@/hooks/useAuthUser";

function isDevRole(role?: string | null) {
  const value = (role ?? "").toLowerCase();
  return (
    value === "admin" ||
    value === "global_admin" ||
    value === "it_dev" ||
    value === "itdev" ||
    value === "developer" ||
    value === "dev"
  );
}

export default function AdminChamadosPage() {
  const router = useRouter();
  const { user, loading } = useAuthUser();
  const isDev = isDevRole(user?.role ?? null);

  useEffect(() => {
    if (!loading && user) {
      router.replace(isDev ? "/kanban-it" : "/meus-chamados");
    }
  }, [loading, user, isDev, router]);

  if (loading) {
    return <div className="p-6 text-sm text-(--tc-text-muted,#6b7280)">Carregando...</div>;
  }

  if (!user) {
    return <div className="p-6 text-sm text-(--tc-text-muted,#6b7280)">Acesso restrito.</div>;
  }

  return <div className="p-6 text-sm text-(--tc-text-muted,#6b7280)">Redirecionando...</div>;
}
