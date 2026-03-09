"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RequireGlobalDeveloper } from "@/core/auth/RequireGlobalDeveloper";
import { getAccessToken } from "@/lib/api";
import { extractMessageFromJson, extractRequestIdFromJson, formatMessageWithRequestId, unwrapEnvelopeData } from "@/lib/apiEnvelope";
import { type AccessRequestAdjustmentEntry } from "@/lib/accessRequestMessage";
import {
  normalizeRequestProfileType,
  requestProfileTypeNeedsCompany,
  toInternalAccessType,
  toRequestProfileTypeLabel,
  type RequestProfileTypeLabel,
} from "@/lib/requestRouting";

type ClientOption = { id: string; name: string };

type RawSupportRequest = {
  id: string;
  email: string;
  message: string;
  status: string;
  created_at: string;
  admin_notes?: string | null;
};

type AccessTypeLabel = RequestProfileTypeLabel;

type AccessRequestItem = {
  id: string;
  createdAt: string;
  status: string;
  email: string;
  name: string;
  fullName: string;
  username: string | null;
  phone: string;
  jobRole: string;
  accessType: AccessTypeLabel;
  clientId: string | null;
  company: string;
  title: string;
  description: string;
  notes: string;
  passwordProvided: boolean;
  lastAdjustmentAt: string | null;
  lastAdjustmentDiff: AccessRequestAdjustmentEntry[];
  rawMessage: string;
  adminNotes: string | null;
};

type UserLoginCandidate = {
  id: string;
  email: string;
  user?: string | null;
};

type AccessRequestComment = {
  id: string;
  requestId: string;
  authorRole: "admin" | "requester";
  authorName: string;
  authorEmail?: string | null;
  body: string;
  createdAt: string;
};

function parseAccessType(accessType: unknown): AccessTypeLabel {
  return toRequestProfileTypeLabel(normalizeRequestProfileType(typeof accessType === "string" ? accessType : "") ?? "company_user");
}

function parseFromMessage(message: string, fallbackEmail: string): Partial<AccessRequestItem> {
  const prefix = "ACCESS_REQUEST_V1 ";
  const line = message.split("\n").find((l) => l.startsWith(prefix));
  if (line) {
    try {
      const json = JSON.parse(line.slice(prefix.length)) as Record<string, unknown>;
      return {
        email: typeof json.email === "string" ? json.email : fallbackEmail,
        name: typeof json.name === "string" ? json.name : "",
        fullName:
          typeof json.fullName === "string"
            ? json.fullName
            : typeof json.name === "string"
              ? json.name
              : "",
        username: typeof json.username === "string" ? json.username : null,
        phone: typeof json.phone === "string" ? json.phone : "",
        jobRole: typeof json.jobRole === "string" ? json.jobRole : "",
        company: typeof json.company === "string" ? json.company : "",
        clientId: typeof json.clientId === "string" ? json.clientId : null,
        accessType: parseAccessType(typeof json.profileType === "string" ? json.profileType : json.accessType),
        title: typeof json.title === "string" ? json.title : "",
        description: typeof json.description === "string" ? json.description : "",
        notes: typeof json.notes === "string" ? json.notes : "",
        passwordProvided: typeof json.passwordHash === "string" && json.passwordHash.trim().length > 0,
        lastAdjustmentAt: typeof json.lastAdjustmentAt === "string" ? json.lastAdjustmentAt : null,
        lastAdjustmentDiff: Array.isArray(json.lastAdjustmentDiff)
          ? json.lastAdjustmentDiff
              .map((entry) => {
                const record = entry as Record<string, unknown>;
                return {
                  field: typeof record.field === "string" ? (record.field as AccessRequestAdjustmentEntry["field"]) : "notes",
                  label: typeof record.label === "string" ? record.label : "Campo",
                  previous: typeof record.previous === "string" ? record.previous : "",
                  next: typeof record.next === "string" ? record.next : "",
                } satisfies AccessRequestAdjustmentEntry;
              })
              .filter((entry) => entry.label)
          : [],
      };
    } catch {
      // fallthrough
    }
  }

  // Legacy fallback
  const lines = message.split("\n").map((l) => l.trim());
  const find = (label: string) => {
    const hit = lines.find((l) => l.toLowerCase().startsWith(label.toLowerCase() + ":"));
    return hit ? hit.slice(label.length + 1).trim() : "";
  };

  return {
    email: fallbackEmail,
    name: find("Nome"),
    fullName: find("Nome completo") || find("Nome"),
    username: find("Usuario") || null,
    phone: find("Telefone"),
    jobRole: find("Cargo"),
    company: find("Empresa"),
    accessType: "Usuario Testing Company",
    title: find("Titulo da solicitacao") || find("Titulo"),
    description: find("Descricao detalhada") || find("Descricao"),
    notes: find("Observacoes") || find("Mensagem"),
    clientId: null,
    passwordProvided: false,
    lastAdjustmentAt: null,
    lastAdjustmentDiff: [],
  };
}

function slugifyUsernamePart(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .replace(/\.{2,}/g, ".");
}

function buildUniqueUsername(source: string, existingLogins: string[], currentValue?: string | null) {
  const base = slugifyUsernamePart(source) || "usuario";
  const current = (currentValue ?? "").trim().toLowerCase();
  const taken = new Set(
    existingLogins.map((item) => item.trim().toLowerCase()).filter((item) => item && item !== current),
  );

  if (!taken.has(base)) return base;

  let counter = 2;
  while (taken.has(`${base}${counter}`)) {
    counter += 1;
  }
  return `${base}${counter}`;
}

async function fetchWithToken(url: string, init?: RequestInit) {
  const token = await getAccessToken().catch(() => null);
  const headers = new Headers(init?.headers as HeadersInit | undefined);
  if (token && !headers.has("authorization")) headers.set("Authorization", `Bearer ${token}`);
  return fetch(url, { ...init, headers, credentials: "include", cache: "no-store" });
}

function toAcceptAccessType(label: AccessTypeLabel): "admin" | "company" | "user" | "global" {
  return toInternalAccessType(normalizeRequestProfileType(label) ?? "company_user");
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

function adjustmentFieldLabel(field: AccessRequestAdjustmentEntry["field"], fallback: string) {
  if (field === "profileType") return "Perfil";
  if (field === "company") return "Empresa";
  if (field === "fullName") return "Nome completo";
  if (field === "username") return "Usuario";
  if (field === "email") return "E-mail";
  if (field === "phone") return "Telefone";
  if (field === "jobRole") return "Cargo";
  if (field === "title") return "Titulo";
  if (field === "description") return "Descricao";
  if (field === "notes") return "Observacoes";
  if (field === "password") return "Senha";
  return fallback || "Campo";
}

function adjustmentFieldBadgeClass(field: AccessRequestAdjustmentEntry["field"]) {
  if (field === "profileType" || field === "company") {
    return "border-sky-200 bg-sky-50 text-sky-700";
  }
  if (field === "password") {
    return "border-violet-200 bg-violet-50 text-violet-700";
  }
  if (field === "title" || field === "description" || field === "notes" || field === "jobRole") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

const inputBase =
  "mt-1 w-full rounded-lg border border-[#e5e7eb] bg-white px-3 py-2 text-sm text-[#1e293b] transition focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10";

const labelBase = "text-[11px] font-semibold uppercase tracking-[0.3em] text-[#94a3b8]";
const sectionCard = "rounded-xl border border-[#e5e7eb] bg-white p-4";
const sectionMuted = "rounded-xl border border-[#e5e7eb] bg-[#f8fafc] p-4";

function AccessRequestsPage() {
  const [items, setItems] = useState<AccessRequestItem[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [existingLogins, setExistingLogins] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<AccessRequestItem> | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [requestingAdjustment, setRequestingAdjustment] = useState(false);
  const [comments, setComments] = useState<AccessRequestComment[]>([]);
  const [commentDraft, setCommentDraft] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);

  // Track whether the user has modified the draft form since the last selection change.
  // Prevents React Strict Mode double-invoke of load() from resetting user edits.
  const draftTouchedRef = useRef(false);

  const selected = useMemo(
    () => (selectedId ? items.find((i) => i.id === selectedId) ?? null : null),
    [items, selectedId],
  );

  const selectedAdjustmentDiff = selected?.lastAdjustmentDiff ?? [];
  const selectedHasRequesterAdjustment = Boolean(selected?.lastAdjustmentAt && selectedAdjustmentDiff.length > 0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [reqRes, clientsRes, usersRes] = await Promise.all([
        fetchWithToken("/api/admin/access-requests"),
        fetchWithToken("/api/clients"),
        fetchWithToken("/api/admin/users"),
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

      const parsed: AccessRequestItem[] = rawItems.map((r) => {
        const parsedMsg = parseFromMessage(String(r.message ?? ""), String(r.email ?? ""));
        return {
          id: String(r.id),
          createdAt: String(r.created_at),
          status: String(r.status ?? "open"),
          email: String(parsedMsg.email ?? r.email ?? ""),
          name: String(parsedMsg.fullName ?? parsedMsg.name ?? ""),
          fullName: String(parsedMsg.fullName ?? parsedMsg.name ?? ""),
          username: typeof parsedMsg.username === "string" ? parsedMsg.username : null,
          phone: String(parsedMsg.phone ?? ""),
          jobRole: String(parsedMsg.jobRole ?? ""),
          accessType: (parsedMsg.accessType as AccessTypeLabel) ?? "Usuario Testing Company",
          clientId: parsedMsg.clientId ?? null,
          company: String(parsedMsg.company ?? ""),
          title: String(parsedMsg.title ?? ""),
          description: String(parsedMsg.description ?? ""),
          notes: String(parsedMsg.notes ?? ""),
          passwordProvided: parsedMsg.passwordProvided === true,
          lastAdjustmentAt: typeof parsedMsg.lastAdjustmentAt === "string" ? parsedMsg.lastAdjustmentAt : null,
          lastAdjustmentDiff: Array.isArray(parsedMsg.lastAdjustmentDiff) ? parsedMsg.lastAdjustmentDiff : [],
          rawMessage: String(r.message ?? ""),
          adminNotes: (r.admin_notes as string | null) ?? null,
        };
      });


      const cRaw = await clientsRes.json().catch(() => null);
      if (!clientsRes.ok) {
        const msg = extractMessageFromJson(cRaw) || "Falha ao carregar empresas";
        const requestId = extractRequestIdFromJson(cRaw) || clientsRes.headers.get("x-request-id") || null;
        setError(formatMessageWithRequestId(msg, requestId));
        setClients([]);
      }

      const cData = unwrapEnvelopeData<Record<string, unknown>>(cRaw) ?? (cRaw as Record<string, unknown> | null) ?? {};
      const cItems = getItemsFromEnvelope<unknown>(cData);
      const mappedClients = cItems
        .map((c) => {
          const rec = (c ?? null) as Record<string, unknown> | null;
          return {
            id: typeof rec?.id === "string" ? rec.id : "",
            name:
              (typeof rec?.name === "string" ? rec.name : "") ||
              (typeof rec?.company_name === "string" ? String(rec.company_name) : ""),
          };
        })
        .filter((c) => c.id && c.name);

      const uRaw = await usersRes.json().catch(() => null);
      const uData = unwrapEnvelopeData<Record<string, unknown>>(uRaw) ?? (uRaw as Record<string, unknown> | null) ?? {};
      const uItems = getItemsFromEnvelope<UserLoginCandidate>(uData);
      const mappedLogins = Array.from(
        new Set(
          uItems.flatMap((item) => {
            const values = [item.user, item.email];
            return values
              .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
              .map((value) => value.trim().toLowerCase());
          }),
        ),
      );

      setClients(mappedClients);
      setExistingLogins(mappedLogins);
      setItems(parsed);
      // Log para debugar E2E: quantos itens e status carregados
      try {
        console.debug("[E2E][access-requests] carregou itens:", parsed.length, parsed.map((p) => ({ id: p.id, status: p.status })));
      } catch {}
      setSelectedId((prev) => (prev && parsed.some((p) => p.id === prev) ? prev : parsed[0]?.id ?? null));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }, []);

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
    load();
  }, [load]);

  useEffect(() => {
    if (!selected) {
      setDraft(null);
      draftTouchedRef.current = false;
      return;
    }
    // Only reset draft from selected when the user hasn't modified it yet.
    // This prevents a reload (or React Strict Mode double-invoke) from
    // overwriting user changes (e.g. Empresa selection).
    if (!draftTouchedRef.current) {
      const generatedUsername = buildUniqueUsername(
        selected.fullName || selected.name || selected.email,
        existingLogins,
        selected.username,
      );
      setDraft({ ...selected, username: selected.username ?? generatedUsername });
    }
  }, [existingLogins, selected]);

  // Reset the touched flag when the user picks a different row so
  // the draft initializes fresh for the new selection.
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
      // ignore
    }
  }

  async function requestAdjustment() {
    if (!selected) return;
    const body = commentDraft.trim();
    if (!body) return;

    setRequestingAdjustment(true);
    setCommentError(null);
    setError(null);
    try {
      const res = await fetchWithToken(`/api/admin/access-requests/${selected.id}/request-adjustment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment: body }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setCommentError(json?.error || "Falha ao solicitar ajuste");
        return;
      }
      setCommentDraft("");
      draftTouchedRef.current = false;
      await load();
      await loadComments(selected.id);
    } finally {
      setRequestingAdjustment(false);
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
          name: draft.fullName,
          full_name: draft.fullName,
          user: draft.username,
          phone: draft.phone,
          client_id: draft.clientId,
          comment: commentDraft.trim(),
          admin_notes: commentDraft.trim(),
          access_type: toAcceptAccessType((draft.accessType ?? "Usuario Testing Company") as AccessTypeLabel),
        }),
      });

      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      // Log de resposta para diagnóstico E2E
      try {
        console.debug("[E2E][access-requests][accept] res.ok=", res.ok, "status=", res.status, "body=", json);
      } catch {}
      if (!res.ok) {
        setError((json.error as string) || (json.message as string) || "Falha ao aceitar");
        return;
      }

      // Reset before reload so the [selected] effect can set draft from fresh data.
      draftTouchedRef.current = false;
      setCommentDraft("");
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
          reason: commentDraft.trim(),
          comment: commentDraft.trim(),
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

      // Reset before reload so the [selected] effect can set draft from fresh data.
      draftTouchedRef.current = false;
      setCommentDraft("");
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
                          {it.fullName || it.name || "(sem nome)"}
                        </div>
                        <div className="mt-1 text-xs text-[#94a3b8] truncate">{it.email}</div>
                      </div>
                      <div className="text-xs text-[#64748b] whitespace-nowrap">
                        {new Date(it.createdAt).toLocaleDateString("pt-BR")}
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-medium ${statusBadgeClass(it.status)}`}>
                          {statusLabel(it.status)}
                        </span>
                        {it.lastAdjustmentAt && it.lastAdjustmentDiff.length > 0 ? (
                          <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-medium text-amber-700">
                            Reenviada com ajustes
                          </span>
                        ) : null}
                      </div>
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
                    {it.lastAdjustmentDiff.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {it.lastAdjustmentDiff.slice(0, 3).map((entry, index) => (
                          <span
                            key={`${it.id}-${entry.field}-${index}`}
                            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${adjustmentFieldBadgeClass(entry.field)}`}
                            title={entry.label}
                          >
                            {adjustmentFieldLabel(entry.field, entry.label)}
                          </span>
                        ))}
                        {it.lastAdjustmentDiff.length > 3 ? (
                          <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">
                            +{it.lastAdjustmentDiff.length - 3}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
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
                      {selected.fullName || selected.name || "(sem nome)"}
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

                {selectedHasRequesterAdjustment ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-amber-900">Solicitação reenviada com ajustes</p>
                        <p className="mt-1 text-xs text-amber-800">
                          Ultimo reenvio em{" "}
                          <span suppressHydrationWarning={true}>
                            {selected?.lastAdjustmentAt ? new Date(selected.lastAdjustmentAt).toLocaleString("pt-BR") : "-"}
                          </span>
                        </p>
                      </div>
                      <span className="rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-semibold text-amber-700">
                        {selectedAdjustmentDiff.length} alteracoes
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="sm:col-span-2 flex flex-wrap gap-2">
                        {selectedAdjustmentDiff.map((entry, index) => (
                          <span
                            key={`selected-adjustment-chip-${entry.field}-${index}`}
                            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${adjustmentFieldBadgeClass(entry.field)}`}
                            title={entry.label}
                          >
                            {adjustmentFieldLabel(entry.field, entry.label)}
                          </span>
                        ))}
                      </div>
                      {selectedAdjustmentDiff.map((entry, index) => (
                        <div key={`${entry.field}-${index}`} className="rounded-lg border border-amber-200 bg-white px-3 py-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">{entry.label}</p>
                          <div className="mt-2 space-y-2 text-sm">
                            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">
                              <span className="block text-[10px] font-semibold uppercase tracking-[0.18em]">Antes</span>
                              <span className="mt-1 block whitespace-pre-wrap">{entry.previous}</span>
                            </div>
                            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">
                              <span className="block text-[10px] font-semibold uppercase tracking-[0.18em]">Agora</span>
                              <span className="mt-1 block whitespace-pre-wrap">{entry.next}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="space-y-1">
                  <h3 className="text-lg font-semibold text-[#1e293b]">Detalhes da solicitacao</h3>
                  <p className="text-sm text-[#64748b]">Revise os dados e tome uma decisao.</p>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-semibold text-[#1e293b]">Dados enviados pelo solicitante</p>
                  <p className="text-xs text-[#64748b]">
                    Esses campos ficam somente para leitura. Se algo estiver incorreto, envie uma mensagem pedindo ajuste.
                  </p>
                </div>

                <fieldset disabled className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="block text-sm font-medium text-[#1e293b]">
                    Tipo de perfil
                  <select
                    className={inputBase}
                    value={(draft.accessType ?? "Usuario Testing Company") as AccessTypeLabel}
                    onChange={(e) => {
                      draftTouchedRef.current = true;
                      const v = e.target.value as AccessTypeLabel;
                      setDraft((d) => (d ? { ...d, accessType: v } : d));
                      if (!requestProfileTypeNeedsCompany(normalizeRequestProfileType(v) ?? "company_user")) {
                        setDraft((d) => (d ? { ...d, clientId: null, company: "" } : d));
                      }
                    }}
                    aria-label="Tipo de perfil"
                    title="Tipo de perfil"
                  >
                    <option value="Usuario Testing Company">Usuario Testing Company</option>
                    <option value="Usuario Empresa">Usuario Empresa</option>
                    <option value="Usuario Lider TC">Usuario Lider TC</option>
                    <option value="Suporte tecnico">Suporte tecnico</option>
                  </select>
                </label>

                  <label className="block text-sm font-medium text-[#1e293b]">
                    Usuario gerado
                  <input
                    className={inputBase}
                    value={draft.username ?? ""}
                    onChange={(e) => {
                      draftTouchedRef.current = true;
                      setDraft((d) => (d ? { ...d, username: e.target.value.trim().toLowerCase() } : d));
                    }}
                  />
                </label>

                  <label className="block text-sm font-medium text-[#1e293b]">
                    Nome completo
                  <input
                    className={inputBase}
                    value={draft.fullName ?? ""}
                    onChange={(e) => {
                      const value = e.target.value;
                      draftTouchedRef.current = true;
                      setDraft((d) =>
                        d
                          ? {
                              ...d,
                              fullName: value,
                              username: buildUniqueUsername(value || d.email || "", existingLogins, d.username),
                            }
                          : d,
                      );
                    }}
                  />
                </label>

                  <label className="block text-sm font-medium text-[#1e293b]">
                    Email
                  <input
                    type="email"
                    className={inputBase}
                    value={draft.email ?? ""}
                    onChange={(e) => { draftTouchedRef.current = true; setDraft((d) => (d ? { ...d, email: e.target.value } : d)); }}
                  />
                </label>

                  <label className="block text-sm font-medium text-[#1e293b]">
                    Telefone
                  <input
                    className={inputBase}
                    value={draft.phone ?? ""}
                    onChange={(e) => { draftTouchedRef.current = true; setDraft((d) => (d ? { ...d, phone: e.target.value } : d)); }}
                  />
                </label>

                  {requestProfileTypeNeedsCompany(
                    normalizeRequestProfileType((draft.accessType ?? "Usuario Testing Company") as string) ?? "company_user",
                  ) ? (
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
                  ) : null}

                  <label className="block text-sm font-medium text-[#1e293b] sm:col-span-2">
                    Cargo
                  <input
                    className={inputBase}
                    value={draft.jobRole ?? ""}
                    onChange={(e) => { draftTouchedRef.current = true; setDraft((d) => (d ? { ...d, jobRole: e.target.value } : d)); }}
                  />
                </label>

                  <label className="block text-sm font-medium text-[#1e293b] sm:col-span-2">
                    Titulo da solicitacao
                  <input
                    className={inputBase}
                    value={draft.title ?? ""}
                    onChange={(e) => { draftTouchedRef.current = true; setDraft((d) => (d ? { ...d, title: e.target.value } : d)); }}
                  />
                </label>

                  <label className="block text-sm font-medium text-[#1e293b] sm:col-span-2">
                    Descricao detalhada
                  <textarea
                    className={inputBase}
                    rows={4}
                    value={draft.description ?? ""}
                    onChange={(e) => { draftTouchedRef.current = true; setDraft((d) => (d ? { ...d, description: e.target.value } : d)); }}
                  />
                </label>

                  <label className="block text-sm font-medium text-[#1e293b] sm:col-span-2">
                    Observacoes
                  <textarea
                    className={inputBase}
                    rows={4}
                    value={draft.notes ?? ""}
                    onChange={(e) => { draftTouchedRef.current = true; setDraft((d) => (d ? { ...d, notes: e.target.value } : d)); }}
                  />
                </label>

                  <div className="rounded-xl border border-[#e5e7eb] bg-[#f8fafc] px-4 py-3 text-sm sm:col-span-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold text-[#1e293b]">Senha informada na solicitacao</span>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${draft.passwordProvided ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                        {draft.passwordProvided ? "Preenchida" : "Ausente"}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-[#64748b]">
                      A aprovacao so pode seguir quando a solicitacao ja tiver uma senha definida pelo solicitante.
                    </p>
                  </div>
                </fieldset>

                <div className={sectionMuted + " space-y-3"}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-[#1e293b]">Mensagem para ajuste</p>
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
                        placeholder={
                          selected.status === "closed" || selected.status === "rejected"
                            ? "Solicitacao finalizada"
                            : "Descreva o ajuste necessario para o solicitante"
                        }
                        value={commentDraft}
                        onChange={(e) => setCommentDraft(e.target.value)}
                        disabled={selected.status === "closed" || selected.status === "rejected"}
                      />
                      <div className="comments-chat-actions">
                        <button
                          type="button"
                          onClick={requestAdjustment}
                          disabled={
                            requestingAdjustment ||
                            !commentDraft.trim() ||
                            selected.status === "closed" ||
                            selected.status === "rejected"
                          }
                          className="rounded-lg border border-[#e5e7eb] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-[#1e293b] transition hover:-translate-y-0.5 hover:shadow-md disabled:opacity-60"
                        >
                          {requestingAdjustment ? "Enviando..." : "Solicitar ajuste"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e5e7eb] bg-white px-4 py-3">
                  <div className="text-xs text-[#94a3b8]">Acoes</div>
                  <div className="flex flex-wrap gap-3">
                    {(() => {
                      const requiresCompany = requestProfileTypeNeedsCompany(
                        normalizeRequestProfileType((draft.accessType ?? "Usuario Testing Company") as string) ?? "company_user",
                      );
                      const missingRequiredFields =
                        !String(draft.fullName ?? "").trim() ||
                        !String(draft.username ?? "").trim() ||
                        !String(draft.email ?? "").trim() ||
                        !String(draft.phone ?? "").trim() ||
                        !String(draft.jobRole ?? "").trim() ||
                        !String(draft.title ?? "").trim() ||
                        !String(draft.description ?? "").trim() ||
                        !draft.passwordProvided;
                      const acceptDisabled =
                        accepting ||
                        missingRequiredFields ||
                        (requiresCompany && !draft.clientId);
                      try {
                        console.debug(
                          "[E2E][access-requests] acceptDisabled=",
                          acceptDisabled,
                          "accessType=",
                          draft.accessType,
                          "clientId=",
                          draft.clientId,
                          "missingRequiredFields=",
                          missingRequiredFields,
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
                      onClick={requestAdjustment}
                      disabled={
                        requestingAdjustment ||
                        !commentDraft.trim() ||
                        selected.status === "closed" ||
                        selected.status === "rejected"
                      }
                      className="rounded-full border border-amber-400 bg-amber-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-amber-700 transition hover:bg-amber-100 disabled:opacity-60"
                    >
                      {requestingAdjustment ? "Enviando..." : "Solicitar ajuste"}
                    </button>

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

export default function AccessRequestsPageWithGuard() {
  return (
    <RequireGlobalDeveloper>
      <AccessRequestsPage />
    </RequireGlobalDeveloper>
  );
}
