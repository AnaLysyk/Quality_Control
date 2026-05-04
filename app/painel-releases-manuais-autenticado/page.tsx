"use client";

export const dynamic = "force-dynamic";
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
    return null;
  }

  if (!user || !companyId) {
    return (
      <div className="p-6 text-red-600">
        Você precisa estar autenticado e vinculado a uma empresa para acessar este painel.
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-8">
      <h1 className="text-2xl font-bold mb-6">Painel de Releases Manuais e Defeitos</h1>
      <ReleaseManualList companyId={companyId} />
      <DefectList companyId={companyId} />
    </div>
  );
}
