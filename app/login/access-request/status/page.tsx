"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState, Suspense } from "react";

type RequestPublic = {
  id: string;
  status: string;
  requestType: string;
  requestedRole?: string;
  requestedCompanySlug?: string;
  requesterName?: string;
  requesterEmail: string;
  reason?: string;
  reviewComment?: string;
  adjustmentFields: string[];
  priority: string;
  createdAt: string;
  updatedAt: string;
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: "Aguardando análise", color: "bg-yellow-100 text-yellow-800" },
  under_review: { label: "Em análise", color: "bg-blue-100 text-blue-800" },
  approved: { label: "Aprovado", color: "bg-green-100 text-green-800" },
  rejected: { label: "Rejeitado", color: "bg-red-100 text-red-800" },
  needs_more_info: { label: "Ajuste necessário", color: "bg-orange-100 text-orange-800" },
  cancelled: { label: "Cancelado", color: "bg-gray-100 text-gray-600" },
  expired: { label: "Expirado", color: "bg-gray-100 text-gray-600" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_LABELS[status] ?? { label: status, color: "bg-gray-100 text-gray-600" };
  return (
    <span className={`inline-block rounded-full px-3 py-1 text-sm font-medium ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

function AccessRequestStatusContent() {
  const params = useSearchParams();
  const router = useRouter();
  const key = params.get("key") ?? "";

  const [item, setItem] = useState<RequestPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!key) {
      setError("Chave de acesso não informada.");
      setLoading(false);
      return;
    }

    fetch(`/api/access-requests/by-key/${encodeURIComponent(key)}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({})) as { message?: string };
          throw new Error(body.message ?? "Solicitação não encontrada");
        }
        const data = await res.json() as { item: RequestPublic };
        setItem(data.item);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Erro ao carregar solicitação.");
      })
      .finally(() => setLoading(false));
  }, [key]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[--tc-bg,#f4f6fb]">
        <p className="text-gray-500">Carregando...</p>
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[--tc-bg,#f4f6fb] p-6">
        <div className="w-full max-w-md rounded-xl bg-white p-8 shadow text-center">
          <p className="text-red-600 font-medium">{error ?? "Solicitação não encontrada."}</p>
          <button
            onClick={() => router.push("/login")}
            className="mt-6 rounded-lg bg-[--tc-accent,#ef0001] px-6 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            Voltar ao login
          </button>
        </div>
      </div>
    );
  }

  const needsAdjustment = item.status === "needs_more_info";
  const isApproved = item.status === "approved";
  const isRejected = item.status === "rejected";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[--tc-bg,#f4f6fb] p-6">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-[--tc-heading,#081f4d]">Status da Solicitação</h1>
          <p className="mt-1 text-sm text-gray-500">Quality Control</p>
        </div>

        <div className="rounded-xl bg-white p-6 shadow space-y-5">
          {/* Status */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-500">Status</span>
            <StatusBadge status={item.status} />
          </div>

          {/* Identificação */}
          {item.requesterName && (
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-500">Nome</span>
              <span className="text-sm text-gray-800">{item.requesterName}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-500">E-mail</span>
            <span className="text-sm text-gray-800">{item.requesterEmail}</span>
          </div>
          {item.requestedRole && (
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-500">Perfil solicitado</span>
              <span className="text-sm text-gray-800">{item.requestedRole}</span>
            </div>
          )}
          {item.requestedCompanySlug && (
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-500">Empresa</span>
              <span className="text-sm text-gray-800">{item.requestedCompanySlug}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-500">Criado em</span>
            <span className="text-sm text-gray-500">
              {new Date(item.createdAt).toLocaleDateString("pt-BR")}
            </span>
          </div>

          {/* Observação do revisor */}
          {item.reviewComment && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 mb-1">
                Observação do revisor
              </p>
              <p className="text-sm text-gray-700">{item.reviewComment}</p>
            </div>
          )}

          {/* Campos para ajuste */}
          {needsAdjustment && item.adjustmentFields.length > 0 && (
            <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-orange-700 mb-2">
                Campos que precisam de ajuste
              </p>
              <ul className="list-disc list-inside space-y-1">
                {item.adjustmentFields.map((field) => (
                  <li key={field} className="text-sm text-gray-700">{field}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Mensagem de aprovação */}
          {isApproved && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-4">
              <p className="text-sm text-green-800 font-medium">
                Sua solicitação foi aprovada! Verifique seu e-mail para as credenciais de acesso.
              </p>
            </div>
          )}

          {/* Mensagem de rejeição */}
          {isRejected && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <p className="text-sm text-red-800">
                Sua solicitação foi rejeitada. Para dúvidas, entre em contato com o suporte.
              </p>
            </div>
          )}

          {/* Ação de ajuste */}
          {needsAdjustment && (
            <a
              href={`/login/solicitar-acesso?key=${encodeURIComponent(key)}`}
              className="block w-full rounded-lg bg-[--tc-accent,#ef0001] py-2.5 text-center text-sm font-semibold text-white hover:opacity-90"
            >
              Corrigir e reenviar solicitação
            </a>
          )}

          {/* Voltar */}
          <button
            onClick={() => router.push("/login")}
            className="block w-full rounded-lg border border-gray-200 py-2.5 text-center text-sm text-gray-600 hover:bg-gray-50"
          >
            Voltar ao login
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AccessRequestStatusPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-[--tc-bg,#f4f6fb]">
        <p className="text-gray-500">Carregando...</p>
      </div>
    }>
      <AccessRequestStatusContent />
    </Suspense>
  );
}
