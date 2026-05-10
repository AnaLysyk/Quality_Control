"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import Breadcrumb from "@/components/Breadcrumb";

type RequestRecord = {
  id: string;
  requesterUserId?: string;
  requesterName?: string;
  requesterEmail: string;
  requestedCompanySlug?: string;
  requestType: string;
  requestedRole?: string;
  status: "pending" | "under_review" | "approved" | "rejected" | "cancelled" | "expired" | "needs_more_info";
  reason?: string;
  priority?: string;
  createdAt: string;
  reviewComment?: string;
};

type RequestsResponse = {
  items?: RequestRecord[];
  canReview?: boolean;
  scope?: "all" | "own";
};

function requestTypeLabel(value: string) {
  const key = value.trim().toLowerCase();
  if (key === "company_access") return "Acesso à empresa";
  if (key === "company_user") return "Usuário da empresa";
  if (key === "testing_company_user") return "Usuário TC";
  if (key === "leader_tc") return "Líder TC";
  if (key === "technical_support") return "Suporte técnico";
  if (key === "company_creation") return "Criação de empresa";
  if (key === "profile_change") return "Alteração de perfil";
  if (key === "permission_change") return "Alteração de permissão";
  if (key === "company_link") return "Vínculo com empresa";
  return value;
}

function AdminRequestsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [items, setItems] = useState<RequestRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("");
  const [type, setType] = useState<string>("");
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState<"data" | "review" | "history" | "audit">("data");
  const [message, setMessage] = useState<string | null>(null);
  const [canReview, setCanReview] = useState(false);
  const [scope, setScope] = useState<"all" | "own">("own");
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const handleUnauthorized = useCallback(() => {
    const msg = "Sessão expirada. Faça login novamente.";
    setMessage(msg);
    toast.error(msg);
    router.push("/login");
  }, [router]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter(
      (req) =>
        (!term ||
          [req.requesterName ?? "", req.requesterEmail, req.requestedCompanySlug ?? "", req.id]
            .join(" ")
            .toLowerCase()
            .includes(term)) &&
        (!status || req.status === status) &&
        (!type || req.requestType === type)
    );
  }, [items, search, status, type]);

  const selectedRequest = useMemo(
    () => filtered.find((req) => req.id === selectedRequestId) ?? filtered[0] ?? null,
    [filtered, selectedRequestId],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (type) params.set("requestType", type);
      const query = params.toString();

      const res = await fetch(`/api/access-requests${query ? `?${query}` : ""}`, {
        credentials: "include",
        cache: "no-store",
      });

      if (res.status === 401) {
        setItems([]);
        handleUnauthorized();
        return;
      }

      if (res.status === 403) {
        setMessage("Sem permissão para esta fila de solicitações.");
        setItems([]);
        setCanReview(false);
        setScope("own");
        return;
      }
      const json = (await res.json().catch(() => null)) as RequestsResponse | null;
      setItems(json?.items ?? []);
      setCanReview(json?.canReview === true);
      setScope(json?.scope === "all" ? "all" : "own");
    } catch {
      setMessage("Erro ao carregar solicitações");
      setItems([]);
      setCanReview(false);
      setScope("own");
    } finally {
      setLoading(false);
    }
  }, [handleUnauthorized, status, type]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const focusParam = searchParams.get("focus");
    if (focusParam === "search") {
      setTimeout(() => {
        searchInputRef.current?.focus();
        window.history.replaceState({}, "", window.location.pathname);
      }, 100);
    }
  }, [searchParams]);

  async function update(id: string, action: "approve" | "reject" | "request-info" | "start-review", reviewComment?: string) {
    if (!canReview) {
      const nextMessage = "Seu perfil pode apenas consultar as próprias solicitações.";
      setMessage(nextMessage);
      toast.error(nextMessage);
      return;
    }
    setMessage(null);
    const res = await fetch(`/api/access-requests/${id}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comment: reviewComment }),
      credentials: "include",
      cache: "no-store",
    });

    if (res.status === 401) {
      handleUnauthorized();
      return;
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg = err.message || "Erro ao atualizar";
      setMessage(msg);
      toast.error(msg);
      return;
    }
    const payload = (await res.json().catch(() => null)) as { item?: RequestRecord } | null;
    if (payload?.item) {
      setItems((prev) =>
        prev.map((req) => (req.id === payload.item?.id ? { ...req, ...payload.item } : req)),
      );
    } else {
      setItems((prev) =>
        prev.map((req) =>
          req.id === id
            ? {
                ...req,
                status:
                  action === "approve"
                    ? "approved"
                    : action === "reject"
                      ? "rejected"
                      : action === "request-info"
                        ? "needs_more_info"
                        : "under_review",
                reviewComment: reviewComment ?? req.reviewComment,
              }
            : req,
        ),
      );
    }
    toast.success(
      action === "approve"
        ? "Solicitação aprovada"
        : action === "reject"
          ? "Solicitação rejeitada"
          : action === "request-info"
            ? "Solicitação atualizada para precisa de informações"
            : "Solicitação colocada em análise",
    );
  }

  return (
    <div className="min-h-screen bg-(--page-bg,#ffffff) text-(--page-text,#0b1a3c)" data-testid="access-requests-page">
      <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 sm:py-6 lg:px-10 lg:py-10 space-y-4">
        <Breadcrumb items={[{ label: "Admin", href: "/admin/dashboard" }, { label: "Solicitações" }]} />

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-(--tc-text-primary,#0b1a3c)">Solicitações</h1>
            <p className="text-sm sm:text-base text-(--tc-text-muted,#6b7280)">
              {scope === "all"
                ? "Suporte técnico visualiza todas as solicitações e pode revisar os itens pendentes."
                : "Perfis sem suporte técnico acompanham apenas as próprias solicitações."}
            </p>
          </div>
          <button
            type="button"
            onClick={load}
            className="rounded-lg border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#ffffff) px-3 py-2 text-sm text-(--tc-text-primary,#0b1a3c) hover:bg-(--tc-surface-2,#f3f4f6) focus:outline-none focus:ring-2 focus:ring-(--tc-accent,#ef0001)/30 disabled:opacity-60"
            disabled={loading}
          >
            Atualizar
          </button>
        </div>

        <div className="flex gap-3 flex-wrap" role="group" aria-label="Filtros">
          <label className="sr-only" htmlFor="requests-search-input">
            Buscar solicitações
          </label>
          <input
            id="requests-search-input"
            data-testid="access-request-search-input"
            ref={searchInputRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por solicitante, e-mail, empresa ou ID"
            className="w-full max-w-md border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#ffffff) text-(--tc-text-primary,#0b1a3c) rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-(--tc-accent,#ef0001)/30"
          />

          <label className="sr-only" htmlFor="requests-filter-status">
            Filtrar solicitações por status
          </label>
          <select
            id="requests-filter-status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#ffffff) text-(--tc-text-primary,#0b1a3c) rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-(--tc-accent,#ef0001)/30"
          >
            <option value="">Status (todos)</option>
            <option value="pending">Pendente</option>
            <option value="under_review">Em análise</option>
            <option value="approved">Aprovada</option>
            <option value="rejected">Rejeitada</option>
            <option value="cancelled">Cancelada</option>
            <option value="expired">Expirada</option>
            <option value="needs_more_info">Precisa de informações</option>
          </select>

          <label className="sr-only" htmlFor="requests-filter-type">
            Filtrar solicitações por tipo
          </label>
          <select
            id="requests-filter-type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#ffffff) text-(--tc-text-primary,#0b1a3c) rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-(--tc-accent,#ef0001)/30"
          >
            <option value="">Tipo (todos)</option>
            <option value="company_access">Acesso à empresa</option>
            <option value="company_user">Usuário da empresa</option>
            <option value="testing_company_user">Usuário TC</option>
            <option value="leader_tc">Líder TC</option>
            <option value="technical_support">Suporte técnico</option>
            <option value="company_creation">Criação de empresa</option>
            <option value="profile_change">Alteração de perfil</option>
            <option value="permission_change">Alteração de permissão</option>
            <option value="company_link">Vínculo com empresa</option>
          </select>
        </div>

        {message && (
          <p className="text-sm text-red-600" role="status" aria-live="polite">
            {message}
          </p>
        )}
        {!canReview && scope === "own" && !loading && (
          <p className="text-sm text-(--tc-text-muted,#6b7280)">
            Aprovação e rejeição ficam disponíveis apenas para o perfil de suporte técnico.
          </p>
        )}
        {loading && <p className="text-sm text-(--tc-text-muted,#6b7280)">Carregando...</p>}

        <div className="text-sm text-(--tc-text-muted,#6b7280)">
          Resumo: Pendentes {items.filter((item) => item.status === "pending").length} | Aprovadas {items.filter((item) => item.status === "approved").length} | Rejeitadas {items.filter((item) => item.status === "rejected").length} | Em análise {items.filter((item) => item.status === "under_review").length}
        </div>

        <ul className="space-y-2" role="list" aria-busy={loading ? "true" : "false"} data-testid="access-request-table">
          {filtered.length === 0 && !loading && <li className="text-sm text-(--tc-text-muted,#6b7280)">Nenhuma solicitação.</li>}
          {filtered.map((req) => (
            <li
              key={req.id}
              data-testid="access-request-row"
              className="rounded-lg border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#ffffff) p-3 flex flex-col gap-2"
            >
              <div className="flex flex-wrap justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold truncate" title={`${req.requesterName ?? "Solicitante"} (${req.requesterEmail})`}>
                    {req.requesterName ?? "Solicitante"} ({req.requesterEmail})
                  </p>
                  <p className="text-sm text-(--tc-text-muted,#6b7280) truncate" title={req.requestedCompanySlug ?? ""}>
                    {req.requestedCompanySlug ?? "Sem empresa vinculada"}
                  </p>
                </div>
                <div className="text-sm font-bold">
                  {req.status === "pending" && <span className="text-yellow-600">Pendente</span>}
                  {req.status === "under_review" && <span className="text-blue-600">Em análise</span>}
                  {req.status === "approved" && <span className="text-green-600">Aprovada</span>}
                  {req.status === "rejected" && <span className="text-red-600">Rejeitada</span>}
                  {req.status === "cancelled" && <span className="text-slate-600">Cancelada</span>}
                  {req.status === "expired" && <span className="text-slate-600">Expirada</span>}
                  {req.status === "needs_more_info" && <span className="text-amber-700">Precisa de informações</span>}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRequestId(req.id)}
                className="self-start rounded-md border border-(--tc-border,#e5e7eb) px-2 py-1 text-xs font-semibold text-(--tc-text-primary,#0b1a3c)"
              >
                Abrir detalhe
              </button>
              <div className="text-sm text-(--tc-text-secondary,#4b5563)">
                <div>Tipo de solicitação: {requestTypeLabel(req.requestType)}</div>
                <div>Perfil solicitado: {req.requestedRole ?? "Não informado"}</div>
                {req.reason && <div>Justificativa: {req.reason}</div>}
                <div>Criado em {new Date(req.createdAt).toLocaleString()}</div>
                {req.reviewComment && <div>Nota: {req.reviewComment}</div>}
              </div>
              {canReview && (req.status === "pending" || req.status === "needs_more_info" || req.status === "under_review") && (
                <div className="flex gap-2 flex-wrap">
                  <button
                    type="button"
                    data-testid="access-request-approve-button"
                    onClick={() => update(req.id, "approve")}
                    className="rounded-lg bg-green-600 text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                  >
                    Aprovar
                  </button>
                  <button
                    type="button"
                    data-testid="access-request-reject-button"
                    onClick={() => {
                      const reviewNote = window.prompt("Informe o motivo da rejeição");
                      if (!reviewNote || !reviewNote.trim()) return;
                      void update(req.id, "reject", reviewNote.trim());
                    }}
                    className="rounded-lg bg-red-600 text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                  >
                    Rejeitar
                  </button>
                  {req.status === "pending" && (
                    <button
                      type="button"
                      data-testid="access-request-request-info-button"
                      onClick={() => update(req.id, "request-info", "Solicitação de informações adicionais")}
                      className="rounded-lg bg-blue-600 text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    >
                      Solicitar ajuste
                    </button>
                  )}
                  {req.status === "pending" && (
                    <button
                      type="button"
                      data-testid="access-request-start-review-button"
                      onClick={() => update(req.id, "start-review", "Solicitação colocada em análise")}
                      className="rounded-lg bg-amber-600 text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                    >
                      Colocar em análise
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>

        {selectedRequest && (
          <section className="rounded-lg border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#ffffff) p-4" data-testid="access-request-detail">
            <div className="mb-3 flex gap-2">
              <button type="button" data-testid="access-request-data-tab" onClick={() => setActiveDetailTab("data")} className="rounded-md border px-2 py-1 text-xs">Dados</button>
              <button type="button" data-testid="access-request-review-tab" onClick={() => setActiveDetailTab("review")} className="rounded-md border px-2 py-1 text-xs">Conferência</button>
              <button type="button" data-testid="access-request-history-tab" onClick={() => setActiveDetailTab("history")} className="rounded-md border px-2 py-1 text-xs">Histórico</button>
              <button type="button" data-testid="access-request-audit-tab" onClick={() => setActiveDetailTab("audit")} className="rounded-md border px-2 py-1 text-xs">Auditoria</button>
            </div>

            {activeDetailTab === "data" && (
              <div className="grid gap-2 text-sm">
                <div>Solicitante: {selectedRequest.requesterName ?? "Solicitante"}</div>
                <div>E-mail: {selectedRequest.requesterEmail}</div>
                <div>Empresa: {selectedRequest.requestedCompanySlug || "Não informada"}</div>
                <div>Tipo: {requestTypeLabel(selectedRequest.requestType)}</div>
              </div>
            )}

            {activeDetailTab === "review" && (
              <div className="grid gap-2 text-sm">
                <div data-testid="access-request-review-current-role">Perfil atual: não informado</div>
                <div data-testid="access-request-review-requested-role">Perfil solicitado: {selectedRequest.requestedRole ?? "não informado"}</div>
                <div data-testid="access-request-review-company">Empresa vinculada: {selectedRequest.requestedCompanySlug || "não informado"}</div>
                <div data-testid="access-request-review-permissions">Permissões liberadas: validar no backend antes de aplicar</div>
                <div data-testid="access-request-review-risk">Risco: médio</div>
              </div>
            )}

            {activeDetailTab === "history" && (
              <div className="grid gap-1 text-sm">
                <div>Solicitação criada em {new Date(selectedRequest.createdAt).toLocaleString()}</div>
                <div>Status atual: {selectedRequest.status}</div>
                {selectedRequest.reviewComment && <div>Última observação: {selectedRequest.reviewComment}</div>}
              </div>
            )}

            {activeDetailTab === "audit" && (
              <div className="grid gap-1 text-sm">
                <div>ID da solicitação: {selectedRequest.id}</div>
                <div>Audit trail: conferir eventos de aprovação/rejeição no backend</div>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

export default AdminRequestsPage;
