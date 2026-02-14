"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getAccessToken } from "@/lib/api";
import {
  extractMessageFromJson,
  extractRequestIdFromJson,
  formatMessageWithRequestId,
  unwrapEnvelopeData,
} from "@/lib/apiEnvelope";

import type {
  AccessRequestItem,
  AccessTypeLabel,
  ClientOption,
  RawSupportRequest,
} from "./shared";
import { parseFromMessage } from "./shared";

function computeDirty(a: AccessRequestItem, b: Partial<AccessRequestItem>) {
  const fields: Array<keyof AccessRequestItem> = [
    "accessType",
    "clientId",
    "company",
    "jobRole",
    "name",
    "email",
    "notes",
    "adminNotes",
  ];
  return fields.some((f) => b[f] !== a[f]);
}

function toAcceptAccessType(label: AccessTypeLabel): "admin" | "company" | "user" {
  if (label === "Admin do sistema") return "admin";
  if (label === "Admin da empresa") return "company";
  return "user";
}

function getItemsFromEnvelope<T>(value: unknown): T[] {
  if (!value || typeof value !== "object") return [];
  const items = (value as { items?: unknown }).items;
  return Array.isArray(items) ? (items as T[]) : [];
}

function statusLabel(status: string) {
  if (status === "closed") return "Aprovada";
  if (status === "rejected") return "Rejeitada";
  if (status === "in_progress") return "Em analise";
  return "Aberta";
}

function statusBadgeClass(status: string) {
  if (status === "closed") return "bg-emerald-50 text-emerald-700";
  if (status === "rejected") return "bg-rose-50 text-rose-700";
  if (status === "in_progress") return "bg-amber-50 text-amber-700";
  return "bg-slate-100 text-slate-700";
}

async function fetchWithToken(url: string, init?: RequestInit) {
  const token = await getAccessToken().catch(() => null);
  const headers = new Headers(init?.headers as HeadersInit | undefined);
  if (token && !headers.has("authorization")) headers.set("Authorization", `Bearer ${token}`);
  return fetch(url, { ...init, headers, credentials: "include", cache: "no-store" });
}

const inputBase =
  "mt-1 w-full rounded-lg border border-[#e5e7eb] bg-white px-3 py-2 text-sm text-[#1e293b] transition focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10";

const labelBase = "text-[11px] font-semibold uppercase tracking-[0.3em] text-[#94a3b8]";
const sectionCard = "rounded-xl border border-[#e5e7eb] bg-white p-4";
const sectionMuted = "rounded-xl border border-[#e5e7eb] bg-[#f8fafc] p-4";

export type AccessRequestComment = {
  id: string;
  requestId: string;
  authorRole: "admin" | "requester";
  authorName: string;
  authorEmail?: string | null;
  body: string;
  createdAt: string;
};

type AccessRequestsClientProps = {
  initialRequests: AccessRequestItem[];
  initialClients: ClientOption[];
};

export function AccessRequestsClient({ initialRequests, initialClients }: AccessRequestsClientProps) {
  const [items, setItems] = useState<AccessRequestItem[]>(() => initialRequests);
  const [clients, setClients] = useState<ClientOption[]>(() => initialClients);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(initialRequests[0]?.id ?? null);
  const [draft, setDraft] = useState<Partial<AccessRequestItem> | null>(initialRequests[0] ?? null);
  const [saving, setSaving] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [comments, setComments] = useState<AccessRequestComment[]>([]);
  const [commentDraft, setCommentDraft] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);
  const [commentSaving, setCommentSaving] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);

  const draftTouchedRef = useRef(false);

  const selected = useMemo(
    () => (selectedId ? items.find((i) => i.id === selectedId) ?? null : null),
    [items, selectedId],
  );

  const dirty = useMemo(() => {
    if (!selected || !draft) return false;
    return computeDirty(selected, draft);
  }, [selected, draft]);

  const mapRequests = useCallback((rawItems: RawSupportRequest[]) => {
    return rawItems.map((r) => {
      const parsedMsg = parseFromMessage(String(r.message ?? ""), String(r.email ?? ""));
      return {
        id: String(r.id),
        createdAt: String(r.created_at),
        status: String(r.status ?? "open"),
        email: String(parsedMsg.email ?? r.email ?? ""),
        name: String(parsedMsg.name ?? ""),
        jobRole: String(parsedMsg.jobRole ?? ""),
        accessType: (parsedMsg.accessType as AccessTypeLabel) ?? "Usuario da empresa",
        clientId: parsedMsg.clientId ?? null,
        company: String(parsedMsg.company ?? ""),
        notes: String(parsedMsg.notes ?? ""),
        rawMessage: String(r.message ?? ""),
        adminNotes: (r.admin_notes as string | null) ?? null,
      } satisfies AccessRequestItem;
    });
  }, []);

  const mapClients = useCallback((values: unknown[]): ClientOption[] => {
    return values
      .map((c) => {
        const rec = (c ?? null) as Record<string, unknown> | null;
        return {
          id: typeof rec?.id === "string" ? rec.id : "",
          name:
            (typeof rec?.name === "string" ? rec.name : "") ||
            (typeof rec?.company_name === "string" ? String(rec.company_name) : ""),
        } satisfies ClientOption;
      })
      .filter((c) => c.id && c.name);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [reqRes, clientsRes] = await Promise.all([
        fetchWithToken("/api/admin/access-requests"),
        fetchWithToken("/api/clients"),
      ]);

      const reqRaw = await reqRes.json().catch(() => null);
      if (!reqRes.ok) {
        const msg = extractMessageFromJson(reqRaw) || "Falha ao carregar solicitações";
        const requestId = extractRequestIdFromJson(reqRaw) || reqRes.headers.get("x-request-id") || null;
        setError(formatMessageWithRequestId(msg, requestId));
        setItems([]);
        return;
      }

      const reqData = unwrapEnvelopeData<Record<string, unknown>>(reqRaw) ?? (reqRaw as Record<string, unknown> | null) ?? {};
      const rawItems = getItemsFromEnvelope<RawSupportRequest>(reqData);
      const parsed = mapRequests(rawItems);

      const cRaw = await clientsRes.json().catch(() => null);
      if (!clientsRes.ok) {
        const msg = extractMessageFromJson(cRaw) || "Falha ao carregar empresas";
        const requestId = extractRequestIdFromJson(cRaw) || clientsRes.headers.get("x-request-id") || null;
        setError(formatMessageWithRequestId(msg, requestId));
        setClients([]);
      }

      const cData = unwrapEnvelopeData<Record<string, unknown>>(cRaw) ?? (cRaw as Record<string, unknown> | null) ?? {};
      const cItems = getItemsFromEnvelope<unknown>(cData);
      const mappedClients = mapClients(cItems);

      setClients(mappedClients);
      setItems(parsed);
      try {
        console.debug(
          "[E2E][access-requests] carregou itens:",
          parsed.length,
          parsed.map((p) => ({ id: p.id, status: p.status })),
        );
      } catch {}
      setSelectedId((prev) => (prev && parsed.some((p) => p.id === prev) ? prev : parsed[0]?.id ?? null));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }, [mapClients, mapRequests]);

  const loadComments = useCallback(
    async (id: string | null) => {
      if (!id) {
        setComments([]);
        return;
      }
      setCommentLoading(true);
      setCommentError(null);
      try {
        const res = await fetchWithToken(`/api/admin/access-requests/${id}/comments`);
        const json = (await res.json().catch(() => ({}))) as { items?: AccessRequestComment[]; error?: string };
        if (!res.ok) {
          setCommentError(json?.error || "Falha ao carregar comentarios");
          setComments([]);
          return;
        }
        setComments(Array.isArray(json.items) ? json.items : []);
      } catch (err) {
        setCommentError(err instanceof Error ? err.message : "Erro ao carregar comentarios");
        setComments([]);
      } finally {
        setCommentLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!selected) {
      setDraft(null);
      draftTouchedRef.current = false;
      return;
    }
    if (!draftTouchedRef.current) {
      setDraft({ ...selected });
    }
  }, [selected]);

  useEffect(() => {
    draftTouchedRef.current = false;
  }, [selectedId]);

  useEffect(() => {
    loadComments(selectedId);
  }, [selectedId, loadComments]);

  useEffect(() => {
    setCommentDraft("");
  }, [selectedId]);

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
  }

  async function saveChanges() {
    if (!selected || !draft) return;

    setSaving(true);
    setError(null);
    try {
      const res = await fetchWithToken(`/api/admin/access-requests/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: draft.email,
          name: draft.name,
          role: draft.jobRole,
          company: draft.company,
          client_id: draft.clientId,
          admin_notes: draft.adminNotes ?? "",
          access_type: draft.accessType,
          notes: draft.notes,
        }),
      });

      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        setError((json.error as string) || (json.message as string) || "Falha ao salvar");
        return;
      }

      draftTouchedRef.current = false;
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function submitComment() {
    if (!selected) return;
    const body = commentDraft.trim();
    if (!body) return;

    setCommentSaving(true);
    setCommentError(null);
    try {
      const res = await fetchWithToken(`/api/admin/access-requests/${selected.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setCommentError(json?.error || "Falha ao enviar comentario");
        return;
      }
      setCommentDraft("");
      await loadComments(selected.id);
    } finally {
      setCommentSaving(false);
    }
  }

  async function acceptRequest() {
    if (!selected || !draft) return;

    setAccepting(true);
    setError(null);
    try {
      const res = await fetchWithToken(`/api/admin/access-requests/${selected.id}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: draft.email,
          name: draft.name,
          client_id: draft.clientId,
          comment: draft.adminNotes ?? "",
          admin_notes: draft.adminNotes ?? "",
          access_type: toAcceptAccessType((draft.accessType ?? "Usuario da empresa") as AccessTypeLabel),
        }),
      });

      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      try {
        console.debug("[E2E][access-requests][accept] res.ok=", res.ok, "status=", res.status, "body=", json);
      } catch {}
      if (!res.ok) {
        setError((json.error as string) || (json.message as string) || "Falha ao aceitar");
        return;
      }

      draftTouchedRef.current = false;
      await load();
      await loadComments(selected.id);
    } finally {
      setAccepting(false);
    }
  }

  async function rejectRequest() {
    if (!selected || !draft) return;

    setAccepting(true);
    setError(null);
    try {
      const res = await fetchWithToken(`/api/admin/access-requests/${selected.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: draft.adminNotes ?? "",
          comment: draft.adminNotes ?? "",
        }),
      });

      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      try {
        console.debug("[E2E][access-requests][reject] res.ok=", res.ok, "status=", res.status, "body=", json);
      } catch {}
      if (!res.ok) {
        setError((json.error as string) || (json.message as string) || "Falha ao recusar");
        return;
      }

      draftTouchedRef.current = false;
      await load();
      await loadComments(selected.id);
    } finally {
      setAccepting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#1e293b]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.45em] text-[#94a3b8]">Admin</p>
            <h1 className="mt-2 text-3xl font-semibold">Solicitacoes de acesso</h1>
            <p className="mt-1 text-sm text-[#64748b]">Acompanhe, revise e aprove solicitacoes em um unico lugar.</p>
          </div>
          <button
            onClick={load}
            className="rounded-full border border-[#e5e7eb] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-[#1e293b] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            disabled={loading}
          >
            {loading ? "Atualizando..." : "Atualizar"}
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className={labelBase}>Solicitacoes</h2>
              <span className="text-xs text-[#94a3b8]">{items.length}</span>
            </div>

            <div className="mt-4 space-y-3">
              {loading ? (
                <div className={sectionMuted + " text-sm text-[#64748b]"}>
                  Carregando...
                </div>
              ) : items.length === 0 ? (
                <div className={sectionMuted + " text-sm text-[#64748b]"}>
                  Nenhuma solicitacao.
                </div>
              ) : (
                items.map((it) => (
                  <button
                    key={it.id}
                    className={`w-full text-left rounded-xl border border-transparent bg-white p-4 shadow-[0_4px_16px_rgba(0,0,0,0.05)] transition hover:-translate-y-0.5 hover:border-[#e5e7eb] hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] ${
                      selectedId === it.id ? "border-indigo-100 bg-[#f8fafc]" : ""
                    }`}
                    onClick={() => setSelectedId(it.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-base font-semibold text-[#1e293b] truncate">
                          {it.name || "(sem nome)"}
                        </div>
                        <div className="mt-1 text-xs text-[#94a3b8] truncate">{it.email}</div>
                      </div>
                      <div className="text-xs text-[#64748b] whitespace-nowrap">
                        {new Date(it.createdAt).toLocaleDateString("pt-BR")}
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-medium ${statusBadgeClass(it.status)}`}>
                        {statusLabel(it.status)}
                      </span>
                      <button
                        type="button"
                        className="rounded-full border border-[#e5e7eb] px-3 py-1 text-[11px] font-semibold text-[#475569] transition hover:border-[#cbd5f5] hover:text-[#1e293b]"
                        onClick={(e) => {
                          e.stopPropagation();
                          copy(it.email);
                        }}
                        title="Copiar email"
                        aria-label="Copiar email"
                      >
                        Copiar
                      </button>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-[0_8px_32px_rgba(0,0,0,0.05)]">
            {!selected || !draft ? (
              <div className="text-sm text-[#64748b]">Selecione uma solicitacao.</div>
            ) : (
              <div className="space-y-6">
                <div className={sectionMuted + " flex flex-wrap items-center justify-between gap-4"}>
                  <div>
                    <p className={labelBase}>Solicitante</p>
                    <h2 className="mt-2 text-xl font-semibold text-[#1e293b]">
                      {selected.name || "(sem nome)"}
                    </h2>
                    <p className="mt-1 text-sm text-[#64748b]">{selected.email}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-medium ${statusBadgeClass(selected.status)}`}>
                      {statusLabel(selected.status)}
                    </span>
                    <span className="text-xs text-[#94a3b8]">
                      {new Date(selected.createdAt).toLocaleString("pt-BR")}
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <h3 className="text-lg font-semibold text-[#1e293b]">Detalhes da solicitacao</h3>
                  <p className="text-sm text-[#64748b]">Revise os dados e tome uma decisao.</p>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="block text-sm font-medium text-[#1e293b]">
                    Tipo de acesso
                    <select
                      className={inputBase}
                      value={(draft.accessType ?? "Usuario da empresa") as AccessTypeLabel}
                      onChange={(e) => {
                        draftTouchedRef.current = true;
                        const v = e.target.value as AccessTypeLabel;
                        setDraft((d) => (d ? { ...d, accessType: v } : d));
                        if (v === "Admin do sistema") setDraft((d) => (d ? { ...d, clientId: null, company: "" } : d));
                      }}
                      aria-label="Tipo de acesso"
                      title="Tipo de acesso"
                    >
                      <option value="Usuario da empresa">Usuario da empresa</option>
                      <option value="Admin da empresa">Admin da empresa</option>
                      <option value="Admin do sistema">Admin do sistema</option>
                    </select>
                  </label>

                  <label className="block text-sm font-medium text-[#1e293b]">
                    Empresa
                    <select
                      className={inputBase}
                      value={draft.clientId ?? ""}
                      onChange={(e) => {
                        draftTouchedRef.current = true;
                        const id = e.target.value || null;
                        const match = clients.find((c) => c.id === id);
                        setDraft((d) => (d ? { ...d, clientId: id, company: match?.name ?? d.company ?? "" } : d));
                        try {
                          console.debug("[E2E][access-requests] select empresa -> id=", id, "match=", match?.name);
                        } catch {}
                      }}
                      disabled={draft.accessType === "Admin do sistema"}
                      aria-label="Empresa"
                      title="Empresa"
                    >
                      <option value="">Selecionar empresa</option>
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block text-sm font-medium text-[#1e293b]">
                    Nome
                    <input
                      className={inputBase}
                      value={draft.name ?? ""}
                      onChange={(e) => {
                        draftTouchedRef.current = true;
                        setDraft((d) => (d ? { ...d, name: e.target.value } : d));
                      }}
                    />
                  </label>

                  <label className="block text-sm font-medium text-[#1e293b]">
                    Email
                    <input
                      type="email"
                      className={inputBase}
                      value={draft.email ?? ""}
                      onChange={(e) => {
                        draftTouchedRef.current = true;
                        setDraft((d) => (d ? { ...d, email: e.target.value } : d));
                      }}
                    />
                  </label>

                  <label className="block text-sm font-medium text-[#1e293b] sm:col-span-2">
                    Cargo
                    <input
                      className={inputBase}
                      value={draft.jobRole ?? ""}
                      onChange={(e) => {
                        draftTouchedRef.current = true;
                        setDraft((d) => (d ? { ...d, jobRole: e.target.value } : d));
                      }}
                    />
                  </label>

                  <label className="block text-sm font-medium text-[#1e293b] sm:col-span-2">
                    Observacoes
                    <textarea
                      className={inputBase}
                      rows={4}
                      value={draft.notes ?? ""}
                      onChange={(e) => {
                        draftTouchedRef.current = true;
                        setDraft((d) => (d ? { ...d, notes: e.target.value } : d));
                      }}
                    />
                  </label>

                  <label className="block text-sm font-medium text-[#1e293b] sm:col-span-2">
                    Notas do admin (motivo / observacao)
                    <textarea
                      className={inputBase}
                      rows={3}
                      value={draft.adminNotes ?? ""}
                      onChange={(e) => {
                        draftTouchedRef.current = true;
                        setDraft((d) => (d ? { ...d, adminNotes: e.target.value } : d));
                      }}
                    />
                  </label>
                </div>

                <div className={sectionMuted + " space-y-3"}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-[#1e293b]">Comentarios</p>
                    {commentLoading && <span className="text-xs text-[#94a3b8]">Carregando...</span>}
                  </div>

                  {commentError && (
                    <div className="rounded-lg bg-[#fff7ed] px-3 py-2 text-xs text-[#c2410c]">
                      {commentError}
                    </div>
                  )}

                  <div className="comments-chat">
                    <div className="comments-chat-list" aria-live="polite">
                      {comments.length === 0 ? (
                        <p className="comments-chat-empty">Nenhum comentario ainda.</p>
                      ) : (
                        comments.map((comment) => {
                          const mine = comment.authorRole === "admin";
                          return (
                            <div
                              key={comment.id}
                              className={`comments-chat-message ${mine ? "mine" : "other"}`}
                            >
                              <div className="comments-chat-author">
                                {comment.authorRole === "admin" ? "Admin" : "Solicitante"}: {comment.authorName}
                              </div>
                              <div className="comments-chat-bubble whitespace-pre-wrap">{comment.body}</div>
                              <div className="comments-chat-meta">
                                {new Date(comment.createdAt).toLocaleString("pt-BR")}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    <div className="comments-chat-input">
                      <textarea
                        className={`${inputBase} mt-0`}
                        rows={3}
                        placeholder="Responder comentario"
                        value={commentDraft}
                        onChange={(e) => setCommentDraft(e.target.value)}
                      />
                      <div className="comments-chat-actions">
                        <button
                          type="button"
                          onClick={submitComment}
                          disabled={commentSaving || !commentDraft.trim()}
                          className="rounded-lg border border-[#e5e7eb] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-[#1e293b] transition hover:-translate-y-0.5 hover:shadow-md disabled:opacity-60"
                        >
                          {commentSaving ? "Enviando..." : "Enviar comentario"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e5e7eb] bg-white px-4 py-3">
                  <div className="text-xs text-[#94a3b8]">Acoes</div>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={saveChanges}
                      disabled={!dirty || saving}
                      className="rounded-full border border-[#e5e7eb] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-[#1e293b] transition hover:-translate-y-0.5 hover:shadow-md disabled:opacity-60"
                    >
                      {saving ? "Salvando..." : "Salvar alteracoes"}
                    </button>
                    {(() => {
                      const acceptDisabled =
                        accepting || ((draft.accessType ?? "Usuario da empresa") !== "Admin do sistema" && !draft.clientId);
                      try {
                        console.debug(
                          "[E2E][access-requests] acceptDisabled=",
                          acceptDisabled,
                          "accessType=",
                          draft.accessType,
                          "clientId=",
                          draft.clientId,
                        );
                      } catch {}
                      return (
                        <button
                          type="button"
                          onClick={acceptRequest}
                          aria-label="Aceitar solicitacao"
                          disabled={acceptDisabled}
                          className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white transition hover:bg-emerald-600 disabled:opacity-60"
                        >
                          {accepting ? "Aceitando..." : "Aprovar"}
                        </button>
                      );
                    })()}

                    <button
                      type="button"
                      onClick={rejectRequest}
                      aria-label="Recusar solicitacao"
                      disabled={accepting}
                      className="rounded-full border border-rose-500 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-rose-600 transition hover:bg-rose-50 disabled:opacity-60"
                    >
                      {accepting ? "Processando..." : "Recusar"}
                    </button>
                  </div>
                </div>

                <details className={sectionCard}>
                  <summary className="cursor-pointer text-sm text-[#64748b]">Ver mensagem bruta</summary>
                  <pre className="mt-3 whitespace-pre-wrap text-xs text-[#475569]">{selected.rawMessage}</pre>
                </details>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
