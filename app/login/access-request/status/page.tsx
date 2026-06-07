"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type RequestPublic = {
  id: string;
  status: string;
  requestType: string;
  requestedRole?: string | null;
  requestedCompanySlug?: string | null;
  requesterName?: string | null;
  requesterEmail: string;
  reason?: string | null;
  reviewComment?: string | null;
  adjustmentFields: string[];
  priority: string;
  createdAt: string;
  updatedAt: string;
};

const STATUS_LABELS: Record<string, { label: string; color: string; message: string }> = {
  pending: {
    label: "Em análise",
    color: "bg-yellow-100 text-yellow-800",
    message: "Sua solicitação foi enviada com sucesso e está aguardando análise. Verifique sua caixa de e-mail para acompanhar as atualizações.",
  },
  under_review: {
    label: "Em análise",
    color: "bg-blue-100 text-blue-800",
    message: "Sua solicitação está em análise pela equipe responsável. As atualizações deste fluxo serão enviadas por e-mail.",
  },
  approved: {
    label: "Aprovado",
    color: "bg-green-100 text-green-800",
    message: "Sua solicitação foi aprovada. Verifique sua caixa de e-mail para acessar as credenciais e orientações de acesso.",
  },
  rejected: {
    label: "Recusado",
    color: "bg-red-100 text-red-800",
    message: "Sua solicitação foi recusada. Verifique o motivo informado e, se necessário, envie uma nova solicitação pelo mesmo e-mail.",
  },
  needs_more_info: {
    label: "Ajuste necessário",
    color: "bg-orange-100 text-orange-800",
    message: "Sua solicitação precisa de correção. Verifique os campos indicados e reenvie as informações solicitadas.",
  },
  cancelled: {
    label: "Cancelado",
    color: "bg-gray-100 text-gray-600",
    message: "Esta solicitação foi cancelada.",
  },
  expired: {
    label: "Expirado",
    color: "bg-gray-100 text-gray-600",
    message: "Esta solicitação expirou. Envie uma nova solicitação de acesso.",
  },
};

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("pt-BR");
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_LABELS[status] ?? {
    label: status,
    color: "bg-gray-100 text-gray-600",
    message: "Status da solicitação atualizado.",
  };

  return (
    <span data-testid="access-request-status-badge" className={`inline-block rounded-full px-3 py-1 text-sm font-medium ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

function AccessRequestStatusContent() {
  const params = useSearchParams();
  const router = useRouter();

  const initialKey = params.get("key") ?? "";
  const initialEmail = params.get("email") ?? "";

  const [key, setKey] = useState(initialKey);
  const [email, setEmail] = useState(initialEmail);
  const [item, setItem] = useState<RequestPublic | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const statusInfo = useMemo(
    () =>
      item
        ? STATUS_LABELS[item.status] ?? {
            label: item.status,
            color: "bg-gray-100 text-gray-600",
            message: "Status da solicitação atualizado.",
          }
        : null,
    [item],
  );

  async function consultarSolicitacao(nextKey = key, nextEmail = email) {
    const normalizedKey = nextKey.trim();
    const normalizedEmail = nextEmail.trim().toLowerCase();

    setError(null);
    setItem(null);

    if (!normalizedKey) {
      setError("Informe o token/chave recebido por e-mail.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`/api/access-requests/by-key/${encodeURIComponent(normalizedKey)}`, {
        cache: "no-store",
      });

      const data = (await res.json().catch(() => null)) as { item?: RequestPublic; message?: string } | null;

      if (!res.ok || !data?.item) {
        throw new Error(data?.message ?? "Solicitação não encontrada.");
      }

      if (normalizedEmail && data.item.requesterEmail.toLowerCase() !== normalizedEmail) {
        throw new Error("O e-mail informado não corresponde à solicitação consultada.");
      }

      setItem(data.item);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao consultar solicitação.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (initialKey) {
      void consultarSolicitacao(initialKey, initialEmail);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialKey, initialEmail]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[--tc-bg,#f4f6fb] p-6">
      <div className="w-full max-w-2xl">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-[--tc-heading,#081f4d]">Consultar solicitação de acesso</h1>
          <p className="mt-1 text-sm text-gray-500">Quality Control</p>
        </div>

        <div className="rounded-xl bg-white p-6 shadow space-y-5">
          <div data-testid="access-request-status-form" className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm font-semibold text-[#011848]">
              E-mail
              <input
                data-testid="access-request-status-email-input"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="voce@empresa.com"
                className="w-full rounded-xl border border-[#011848]/15 bg-white px-4 py-3 text-sm"
              />
            </label>

            <label className="space-y-2 text-sm font-semibold text-[#011848]">
              Token/chave recebido por e-mail
              <input
                data-testid="access-request-status-key-input"
                type="text"
                value={key}
                onChange={(event) => setKey(event.target.value)}
                placeholder="Cole aqui o token recebido por e-mail"
                className="w-full rounded-xl border border-[#011848]/15 bg-white px-4 py-3 text-sm"
              />
            </label>

            <button
              data-testid="access-request-status-submit-button"
              type="button"
              onClick={() => void consultarSolicitacao()}
              disabled={loading}
              className="sm:col-span-2 rounded-lg bg-[--tc-accent,#ef0001] px-6 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
            >
              {loading ? "Consultando..." : "Consultar solicitação"}
            </button>
          </div>

          {error && (
            <div data-testid="access-request-status-error" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {item && (
            <div data-testid="access-request-status-result" className="space-y-5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-500">Status</span>
                <StatusBadge status={item.status} />
              </div>

              {statusInfo && (
                <div data-testid="access-request-status-message" className="rounded-lg border border-blue-100 bg-blue-50 p-4">
                  <p className="text-sm text-blue-900">{statusInfo.message}</p>
                </div>
              )}

              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <p className="font-medium text-gray-500">Data da solicitação</p>
                  <p data-testid="access-request-created-at" className="text-gray-800">{formatDate(item.createdAt)}</p>
                </div>

                <div>
                  <p className="font-medium text-gray-500">Última atualização</p>
                  <p data-testid="access-request-updated-at" className="text-gray-800">{formatDate(item.updatedAt)}</p>
                </div>

                <div>
                  <p className="font-medium text-gray-500">Nome</p>
                  <p className="text-gray-800">{item.requesterName ?? "-"}</p>
                </div>

                <div>
                  <p className="font-medium text-gray-500">E-mail</p>
                  <p data-testid="access-request-requester-email" className="text-gray-800">{item.requesterEmail}</p>
                </div>

                <div>
                  <p className="font-medium text-gray-500">Perfil solicitado</p>
                  <p className="text-gray-800">{item.requestedRole ?? item.requestType}</p>
                </div>

                <div>
                  <p className="font-medium text-gray-500">Prioridade</p>
                  <p className="text-gray-800">{item.priority}</p>
                </div>
              </div>

              {item.reviewComment && (
                <div data-testid="access-request-review-comment" className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 mb-1">Comentário do revisor</p>
                  <p className="text-sm text-gray-700">{item.reviewComment}</p>
                </div>
              )}

              {item.status === "needs_more_info" && item.adjustmentFields.length > 0 && (
                <div data-testid="access-request-adjustment-fields" className="rounded-lg border border-orange-200 bg-orange-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-orange-700 mb-2">Campos que precisam de ajuste</p>
                  <ul className="list-disc list-inside space-y-1">
                    {item.adjustmentFields.map((field) => (
                      <li key={field} className="text-sm text-gray-700">{field}</li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="text-sm text-gray-600">
                As atualizações deste fluxo são enviadas por e-mail. Caso precise reenviar ou corrigir informações, use o mesmo e-mail da solicitação para centralizar o histórico.
              </p>
            </div>
          )}

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
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[--tc-bg,#f4f6fb]">
          <p className="text-gray-500">Carregando...</p>
        </div>
      }
    >
      <AccessRequestStatusContent />
    </Suspense>
  );
}


