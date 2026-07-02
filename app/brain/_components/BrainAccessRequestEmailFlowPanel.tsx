"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { FiAlertTriangle, FiCheckCircle, FiClock, FiExternalLink, FiGitBranch, FiMail, FiRefreshCw, FiShield } from "react-icons/fi";

import { fetchApi } from "@/lib/api";

type EmailItem = {
  id: string;
  createdAt: string;
  kind: string;
  to: string;
  subject: string;
  html: string;
  text: string | null;
  accessKey: string | null;
  lookupUrl: string | null;
  source: string;
};

type FlowRequest = {
  id: string;
  accessKey: string | null;
  requesterName: string | null;
  requesterEmail: string;
  requestedRole: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  adjustmentRounds: number;
  pendingAdjustmentFields: string[];
  lastAdjustmentDiff: Array<{ label?: string; previous?: string; next?: string }>;
  logs: Array<{ id: string; createdAt: string; actorEmail: string | null; action: string; metadata: unknown }>;
  emails: EmailItem[];
  validation: {
    hasCreationLog: boolean;
    hasReceivedEmail: boolean;
    hasDecisionEmail: boolean;
    hasAdjustmentEmail: boolean;
  };
};

type RouteHealth = {
  id: string;
  method: string;
  path: string;
  label: string;
  logOk: boolean;
  emailOk: boolean;
  status: "mapped" | "attention";
};

type FlowPayload = {
  generatedAt: string;
  routes: RouteHealth[];
  summary: {
    requests: number;
    auditLogs: number;
    capturedAccessRequestEmails: number;
    mappedRoutes: number;
  };
  requests: FlowRequest[];
  emails: EmailItem[];
  notes: string[];
};

async function fetcher(path: string) {
  const response = await fetchApi(path, { cache: "no-store" });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error || payload?.message || "NÃ£o foi possÃ­vel carregar o fluxo do Brain.");
  }
  return payload as FlowPayload;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Sem data";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function kindLabel(kind: string) {
  if (kind === "access_request.received") return "Recebido";
  if (kind === "access_request.approved") return "Aprovado";
  if (kind === "access_request.rejected") return "Rejeitado";
  if (kind === "access_request.adjustment") return "Ajuste";
  return kind.replaceAll("_", " ").replaceAll(".", " / ");
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    pending: "Pendente",
    under_review: "Em anÃ¡lise",
    needs_more_info: "Aguardando ajuste",
    approved: "Aprovada",
    rejected: "Rejeitada",
    expired: "Expirada",
    cancelled: "Cancelada",
  };
  return labels[status] ?? status;
}

function validationOk(request: FlowRequest) {
  return request.validation.hasCreationLog && request.validation.hasReceivedEmail && request.validation.hasDecisionEmail && request.validation.hasAdjustmentEmail;
}

function openEmailPreview(email: EmailItem) {
  const html = email.html || `<pre>${email.text ?? "E-mail sem corpo capturado."}</pre>`;
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer,width=980,height=760");
  window.setTimeout(() => URL.revokeObjectURL(url), 15000);
}

export function BrainAccessRequestEmailFlowPanel() {
  const { data, error, isLoading, mutate } = useSWR("/api/brain/access-requests/email-flow?limit=20", fetcher, {
    refreshInterval: 30000,
    revalidateOnFocus: false,
  });
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);

  const selectedRequest = useMemo(() => {
    if (!data?.requests.length) return null;
    return data.requests.find((request) => request.id === selectedRequestId) ?? data.requests[0];
  }, [data?.requests, selectedRequestId]);

  const missingEmailCapture = Boolean(data && data.summary.capturedAccessRequestEmails === 0);

  return (
    <section className="rounded-[28px] border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#fff)] p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--tc-text-muted,#6b7280)]">
            <FiShield className="h-4 w-4" /> Brain observability
          </span>
          <h2 className="mt-3 text-xl font-extrabold text-[var(--tc-text,#0b1a3c)]">SolicitaÃ§Ãµes pÃºblicas e fluxo de e-mails</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--tc-text-secondary,#4b5563)]">
            O Brain correlaciona rotas pÃºblicas, auditoria, solicitaÃ§Ã£o e e-mails capturados para transformar o fluxo em validaÃ§Ã£o rastreÃ¡vel.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void mutate()}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[var(--tc-border,#d7deea)] px-4 py-2 text-sm font-semibold text-[var(--tc-text,#0b1a3c)]"
        >
          <FiRefreshCw className="h-4 w-4" /> Atualizar
        </button>
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{error.message}</div>
      ) : null}

      {missingEmailCapture ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">
          <div className="flex items-start gap-2">
            <FiAlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Nenhum e-mail capturado ainda. Para o Brain abrir o HTML real enviado pelo sistema, rode local com <strong>EMAIL_CAPTURE_MODE=file</strong> ou <strong>ACCESS_REQUEST_EMAIL_BYPASS=true</strong>.
            </p>
          </div>
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        {[
          ["SolicitaÃ§Ãµes", data?.summary.requests ?? 0],
          ["Logs de auditoria", data?.summary.auditLogs ?? 0],
          ["E-mails capturados", data?.summary.capturedAccessRequestEmails ?? 0],
          ["Rotas mapeadas", data?.summary.mappedRoutes ?? 0],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--tc-text-muted,#6b7280)]">{label}</p>
            <p className="mt-1 text-2xl font-black text-[var(--tc-text,#0b1a3c)]">{isLoading ? "..." : value}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="rounded-2xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] p-3">
          <div className="flex items-center gap-2">
            <FiGitBranch className="h-5 w-5 text-[var(--tc-accent,#ef0001)]" />
            <h3 className="text-sm font-extrabold text-[var(--tc-text,#0b1a3c)]">Rotas do fluxo</h3>
          </div>
          <div className="mt-3 space-y-2">
            {(data?.routes ?? []).map((route) => (
              <div key={route.id} className="rounded-xl border border-[var(--tc-border,#d7deea)] bg-white px-3 py-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[var(--tc-text,#0b1a3c)]">{route.label}</p>
                    <p className="mt-1 truncate font-mono text-xs text-[var(--tc-text-muted,#6b7280)]">{route.method} {route.path}</p>
                  </div>
                  {route.status === "mapped" ? <FiCheckCircle className="h-5 w-5 shrink-0 text-emerald-600" /> : <FiAlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />}
                </div>
              </div>
            ))}
            {!data?.routes?.length && !isLoading ? <p className="text-sm text-[var(--tc-text-muted,#6b7280)]">Nenhuma rota retornada.</p> : null}
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <FiMail className="h-5 w-5 text-[var(--tc-accent,#ef0001)]" />
              <h3 className="text-sm font-extrabold text-[var(--tc-text,#0b1a3c)]">ValidaÃ§Ã£o por solicitaÃ§Ã£o</h3>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full border border-[var(--tc-border,#d7deea)] bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--tc-text-muted,#6b7280)]">
              <FiClock className="h-3 w-3" /> {data?.generatedAt ? formatDate(data.generatedAt) : "--"}
            </span>
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(220px,0.45fr)_minmax(0,0.55fr)]">
            <div className="max-h-96 space-y-2 overflow-auto pr-1">
              {(data?.requests ?? []).map((request) => {
                const ok = validationOk(request);
                const selected = selectedRequest?.id === request.id;
                return (
                  <button
                    key={request.id}
                    type="button"
                    onClick={() => setSelectedRequestId(request.id)}
                    className={`w-full rounded-xl border px-3 py-2 text-left ${selected ? "border-[var(--tc-accent,#ef0001)] bg-white" : "border-[var(--tc-border,#d7deea)] bg-white/70"}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-[var(--tc-text,#0b1a3c)]">{request.requesterName ?? request.requesterEmail}</p>
                        <p className="mt-1 text-xs text-[var(--tc-text-muted,#6b7280)]">{statusLabel(request.status)} â€¢ {request.emails.length} e-mail(s)</p>
                      </div>
                      {ok ? <FiCheckCircle className="h-4 w-4 shrink-0 text-emerald-600" /> : <FiAlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />}
                    </div>
                  </button>
                );
              })}
              {!data?.requests?.length && !isLoading ? <p className="text-sm text-[var(--tc-text-muted,#6b7280)]">Nenhuma solicitaÃ§Ã£o encontrada.</p> : null}
            </div>

            <div className="rounded-xl border border-[var(--tc-border,#d7deea)] bg-white px-3 py-3">
              {selectedRequest ? (
                <div>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-base font-extrabold text-[var(--tc-text,#0b1a3c)]">{selectedRequest.requesterEmail}</p>
                      <p className="mt-1 text-xs text-[var(--tc-text-muted,#6b7280)]">Perfil: {selectedRequest.requestedRole ?? "--"} â€¢ Criado: {formatDate(selectedRequest.createdAt)}</p>
                    </div>
                    <span className="rounded-full bg-[var(--tc-surface-2,#f8fafc)] px-2.5 py-1 text-xs font-bold text-[var(--tc-text-muted,#6b7280)]">{statusLabel(selectedRequest.status)}</span>
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {[
                      ["Log criaÃ§Ã£o", selectedRequest.validation.hasCreationLog],
                      ["E-mail recebido", selectedRequest.validation.hasReceivedEmail],
                      ["E-mail decisÃ£o", selectedRequest.validation.hasDecisionEmail],
                      ["E-mail ajuste", selectedRequest.validation.hasAdjustmentEmail],
                    ].map(([label, ok]) => (
                      <div key={String(label)} className="flex items-center gap-2 rounded-lg border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] px-2.5 py-2 text-xs font-bold text-[var(--tc-text,#0b1a3c)]">
                        {ok ? <FiCheckCircle className="h-4 w-4 text-emerald-600" /> : <FiAlertTriangle className="h-4 w-4 text-amber-600" />}
                        {label}
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--tc-text-muted,#6b7280)]">E-mails enviados</p>
                    {selectedRequest.emails.map((email) => (
                      <div key={email.id} className="rounded-xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] px-3 py-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-[var(--tc-text,#0b1a3c)]">{email.subject}</p>
                            <p className="mt-1 text-xs text-[var(--tc-text-muted,#6b7280)]">{kindLabel(email.kind)} â€¢ {formatDate(email.createdAt)} â€¢ {email.source}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => openEmailPreview(email)}
                            className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-[var(--tc-border,#d7deea)] bg-white px-2 text-xs font-bold text-[var(--tc-text,#0b1a3c)]"
                          >
                            <FiExternalLink className="h-3.5 w-3.5" /> Abrir
                          </button>
                        </div>
                      </div>
                    ))}
                    {!selectedRequest.emails.length ? <p className="rounded-xl border border-dashed border-[var(--tc-border,#d7deea)] px-3 py-3 text-sm text-[var(--tc-text-muted,#6b7280)]">Nenhum e-mail capturado para esta solicitaÃ§Ã£o.</p> : null}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-[var(--tc-text-muted,#6b7280)]">Selecione uma solicitaÃ§Ã£o para ver logs e e-mails.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {data?.notes?.length ? (
        <div className="mt-4 rounded-2xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] px-3 py-2 text-xs leading-5 text-[var(--tc-text-muted,#6b7280)]">
          {data.notes.map((note) => <p key={note}>â€¢ {note}</p>)}
        </div>
      ) : null}
    </section>
  );
}

