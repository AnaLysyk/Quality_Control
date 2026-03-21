"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./AccessRequests.module.css";
import { FiCheckCircle, FiClock, FiRefreshCw, FiSearch, FiSlash } from "react-icons/fi";
import { RequireGlobalDeveloper } from "@/core/auth/RequireGlobalDeveloper";
import { getAccessToken } from "@/lib/api";
import { extractMessageFromJson, extractRequestIdFromJson, formatMessageWithRequestId, unwrapEnvelopeData } from "@/lib/apiEnvelope";
import type {
  AccessRequestAdjustmentEntry,
  AccessRequestAdjustmentField,
  AccessRequestAdjustmentRound,
  AccessRequestSnapshot,
} from "@/lib/accessRequestMessage";
import { parseAccessRequestMessage } from "@/lib/accessRequestMessage";
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
  companyProfile: AccessRequestSnapshot["companyProfile"];
  title: string;
  description: string;
  notes: string;
  passwordProvided: boolean;
  originalRequest: AccessRequestSnapshot;
  adjustmentRound: number;
  adjustmentRequestedFields: AccessRequestAdjustmentField[];
  adjustmentHistory: AccessRequestAdjustmentRound[];
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

function parseFromMessage(message: string, fallbackEmail: string): Partial<AccessRequestItem> {
  const parsed = parseAccessRequestMessage(message, fallbackEmail);
  return {
    email: parsed.email,
    name: parsed.fullName || parsed.name,
    fullName: parsed.fullName || parsed.name,
    username: parsed.username,
    phone: parsed.phone,
    jobRole: parsed.jobRole,
    company: parsed.company,
    clientId: parsed.clientId,
    accessType: toRequestProfileTypeLabel(parsed.profileType),
    companyProfile: parsed.companyProfile,
    title: parsed.title,
    description: parsed.description,
    notes: parsed.notes,
    passwordProvided: Boolean(parsed.passwordHash?.trim()),
    originalRequest: parsed.originalRequest,
    adjustmentRound: parsed.adjustmentRound,
    adjustmentRequestedFields: parsed.adjustmentRequestedFields,
    adjustmentHistory: parsed.adjustmentHistory,
    lastAdjustmentAt: parsed.lastAdjustmentAt,
    lastAdjustmentDiff: parsed.lastAdjustmentDiff,
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
  if (status === "in_progress") return "Aguardando ajuste";
  return "Aberta";
}

function statusBadgeClass(status: string) {
  if (status === "closed") return "border border-emerald-300 bg-emerald-100 text-emerald-800 shadow-[0_8px_18px_rgba(5,150,105,0.12)]";
  if (status === "rejected") return "border border-rose-300 bg-rose-100 text-rose-800 shadow-[0_8px_18px_rgba(225,29,72,0.12)]";
  if (status === "in_progress") return "border border-amber-300 bg-amber-100 text-amber-800 shadow-[0_8px_18px_rgba(217,119,6,0.12)]";
  return "border border-sky-300 bg-sky-100 text-sky-800 shadow-[0_8px_18px_rgba(14,165,233,0.12)]";
}

function accessTypeBadgeClass(accessType: AccessTypeLabel) {
  if (accessType === "Suporte Tecnico") return "border border-violet-300 bg-violet-100 text-violet-800";
  if (accessType === "Lider TC") return "border border-rose-300 bg-rose-100 text-rose-800";
  if (accessType === "Usuarios da empresa") return "border border-amber-300 bg-amber-100 text-amber-800";
  return "border border-slate-300 bg-slate-100 text-slate-800";
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("pt-BR");
}

function textOrFallback(value: string | null | undefined, fallback = "Nao informado") {
  return value && value.trim() ? value : fallback;
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

type AdjustmentFieldOption = {
  field: AccessRequestAdjustmentField;
  label: string;
  hint: string;
};

const BASE_ADJUSTMENT_FIELD_OPTIONS: AdjustmentFieldOption[] = [
  { field: "profileType", label: "Perfil", hint: "Perfil ou tipo de acesso" },
  { field: "company", label: "Empresa", hint: "Empresa vinculada ou selecionada" },
  { field: "fullName", label: "Nome completo", hint: "Nome principal do solicitante" },
  { field: "username", label: "Usuario sugerido", hint: "Login/usuario sugerido" },
  { field: "email", label: "E-mail", hint: "Endereco de e-mail" },
  { field: "phone", label: "Telefone", hint: "Telefone de contato" },
  { field: "jobRole", label: "Cargo", hint: "Cargo ou funcao" },
  { field: "title", label: "Titulo", hint: "Titulo da solicitacao" },
  { field: "description", label: "Descricao", hint: "Descricao detalhada" },
  { field: "notes", label: "Observacoes", hint: "Observacoes complementares" },
  { field: "password", label: "Senha", hint: "Senha informada na solicitacao" },
];

const COMPANY_ADJUSTMENT_FIELD_OPTIONS: AdjustmentFieldOption[] = [
  { field: "companyName", label: "Razao social", hint: "Nome da empresa" },
  { field: "companyTaxId", label: "CNPJ", hint: "Documento principal da empresa" },
  { field: "companyZip", label: "CEP", hint: "CEP cadastrado" },
  { field: "companyAddress", label: "Endereco", hint: "Endereco principal" },
  { field: "companyPhone", label: "Telefone da empresa", hint: "Telefone institucional" },
  { field: "companyWebsite", label: "Website", hint: "Website oficial" },
  { field: "companyLinkedin", label: "LinkedIn", hint: "LinkedIn institucional" },
  { field: "companyDescription", label: "Descricao da empresa", hint: "Descricao institucional" },
  { field: "companyNotes", label: "Observacoes da empresa", hint: "Observacoes da empresa" },
];

const inputBase =
  "mt-1 w-full rounded-[16px] border border-(--tc-border) bg-(--tc-surface) px-3.5 py-2.5 text-sm font-medium text-(--tc-text-primary) shadow-[0_10px_24px_rgba(15,23,42,0.05)] transition placeholder:text-(--tc-text-muted) focus:border-(--tc-accent) focus:outline-none focus:ring-4 focus:ring-[rgba(239,0,1,0.12)]";

const readOnlyInputBase =
  "mt-1 w-full rounded-[16px] border border-(--tc-border) bg-(--tc-surface-2) px-3.5 py-2.5 text-sm font-medium text-(--tc-text-primary) shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]";

const labelBase = "text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-accent)";

const sectionCard =
  "rounded-3xl border border-(--tc-border) bg-(--tc-surface) p-5 shadow-[0_16px_40px_rgba(15,23,42,0.06)]";
const sectionMuted =
  "rounded-3xl border border-(--tc-border) bg-(--tc-surface-2) p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]";

function AccessRequestsPage() {
  const [items, setItems] = useState<AccessRequestItem[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [existingLogins, setExistingLogins] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<AccessRequestItem> | null>(null);
  const [saving, setSaving] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [requestingAdjustment, setRequestingAdjustment] = useState(false);
  const [comments, setComments] = useState<AccessRequestComment[]>([]);
  const [commentDraft, setCommentDraft] = useState("");
  const [adjustmentFieldsDraft, setAdjustmentFieldsDraft] = useState<AccessRequestAdjustmentField[]>([]);
  const [commentLoading, setCommentLoading] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "in_progress" | "closed" | "rejected">("all");

  // Track whether the user has modified the draft form since the last selection change.
  // Prevents React Strict Mode double-invoke of load() from resetting user edits.
  const draftTouchedRef = useRef(false);

  const selected = useMemo(
    () => (selectedId ? items.find((i) => i.id === selectedId) ?? null : null),
    [items, selectedId],
  );

  const filteredItems = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return items.filter((item) => {
      const matchesStatus = statusFilter === "all" ? true : item.status === statusFilter;
      if (!matchesStatus) return false;
      if (!query) return true;
      const haystack = [
        item.fullName,
        item.name,
        item.email,
        item.company,
        item.accessType,
        item.jobRole,
        item.title,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [items, searchTerm, statusFilter]);

  const statusCounters = useMemo(
    () => ({
      total: items.length,
      open: items.filter((item) => item.status === "open").length,
      inReview: items.filter((item) => item.status === "open" || item.status === "in_progress").length,
      inProgress: items.filter((item) => item.status === "in_progress").length,
      approved: items.filter((item) => item.status === "closed").length,
      rejected: items.filter((item) => item.status === "rejected").length,
    }),
    [items],
  );

  const selectedAdjustmentDiff = selected?.lastAdjustmentDiff ?? [];
  const selectedHasRequesterAdjustment = Boolean(selected?.lastAdjustmentAt && selectedAdjustmentDiff.length > 0);
  const selectedOriginal = selected?.originalRequest ?? null;
  const latestAdjustmentRound = selected?.adjustmentHistory?.[selected.adjustmentHistory.length - 1] ?? null;
  const adjustmentFieldOptions = useMemo(() => {
    if (!selectedOriginal?.companyProfile && !selected?.companyProfile) {
      return BASE_ADJUSTMENT_FIELD_OPTIONS;
    }
    return [...BASE_ADJUSTMENT_FIELD_OPTIONS, ...COMPANY_ADJUSTMENT_FIELD_OPTIONS];
  }, [selected?.companyProfile, selectedOriginal?.companyProfile]);
  const dirty = useMemo(() => {
    if (!selected || !draft) return false;

    const baselineUsername =
      selected.username ??
      buildUniqueUsername(selected.fullName || selected.name || selected.email, existingLogins, selected.username);

    return (
      (draft.accessType ?? "") !== (selected.accessType ?? "") ||
      (draft.username ?? "") !== baselineUsername ||
      (draft.clientId ?? "") !== (selected.clientId ?? "") ||
      (draft.company ?? "") !== (selected.company ?? "") ||
      (draft.fullName ?? "") !== (selected.fullName ?? "") ||
      (draft.email ?? "") !== (selected.email ?? "") ||
      (draft.phone ?? "") !== (selected.phone ?? "") ||
      (draft.jobRole ?? "") !== (selected.jobRole ?? "") ||
      (draft.title ?? "") !== (selected.title ?? "") ||
      (draft.description ?? "") !== (selected.description ?? "") ||
      (draft.adminNotes ?? "") !== (selected.adminNotes ?? "")
    );
  }, [draft, existingLogins, selected]);
  const draftProfileType =
    normalizeRequestProfileType((draft?.accessType ?? "Usuario Testing Company") as string) ?? "company_user";
  const requiresCompany = requestProfileTypeNeedsCompany(draftProfileType);
  const commentsLocked = selected?.status === "closed" || selected?.status === "rejected";
  const missingRequiredFields =
    !String(draft?.fullName ?? "").trim() ||
    !String(draft?.username ?? "").trim() ||
    !String(draft?.email ?? "").trim() ||
    !String(draft?.phone ?? "").trim() ||
    !String(draft?.jobRole ?? "").trim() ||
    !String(draft?.title ?? "").trim() ||
    !String(draft?.description ?? "").trim() ||
    !draft?.passwordProvided;
  const acceptDisabled = !selected || !draft || accepting || missingRequiredFields || (requiresCompany && !draft.clientId);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

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
          companyProfile: parsedMsg.companyProfile ?? null,
          title: String(parsedMsg.title ?? ""),
          description: String(parsedMsg.description ?? ""),
          notes: String(parsedMsg.notes ?? ""),
          passwordProvided: parsedMsg.passwordProvided === true,
          originalRequest:
            parsedMsg.originalRequest ??
            ({
              email: String(parsedMsg.email ?? r.email ?? ""),
              name: String(parsedMsg.fullName ?? parsedMsg.name ?? ""),
              fullName: String(parsedMsg.fullName ?? parsedMsg.name ?? ""),
              username: typeof parsedMsg.username === "string" ? parsedMsg.username : null,
              phone: String(parsedMsg.phone ?? ""),
              passwordHash: null,
              jobRole: String(parsedMsg.jobRole ?? ""),
              company: String(parsedMsg.company ?? ""),
              clientId: parsedMsg.clientId ?? null,
              accessType: toInternalAccessType(normalizeRequestProfileType((parsedMsg.accessType as string) ?? "") ?? "testing_company_user"),
              profileType: normalizeRequestProfileType((parsedMsg.accessType as string) ?? "") ?? "testing_company_user",
              title: String(parsedMsg.title ?? ""),
              description: String(parsedMsg.description ?? ""),
              notes: String(parsedMsg.notes ?? ""),
              companyProfile: parsedMsg.companyProfile ?? null,
            } satisfies AccessRequestSnapshot),
          adjustmentRound: parsedMsg.adjustmentRound ?? 0,
          adjustmentRequestedFields: parsedMsg.adjustmentRequestedFields ?? [],
          adjustmentHistory: parsedMsg.adjustmentHistory ?? [],
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

  useEffect(() => {
    setAdjustmentFieldsDraft(selected?.adjustmentRequestedFields ?? []);
  }, [selected]);

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setSuccessMessage("Conteudo copiado.");
    } catch {
      // ignore
    }
  }

  async function saveChanges() {
    if (!selected || !draft) return;

    setSaving(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const res = await fetchWithToken(`/api/admin/access-requests/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: draft.email,
          name: draft.fullName || draft.name,
          full_name: draft.fullName,
          user: draft.username,
          phone: draft.phone,
          role: draft.jobRole,
          company: draft.company,
          client_id: draft.clientId,
          access_type: draft.accessType,
          notes: draft.notes,
          admin_notes: draft.adminNotes ?? "",
          title: draft.title,
          description: draft.description,
        }),
      });

      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        setError((json.error as string) || (json.message as string) || "Falha ao salvar analise");
        return;
      }

      draftTouchedRef.current = false;
      setSuccessMessage("Analise salva com sucesso.");
      await load();
      await loadComments(selected.id);
    } finally {
      setSaving(false);
    }
  }

  async function requestAdjustment() {
    if (!selected) return;
    const body = commentDraft.trim();
    if (!body) return;
    if (adjustmentFieldsDraft.length === 0) {
      setCommentError("Selecione pelo menos um campo para devolucao de ajuste.");
      return;
    }

    setRequestingAdjustment(true);
    setCommentError(null);
    setError(null);
    setSuccessMessage(null);
    try {
      const res = await fetchWithToken(`/api/admin/access-requests/${selected.id}/request-adjustment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment: body, fields: adjustmentFieldsDraft }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setCommentError(json?.error || "Falha ao solicitar ajuste");
        return;
      }
      setCommentDraft("");
      setAdjustmentFieldsDraft([]);
      draftTouchedRef.current = false;
      setSuccessMessage("Solicitacao enviada para ajuste.");
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
    setSuccessMessage(null);
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
      setSuccessMessage("Solicitacao aprovada.");
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
    setSuccessMessage(null);
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
      setSuccessMessage("Solicitacao recusada.");
      await load();
      await loadComments(selected.id);
    } finally {
      setAccepting(false);
    }
  }

  return (
    <div className="min-h-screen bg-transparent text-(--tc-text-primary)">
      <div className="mx-auto flex w-full max-w-480 flex-col gap-5 px-2.5 py-5 sm:px-3 sm:py-6 lg:px-4 xl:px-5 2xl:px-6">
        <section
          className={`relative overflow-hidden rounded-[28px] border border-(--tc-border) p-4 text-white shadow-[0_28px_72px_rgba(15,23,42,0.16)] sm:rounded-[30px] sm:p-5 xl:rounded-4xl xl:p-6 ${styles.headerCard}`}
        >
          <div className={`pointer-events-none absolute -right-10 top-0 h-28 w-28 rounded-full blur-3xl ${styles.blurDecorWhite}`} />
          <div className={`pointer-events-none absolute bottom-0 left-1/3 h-24 w-24 rounded-full blur-3xl ${styles.blurDecorRed}`} />
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-white/72">Admin</p>
              <h1 className="mt-2 text-3xl font-semibold text-white sm:text-4xl">Solicitacoes de acesso</h1>
              <p className="mt-2 max-w-2xl text-sm text-white/84">
                Central de triagem para revisar o que foi enviado pelo solicitante, decidir perfil, empresa e concluir a aprovacao.
              </p>
            </div>

            <button
              onClick={load}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.28em] text-white shadow-[0_10px_24px_rgba(15,23,42,0.12)] transition hover:-translate-y-0.5 hover:bg-white/16 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={loading}
            >
              <FiRefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              {loading ? "Atualizando" : "Atualizar"}
            </button>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
            <div className="rounded-[22px] border border-white/12 bg-white/10 p-4 backdrop-blur-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/72">Abertas</span>
                <FiClock className="h-4 w-4 text-white/72" />
              </div>
              <div className="mt-3 text-3xl font-semibold text-white">{statusCounters.open}</div>
              <p className="mt-1 text-sm text-white/76">Aguardando primeira leitura.</p>
            </div>

            <div className="rounded-[22px] border border-white/12 bg-white/10 p-4 backdrop-blur-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/72">Em analise</span>
                <FiRefreshCw className="h-4 w-4 text-white/72" />
              </div>
              <div className="mt-3 text-3xl font-semibold text-white">{statusCounters.inReview}</div>
              <p className="mt-1 text-sm text-white/76">Fila ativa de triagem.</p>
            </div>

            <div className="rounded-[22px] border border-white/12 bg-white/10 p-4 backdrop-blur-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/72">Ajuste</span>
                <FiRefreshCw className="h-4 w-4 text-white/72" />
              </div>
              <div className="mt-3 text-3xl font-semibold text-white">{statusCounters.inProgress}</div>
              <p className="mt-1 text-sm text-white/76">Aguardando retorno do solicitante.</p>
            </div>

            <div className="rounded-[22px] border border-white/12 bg-white/10 p-4 backdrop-blur-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/72">Aprovadas</span>
                <FiCheckCircle className="h-4 w-4 text-white/72" />
              </div>
              <div className="mt-3 text-3xl font-semibold text-white">{statusCounters.approved}</div>
              <p className="mt-1 text-sm text-white/76">Acessos validados e convertidos.</p>
            </div>

            <div className="rounded-[22px] border border-white/12 bg-white/10 p-4 backdrop-blur-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/72">Recusadas</span>
                <FiSlash className="h-4 w-4 text-white/72" />
              </div>
              <div className="mt-3 text-3xl font-semibold text-white">{statusCounters.rejected}</div>
              <p className="mt-1 text-sm text-white/76">Encerradas sem liberacao.</p>
            </div>
          </div>
        </section>

        {error ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-medium text-rose-800 shadow-[0_14px_28px_rgba(225,29,72,0.08)]">
            {error}
          </div>
        ) : null}

        {successMessage ? (
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-800 shadow-[0_14px_28px_rgba(5,150,105,0.08)]">
            {successMessage}
          </div>
        ) : null}

        <div className="grid items-stretch grid-cols-1 gap-5 xl:grid-cols-[minmax(320px,380px)_minmax(0,1fr)] 2xl:grid-cols-[minmax(360px,430px)_minmax(0,1fr)]">
          <aside className="flex min-h-170 flex-col overflow-hidden rounded-[28px] border border-(--tc-border) bg-(--tc-surface) shadow-[0_20px_48px_rgba(15,23,42,0.08)] xl:h-[calc(100vh-6.5rem)] xl:min-h-0 2xl:sticky 2xl:top-4">
            <div className={`border-b border-(--tc-border) p-5 ${styles.asideHeader}`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-[20px] font-semibold tracking-tight text-(--tc-text-primary)">{filteredItems.length} em revisao</h2>
                </div>
                <div className="rounded-full border border-(--tc-border) bg-(--tc-surface-2) px-3 py-1.5 text-xs font-semibold text-(--tc-text-muted)">
                  {statusCounters.total} total
                </div>
              </div>

            <div className="relative mt-5">
              <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--tc-accent)" />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar nome, email ou empresa"
                className="w-full rounded-[20px] border border-(--tc-border) bg-(--tc-surface-2) py-3 pl-10 pr-4 text-sm font-medium text-(--tc-text-primary) shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] outline-none transition placeholder:text-(--tc-text-muted) focus:border-(--tc-accent) focus:ring-4 focus:ring-[rgba(239,0,1,0.12)]"
              />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {[
                { value: "all", label: "Todas" },
                { value: "open", label: "Abertas" },
                { value: "in_progress", label: "Ajuste" },
                { value: "closed", label: "Aprovadas" },
                { value: "rejected", label: "Recusadas" },
              ].map((filter) => {
                const active = statusFilter === filter.value;
                return (
                  <button
                    key={filter.value}
                    type="button"
                    onClick={() => setStatusFilter(filter.value as typeof statusFilter)}
                    className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.24em] transition ${
                      active
                        ? "border-[rgba(239,0,1,0.18)] bg-[rgba(239,0,1,0.1)] text-(--tc-accent) shadow-[0_10px_24px_rgba(214,34,70,0.12)]"
                        : "border-(--tc-border) bg-(--tc-surface) text-(--tc-text-muted) hover:border-[rgba(1,24,72,0.2)] hover:text-(--tc-text-primary)"
                    }`}
                  >
                    {filter.label}
                  </button>
                );
              })}
            </div>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 pr-3 [scrollbar-width:none] sm:p-5 sm:pr-4 [&::-webkit-scrollbar]:hidden">
              {loading ? (
                <div className={`${sectionMuted} text-sm text-(--tc-text-muted)`}>Carregando solicitacoes...</div>
              ) : filteredItems.length === 0 ? (
                <div className={`${sectionMuted} text-sm text-(--tc-text-muted)`}>
                  Nenhuma solicitacao encontrada para o filtro atual.
                </div>
              ) : (
                filteredItems.map((it) => {
                  const selectedRow = selectedId === it.id;
                  return (
                    <div
                      key={it.id}
                      className={`rounded-[26px] border p-4 sm:p-5 transition focus-within:ring-2 focus-within:ring-[rgba(239,0,1,0.22)] ${
                        selectedRow
                          ? `border-transparent text-white shadow-[0_20px_44px_rgba(1,24,72,0.18)] ${styles.rowSelected}`
                          : "border-(--tc-border) bg-(--tc-surface) shadow-[0_14px_34px_rgba(15,23,42,0.06)] hover:-translate-y-0.5 hover:border-[rgba(1,24,72,0.14)] hover:shadow-[0_18px_40px_rgba(15,23,42,0.1)]"
                      }`}
                    >
                      <button type="button" onClick={() => setSelectedId(it.id)} className="w-full text-left">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className={`truncate text-base font-semibold ${selectedRow ? "text-white" : "text-(--tc-text-primary)"}`}>
                              {it.fullName || it.name || "(sem nome)"}
                            </p>
                            <p className={`mt-1 truncate text-sm font-medium ${selectedRow ? "text-white/78" : "text-(--tc-text-secondary)"}`}>{it.email}</p>
                          </div>
                        </div>

                        <div className={`mt-4 grid gap-3 text-sm ${selectedRow ? "text-white/88" : "text-(--tc-text-secondary)"}`}>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold ${statusBadgeClass(it.status)}`}>
                              {statusLabel(it.status)}
                            </span>
                            <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold ${accessTypeBadgeClass(it.accessType)}`}>
                              {it.accessType}
                            </span>
                          </div>
                          <div className="grid gap-2 sm:grid-cols-2">
                            <div>
                              <p className={`wrap-break-word pr-1 font-medium leading-5 ${selectedRow ? "text-white" : "text-(--tc-text-primary)"}`}>{it.company || "Sem empresa"}</p>
                            </div>
                            <div>
                              <p className={`wrap-break-word pr-1 font-medium leading-5 ${selectedRow ? "text-white/74" : "text-(--tc-text-secondary)"}`}>{it.jobRole || "Cargo nao informado"}</p>
                            </div>
                          </div>
                        </div>
                      </button>

                      <div className={`mt-4 flex items-center justify-between gap-3 border-t pt-3 ${selectedRow ? "border-white/12" : "border-(--tc-border)"}`}>
                        <span className={`text-xs font-medium ${selectedRow ? "text-white/72" : "text-(--tc-text-muted)"}`}>{formatDateTime(it.createdAt)}</span>
                        <button
                          type="button"
                          className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] transition ${
                            selectedRow
                              ? "border-white/15 bg-white/10 text-white hover:bg-white/16"
                              : "border-(--tc-border) bg-(--tc-surface) text-(--tc-primary) hover:border-(--tc-accent) hover:text-(--tc-accent)"
                          }`}
                          onClick={() => copy(it.email)}
                        >
                          Copiar
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </aside>

          <section className="flex min-h-170 flex-col overflow-hidden rounded-[28px] border border-(--tc-border) bg-(--tc-surface) shadow-[0_20px_48px_rgba(15,23,42,0.08)] xl:h-[calc(100vh-6.5rem)] xl:min-h-0">
            {!selected || !draft ? (
              <div className={`${sectionMuted} flex min-h-105 flex-1 items-center justify-center p-6 sm:p-8`}>
                <div className="mx-auto flex w-full max-w-3xl flex-col items-center text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-[linear-gradient(135deg,var(--tc-primary)_0%,rgba(239,0,1,0.82)_180%)] text-white shadow-[0_18px_38px_rgba(1,24,72,0.16)]">
                    <FiClock size={24} />
                  </div>
                  <div className="mt-5 space-y-2">
                    <h3 className="text-[1.6rem] font-black tracking-[-0.04em] text-(--tc-text-primary)">
                      Selecione uma solicitacao
                    </h3>
                    <p className="max-w-2xl text-sm leading-7 text-(--tc-text-muted)">
                      Escolha um item na coluna da esquerda para abrir a triagem, comparar os dados enviados,
                      revisar ajustes e decidir a aprovacao com contexto completo.
                    </p>
                  </div>

                  <div className="mt-6 grid w-full gap-3 sm:grid-cols-3">
                    <div className="rounded-[20px] border border-(--tc-border) bg-(--tc-surface) px-4 py-4 text-left shadow-[0_12px_24px_rgba(15,23,42,0.05)]">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-(--tc-text-muted)">Abertas</div>
                      <div className="mt-2 text-3xl font-black text-(--tc-text-primary)">{statusCounters.open}</div>
                      <div className="mt-2 text-sm text-(--tc-text-muted)">Solicitacoes aguardando primeira leitura.</div>
                    </div>
                    <div className="rounded-[20px] border border-(--tc-border) bg-(--tc-surface) px-4 py-4 text-left shadow-[0_12px_24px_rgba(15,23,42,0.05)]">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-(--tc-text-muted)">Em analise</div>
                      <div className="mt-2 text-3xl font-black text-(--tc-text-primary)">{statusCounters.inReview}</div>
                      <div className="mt-2 text-sm text-(--tc-text-muted)">Fila administrativa ativa para validacao.</div>
                    </div>
                    <div className="rounded-[20px] border border-(--tc-border) bg-(--tc-surface) px-4 py-4 text-left shadow-[0_12px_24px_rgba(15,23,42,0.05)]">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-(--tc-text-muted)">Ajustes</div>
                      <div className="mt-2 text-3xl font-black text-(--tc-text-primary)">{statusCounters.inProgress}</div>
                      <div className="mt-2 text-sm text-(--tc-text-muted)">Retornos esperando correcao do solicitante.</div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-3 [scrollbar-width:none] sm:p-4 xl:p-5 2xl:p-6 [&::-webkit-scrollbar]:hidden">
                <div
                  className={`relative overflow-hidden rounded-[26px] border border-(--tc-border) p-4 text-white shadow-[0_24px_56px_rgba(1,24,72,0.18)] sm:rounded-[28px] sm:p-5 ${styles.detailCard}`}
                >
                  <div className={`pointer-events-none absolute -right-10 top-0 h-28 w-28 rounded-full blur-3xl ${styles.blurDecorWhite}`} />
                  <div className={`pointer-events-none absolute bottom-0 left-1/3 h-24 w-24 rounded-full blur-3xl ${styles.blurDecorRed}`} />

                  <div className="relative grid gap-4 2xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.95fr)] 2xl:items-start">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold ${statusBadgeClass(selected.status)}`}>
                          {statusLabel(selected.status)}
                        </span>
                        <span className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold ${accessTypeBadgeClass(selected.accessType)}`}>
                          {selected.accessType}
                        </span>
                      </div>
                      <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.32em] text-white/74">Solicitacao selecionada</p>
                      <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white">
                        {selected.fullName || selected.name || "(sem nome)"}
                      </h2>
                      <p className="mt-2 text-base font-medium text-white/82">{selected.email}</p>
                      <p className="mt-3 max-w-2xl text-sm leading-6 text-white/80">
                        Revise o que o solicitante enviou, confirme o perfil final e conclua a aprovacao sem perder o historico da conversa.
                      </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-[22px] border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/74">Empresa pedida</p>
                        <p className="mt-2 text-base font-semibold text-white">{selected.company || "Sem empresa definida"}</p>
                      </div>
                      <div className="rounded-[22px] border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/74">Recebida em</p>
                        <p className="mt-2 text-base font-semibold text-white">{formatDateTime(selected.createdAt)}</p>
                      </div>
                      <div className="rounded-[22px] border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/74">Usuario sugerido</p>
                        <p className="mt-2 text-base font-semibold text-white">{draft.username || "A definir"}</p>
                      </div>
                      <div className="rounded-[22px] border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/74">Ultima interacao</p>
                        <p className="mt-2 text-base font-semibold text-white">{comments.length > 0 ? formatDateTime(comments[comments.length - 1]!.createdAt) : "Sem historico"}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {selectedHasRequesterAdjustment ? (
                  <div className="rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4 shadow-[0_14px_34px_rgba(217,119,6,0.08)]">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-amber-900">Solicitação reenviada com ajustes</p>
                        <p className="mt-1 text-sm text-amber-800">
                          Ultimo reenvio em{" "}
                          <span suppressHydrationWarning={true}>
                            {selected?.lastAdjustmentAt ? formatDateTime(selected.lastAdjustmentAt) : "-"}
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

                <div className="grid items-stretch gap-5 2xl:grid-cols-[minmax(0,1fr)_minmax(430px,0.92fr)]">
                  <section className={`${sectionMuted} flex h-full flex-col`}>
                    <div className="space-y-2">
                      <p className={labelBase}>Dados enviados pelo solicitante</p>
                      <h3 className="text-lg font-semibold text-(--tc-text-primary)">Base original da solicitacao</h3>
                      <p className="text-sm text-(--tc-text-secondary)">
                        Estes campos sao somente leitura e mostram exatamente o que foi enviado antes da decisao administrativa.
                      </p>
                    </div>

                    <div className="mt-5 flex-1 space-y-4">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <label className="block">
                        <span className={labelBase}>Perfil solicitado</span>
                        <input
                          className={readOnlyInputBase}
                          value={selectedOriginal ? toRequestProfileTypeLabel(selectedOriginal.profileType) : selected.accessType ?? ""}
                          readOnly
                        />
                      </label>

                      <label className="block">
                        <span className={labelBase}>Empresa solicitada</span>
                        <input className={readOnlyInputBase} value={textOrFallback(selectedOriginal?.company, "Sem empresa definida")} readOnly />
                      </label>

                      <label className="block">
                        <span className={labelBase}>Nome completo</span>
                        <input className={readOnlyInputBase} value={textOrFallback(selectedOriginal?.fullName || selectedOriginal?.name)} readOnly />
                      </label>

                      <label className="block">
                        <span className={labelBase}>E-mail</span>
                        <input className={readOnlyInputBase} value={textOrFallback(selectedOriginal?.email)} readOnly />
                      </label>

                      <label className="block">
                        <span className={labelBase}>Telefone</span>
                        <input className={readOnlyInputBase} value={textOrFallback(selectedOriginal?.phone)} readOnly />
                      </label>

                      <label className="block">
                        <span className={labelBase}>Cargo</span>
                        <input className={readOnlyInputBase} value={textOrFallback(selectedOriginal?.jobRole)} readOnly />
                      </label>

                      <label className="block md:col-span-2">
                        <span className={labelBase}>Titulo da solicitacao</span>
                        <input className={readOnlyInputBase} value={textOrFallback(selectedOriginal?.title, "Sem titulo")} readOnly />
                      </label>

                      <label className="block md:col-span-2">
                        <span className={labelBase}>Descricao detalhada</span>
                        <textarea className={readOnlyInputBase} rows={5} value={textOrFallback(selectedOriginal?.description)} readOnly />
                      </label>

                      <label className="block md:col-span-2">
                        <span className={labelBase}>Observacoes do solicitante</span>
                        <textarea className={readOnlyInputBase} rows={4} value={textOrFallback(selectedOriginal?.notes)} readOnly />
                      </label>
                    </div>

                    {selectedOriginal?.companyProfile ? (
                      <div className="rounded-[20px] border border-(--tc-border) bg-white px-4 py-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className={labelBase}>Cadastro institucional original</p>
                            <p className="mt-2 text-sm text-(--tc-text-secondary)">
                              Dados corporativos enviados junto da solicitacao.
                            </p>
                          </div>
                          <span className="rounded-full border border-(--tc-border) bg-(--tc-surface-2) px-3 py-1 text-xs font-semibold text-(--tc-text-secondary)">
                            Original
                          </span>
                        </div>
                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                          <label className="block">
                            <span className={labelBase}>Razao social</span>
                            <input className={readOnlyInputBase} value={textOrFallback(selectedOriginal.companyProfile.companyName)} readOnly />
                          </label>
                          <label className="block">
                            <span className={labelBase}>CNPJ</span>
                            <input className={readOnlyInputBase} value={textOrFallback(selectedOriginal.companyProfile.companyTaxId)} readOnly />
                          </label>
                          <label className="block">
                            <span className={labelBase}>CEP</span>
                            <input className={readOnlyInputBase} value={textOrFallback(selectedOriginal.companyProfile.companyZip)} readOnly />
                          </label>
                          <label className="block">
                            <span className={labelBase}>Telefone da empresa</span>
                            <input className={readOnlyInputBase} value={textOrFallback(selectedOriginal.companyProfile.companyPhone)} readOnly />
                          </label>
                          <label className="block md:col-span-2">
                            <span className={labelBase}>Endereco</span>
                            <input className={readOnlyInputBase} value={textOrFallback(selectedOriginal.companyProfile.companyAddress)} readOnly />
                          </label>
                          <label className="block">
                            <span className={labelBase}>Website</span>
                            <input className={readOnlyInputBase} value={textOrFallback(selectedOriginal.companyProfile.companyWebsite)} readOnly />
                          </label>
                          <label className="block">
                            <span className={labelBase}>LinkedIn</span>
                            <input className={readOnlyInputBase} value={textOrFallback(selectedOriginal.companyProfile.companyLinkedin)} readOnly />
                          </label>
                          <label className="block md:col-span-2">
                            <span className={labelBase}>Descricao da empresa</span>
                            <textarea className={readOnlyInputBase} rows={3} value={textOrFallback(selectedOriginal.companyProfile.companyDescription)} readOnly />
                          </label>
                          <label className="block md:col-span-2">
                            <span className={labelBase}>Observacoes da empresa</span>
                            <textarea className={readOnlyInputBase} rows={3} value={textOrFallback(selectedOriginal.companyProfile.companyNotes)} readOnly />
                          </label>
                        </div>
                      </div>
                    ) : null}

                    <div className="mt-4 rounded-[20px] border border-(--tc-border) bg-(--tc-surface) px-4 py-3 text-sm shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <span className="font-semibold text-(--tc-text-primary)">Senha informada na solicitacao</span>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${draft.passwordProvided ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                          {draft.passwordProvided ? "Preenchida" : "Ausente"}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-(--tc-text-secondary)">
                        A aprovacao so pode seguir quando a solicitacao ja tiver uma senha definida pelo solicitante.
                      </p>
                    </div>
                    </div>
                  </section>

                  <section className={`${sectionCard} flex h-full flex-col`}>
                    <div className="space-y-2">
                      <p className={labelBase}>Base administrativa e devolvida</p>
                      <h3 className="text-lg font-semibold text-(--tc-text-primary)">Versao atual da triagem</h3>
                      <p className="text-sm text-(--tc-text-secondary)">
                        Edite o que precisa ser aprovado e acompanhe a versao que voltou do solicitante para nova analise.
                      </p>
                    </div>

                    {latestAdjustmentRound ? (
                      <div className="mt-5 rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-4 shadow-[0_10px_24px_rgba(217,119,6,0.08)]">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-700">Rodada de ajuste {latestAdjustmentRound.round}</p>
                            <p className="mt-2 text-sm font-semibold text-amber-900">
                              {latestAdjustmentRound.requestMessage?.trim() || "Aguardando retorno do solicitante."}
                            </p>
                          </div>
                          <span className="rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-semibold text-amber-700">
                            {latestAdjustmentRound.requesterReturnedAt ? "Respondida" : "Pendente"}
                          </span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {latestAdjustmentRound.requestedFields.map((field) => (
                            <span
                              key={`latest-round-${field}`}
                              className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${adjustmentFieldBadgeClass(field)}`}
                            >
                              {adjustmentFieldLabel(field, field)}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <fieldset className="mt-5 flex-1 grid grid-cols-1 gap-4 md:grid-cols-2">
                      <label className="block">
                        <span className={labelBase}>Tipo de perfil</span>
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
                          <option value="Usuarios da empresa">Usuarios da empresa</option>
                          <option value="Lider TC">Lider TC</option>
                          <option value="Suporte Tecnico">Suporte Tecnico</option>
                        </select>
                      </label>

                      <label className="block">
                        <span className={labelBase}>Usuario gerado</span>
                        <input
                          className={inputBase}
                          value={draft.username ?? ""}
                          onChange={(e) => {
                            draftTouchedRef.current = true;
                            setDraft((d) => (d ? { ...d, username: e.target.value.trim().toLowerCase() } : d));
                          }}
                        />
                      </label>

                      <label className="block">
                        <span className={labelBase}>Nome completo</span>
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

                      <label className="block">
                        <span className={labelBase}>E-mail</span>
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

                      <label className="block">
                        <span className={labelBase}>Telefone</span>
                        <input
                          className={inputBase}
                          value={draft.phone ?? ""}
                          onChange={(e) => {
                            draftTouchedRef.current = true;
                            setDraft((d) => (d ? { ...d, phone: e.target.value } : d));
                          }}
                        />
                      </label>

                      {requestProfileTypeNeedsCompany(
                        normalizeRequestProfileType((draft.accessType ?? "Usuario Testing Company") as string) ?? "company_user",
                      ) ? (
                        <label className="block">
                          <span className={labelBase}>Empresa final</span>
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

                      <label className="block md:col-span-2">
                        <span className={labelBase}>Cargo</span>
                        <input
                          className={inputBase}
                          value={draft.jobRole ?? ""}
                          onChange={(e) => {
                            draftTouchedRef.current = true;
                            setDraft((d) => (d ? { ...d, jobRole: e.target.value } : d));
                          }}
                        />
                      </label>

                      <label className="block md:col-span-2">
                        <span className={labelBase}>Titulo da solicitacao</span>
                        <input
                          className={inputBase}
                          value={draft.title ?? ""}
                          onChange={(e) => {
                            draftTouchedRef.current = true;
                            setDraft((d) => (d ? { ...d, title: e.target.value } : d));
                          }}
                        />
                      </label>

                      <label className="block md:col-span-2">
                        <span className={labelBase}>Descricao final</span>
                        <textarea
                          className={inputBase}
                          rows={5}
                          value={draft.description ?? ""}
                          onChange={(e) => {
                            draftTouchedRef.current = true;
                            setDraft((d) => (d ? { ...d, description: e.target.value } : d));
                          }}
                        />
                      </label>

                      <label className="block md:col-span-2">
                        <span className={labelBase}>Observacao interna</span>
                        <textarea
                          className={inputBase}
                          rows={4}
                          value={draft.adminNotes ?? ""}
                          onChange={(e) => {
                            draftTouchedRef.current = true;
                            setDraft((d) => (d ? { ...d, adminNotes: e.target.value } : d));
                          }}
                        />
                      </label>
                    </fieldset>

                    {selected.companyProfile ? (
                      <div className="mt-4 rounded-[20px] border border-(--tc-border) bg-(--tc-surface-2) px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className={labelBase}>Base devolvida / ajustada</p>
                            <p className="mt-2 text-sm text-(--tc-text-secondary)">
                              Versao atual dos dados institucionais que seguem junto da solicitacao.
                            </p>
                          </div>
                          <span className="rounded-full border border-(--tc-border) bg-white px-3 py-1 text-xs font-semibold text-(--tc-text-secondary)">
                            Atual
                          </span>
                        </div>
                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                          <label className="block">
                            <span className={labelBase}>Razao social</span>
                            <input className={readOnlyInputBase} value={textOrFallback(selected.companyProfile.companyName)} readOnly />
                          </label>
                          <label className="block">
                            <span className={labelBase}>CNPJ</span>
                            <input className={readOnlyInputBase} value={textOrFallback(selected.companyProfile.companyTaxId)} readOnly />
                          </label>
                          <label className="block">
                            <span className={labelBase}>CEP</span>
                            <input className={readOnlyInputBase} value={textOrFallback(selected.companyProfile.companyZip)} readOnly />
                          </label>
                          <label className="block">
                            <span className={labelBase}>Telefone da empresa</span>
                            <input className={readOnlyInputBase} value={textOrFallback(selected.companyProfile.companyPhone)} readOnly />
                          </label>
                          <label className="block md:col-span-2">
                            <span className={labelBase}>Endereco</span>
                            <input className={readOnlyInputBase} value={textOrFallback(selected.companyProfile.companyAddress)} readOnly />
                          </label>
                          <label className="block">
                            <span className={labelBase}>Website</span>
                            <input className={readOnlyInputBase} value={textOrFallback(selected.companyProfile.companyWebsite)} readOnly />
                          </label>
                          <label className="block">
                            <span className={labelBase}>LinkedIn</span>
                            <input className={readOnlyInputBase} value={textOrFallback(selected.companyProfile.companyLinkedin)} readOnly />
                          </label>
                          <label className="block md:col-span-2">
                            <span className={labelBase}>Descricao da empresa</span>
                            <textarea className={readOnlyInputBase} rows={3} value={textOrFallback(selected.companyProfile.companyDescription)} readOnly />
                          </label>
                          <label className="block md:col-span-2">
                            <span className={labelBase}>Observacoes da empresa</span>
                            <textarea className={readOnlyInputBase} rows={3} value={textOrFallback(selected.companyProfile.companyNotes)} readOnly />
                          </label>
                        </div>
                      </div>
                    ) : null}
                  </section>
                </div>

                <section className={sectionMuted}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.34em] text-(--tc-accent)">Historico e observacoes</p>
                      <h3 className="mt-2 text-lg font-semibold text-(--tc-text-primary)">Conversa com o solicitante</h3>
                      <p className="mt-1 text-sm text-(--tc-text-secondary)">
                        Use esse bloco para pedir complemento ou registrar a decisao tomada.
                      </p>
                    </div>
                    {commentLoading ? <span className="text-sm font-medium text-(--tc-text-muted)">Carregando...</span> : null}
                  </div>

                  {commentError ? (
                    <div className="mt-4 rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
                      {commentError}
                    </div>
                  ) : null}

                  {selected.adjustmentHistory.length > 0 ? (
                    <div className="mt-5 rounded-[20px] border border-(--tc-border) bg-white px-4 py-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className={labelBase}>Rodadas de ajuste</p>
                          <p className="mt-2 text-sm text-(--tc-text-secondary)">
                            Historico de devolucoes, retorno do solicitante e campos marcados por rodada.
                          </p>
                        </div>
                        <span className="rounded-full border border-(--tc-border) bg-(--tc-surface-2) px-3 py-1 text-xs font-semibold text-(--tc-text-secondary)">
                          {selected.adjustmentHistory.length} rodada(s)
                        </span>
                      </div>

                      <div className="mt-4 grid gap-3 lg:grid-cols-2">
                        {[...selected.adjustmentHistory].reverse().map((round) => (
                          <div key={`round-${round.round}`} className="rounded-[18px] border border-(--tc-border) bg-(--tc-surface-2) px-4 py-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="text-sm font-semibold text-(--tc-text-primary)">{round.round}º ajuste</span>
                              <span className="text-xs font-medium text-(--tc-text-muted)">
                                {formatDateTime(round.requestedAt)}
                              </span>
                            </div>
                            <p className="mt-2 text-sm text-(--tc-text-secondary)">
                              {round.requestMessage?.trim() || "Sem mensagem registrada nesta rodada."}
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {round.requestedFields.map((field) => (
                                <span
                                  key={`round-field-${round.round}-${field}`}
                                  className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${adjustmentFieldBadgeClass(field)}`}
                                >
                                  {adjustmentFieldLabel(field, field)}
                                </span>
                              ))}
                            </div>
                            <p className="mt-3 text-xs font-medium text-(--tc-text-muted)">
                              {round.requesterReturnedAt
                                ? `Respondida em ${formatDateTime(round.requesterReturnedAt)}`
                                : "Ainda aguardando retorno do solicitante."}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-5 comments-chat">
                    <div className="comments-chat-list" aria-live="polite">
                      {comments.length === 0 ? (
                        <p className="comments-chat-empty">Nenhuma interacao registrada ainda.</p>
                      ) : (
                        comments.map((comment) => {
                          const mine = comment.authorRole === "admin";
                          return (
                            <div key={comment.id} className={`comments-chat-message ${mine ? "mine" : "other"}`}>
                              <div className="comments-chat-author">
                                {comment.authorRole === "admin" ? "Admin" : "Solicitante"}: {comment.authorName}
                              </div>
                              <div className="comments-chat-bubble whitespace-pre-wrap">{comment.body}</div>
                              <div className="comments-chat-meta">{formatDateTime(comment.createdAt)}</div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    <div className="comments-chat-input">
                      <textarea
                        className={`${inputBase} mt-0 min-h-30 resize-none`}
                        rows={4}
                        placeholder={commentsLocked ? "Solicitacao finalizada" : "Descreva o ajuste, a observacao interna ou o motivo da decisao"}
                        value={commentDraft}
                        onChange={(e) => setCommentDraft(e.target.value)}
                        disabled={commentsLocked}
                      />
                    </div>
                  </div>

                  {!commentsLocked ? (
                    <div className="mt-4 rounded-[20px] border border-(--tc-border) bg-white px-4 py-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className={labelBase}>Campos para correcao</p>
                          <p className="mt-2 text-sm text-(--tc-text-secondary)">
                            Ao solicitar ajuste, marque os campos que o solicitante pode corrigir. Os demais permanecem somente leitura.
                          </p>
                        </div>
                        <span className="rounded-full border border-(--tc-border) bg-(--tc-surface-2) px-3 py-1 text-xs font-semibold text-(--tc-text-secondary)">
                          {adjustmentFieldsDraft.length} campo(s)
                        </span>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {adjustmentFieldOptions.map((option) => {
                          const selectedField = adjustmentFieldsDraft.includes(option.field);
                          return (
                            <button
                              key={`adjustment-field-${option.field}`}
                              type="button"
                              onClick={() =>
                                setAdjustmentFieldsDraft((current) =>
                                  current.includes(option.field)
                                    ? current.filter((field) => field !== option.field)
                                    : [...current, option.field],
                                )
                              }
                              className={`inline-flex items-center rounded-full border px-3 py-2 text-xs font-semibold transition ${
                                selectedField
                                  ? "border-rose-300 bg-rose-50 text-rose-700 shadow-[0_8px_18px_rgba(225,29,72,0.1)]"
                                  : "border-(--tc-border) bg-(--tc-surface-2) text-(--tc-text-secondary) hover:border-[rgba(239,0,1,0.28)] hover:text-(--tc-text-primary)"
                              }`}
                              title={option.hint}
                            >
                              {option.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-(--tc-border) pt-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex rounded-full px-3 py-1.5 text-xs font-semibold ${draft.passwordProvided ? "border border-emerald-300 bg-emerald-100 text-emerald-800" : "border border-rose-300 bg-rose-100 text-rose-800"}`}>
                        {draft.passwordProvided ? "Senha valida" : "Senha ausente"}
                      </span>
                      {requiresCompany && !draft.clientId ? (
                        <span className="inline-flex rounded-full border border-amber-300 bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-800">
                          Empresa obrigatoria
                        </span>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={saveChanges}
                      disabled={saving || !dirty}
                      className="rounded-full border border-(--tc-primary) bg-white px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.28em] text-(--tc-primary) transition hover:-translate-y-0.5 hover:bg-(--tc-primary) hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {saving ? "Salvando..." : dirty ? "Salvar analise" : "Sem alteracoes"}
                    </button>

                    <button
                      type="button"
                      onClick={requestAdjustment}
                      disabled={requestingAdjustment || !commentDraft.trim() || commentsLocked || adjustmentFieldsDraft.length === 0}
                      className="rounded-full border border-amber-400 bg-amber-50 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.28em] text-amber-800 transition hover:-translate-y-0.5 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {requestingAdjustment ? "Enviando..." : "Solicitar ajuste"}
                    </button>

                    <button
                      type="button"
                      onClick={rejectRequest}
                      aria-label="Recusar solicitacao"
                      disabled={accepting || !commentDraft.trim()}
                      className="rounded-full border border-rose-400 bg-rose-50 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.28em] text-rose-700 transition hover:-translate-y-0.5 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {accepting ? "Processando..." : "Recusar"}
                    </button>

                    <button
                      type="button"
                      onClick={acceptRequest}
                      aria-label="Aprovar solicitacao"
                      disabled={acceptDisabled}
                      className="rounded-full bg-(--tc-primary) px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.28em] text-white shadow-[0_14px_30px_rgba(1,24,72,0.2)] transition hover:-translate-y-0.5 hover:bg-[rgba(1,24,72,0.88)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {accepting ? "Aprovando..." : "Aprovar acesso"}
                    </button>
                    </div>
                  </div>
                </section>
              </div>
            )}
          </section>
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
