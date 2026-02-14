"use client";
import { useAuthUser } from "@/hooks/useAuthUser";
import { useClientContext } from "@/context/ClientContext";
import ReleaseManualList from "../components/ReleaseManualList";
import DefectList from "../components/DefectList";

export default function PainelReleasesManuaisAutenticado() {
  const { user, loading: authLoading } = useAuthUser();
  const { activeClientId, loading: clientsLoading } = useClientContext();
  const isLoading = authLoading || clientsLoading;

  const companyId = activeClientId;

  if (isLoading) {
    return (
      <div className="p-6 text-sm text-[--tc-text-muted,#6b7280]">Carregando painel...</div>
    );
  }

  if (!user || !companyId) {
    return (
      <div className="p-6 text-[--tc-error,#b91c1c]">
        Você precisa estar autenticado e vinculado a uma empresa para acessar este painel.
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-8 bg-[--tc-surface,#fff] text-[--tc-text,#0b1a3c] rounded-2xl shadow-sm">
      <h1 className="text-2xl font-bold mb-6 text-[--tc-text-primary,#0b1a3c]">Painel de Releases Manuais e Defeitos</h1>
      <ReleaseManualList companyId={companyId} />
      <DefectList companyId={companyId} />
    </div>
  );
}
