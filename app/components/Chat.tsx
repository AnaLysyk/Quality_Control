"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import {
  FiArrowUpRight,
  FiBookmark,
  FiChevronRight,
  FiClock,
  FiDownload,
  FiFileText,
  FiInbox,
  FiLink2,
  FiMessageSquare,
  FiPaperclip,
  FiRefreshCw,
  FiSearch,
  FiSend,
  FiUsers,
  FiX,
} from "react-icons/fi";

import UserAvatar from "@/components/UserAvatar";
import { useClientContext } from "@/context/ClientContext";
import { useAuthUser } from "@/hooks/useAuthUser";
import { fetchApi } from "@/lib/api";
import { resolveActiveIdentity } from "@/lib/activeIdentity";

type ChatAttachment = {
  id: string;
  kind: "file" | "link" | "note" | "system";
  label: string;
  url: string | null;
  mimeType: string | null;
  sizeLabel: string | null;
  sourceLabel: string | null;
};

type ChatContact = {
  id: string;
  name: string;
  email: string;
  user: string;
  avatar_url: string | null;
  permission_role: string | null;
  profile_kind: string | null;
  company_name: string | null;
  company_names: string[];
  active: boolean;
  status: string | null;
  job_title: string | null;
  linkedin_url: string | null;
  origin_label: string | null;
};

type ChatThreadSummary = {
  key: string;
  peerId: string;
  peerName: string;
  peerHandle: string | null;
  peerAvatarUrl: string | null;
  lastMessage: string;
  lastMessageAt: string;
  lastSenderId: string;
  lastSenderName: string;
  messageCount: number;
};

type ChatMessage = {
  id: string;
  threadKey: string;
  senderId: string;
  senderName: string;
  senderHandle: string | null;
  senderAvatarUrl: string | null;
  recipientId: string;
  recipientName: string;
  recipientHandle: string | null;
  recipientAvatarUrl: string | null;
  text: string;
  attachments?: ChatAttachment[];
  createdAt: string;
};

type TimelineEntry =
  | { kind: "divider"; key: string; label: string }
  | { kind: "message"; key: string; message: ChatMessage };

function makeClientId(prefix: string) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;
}

function normalizeSearch(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function formatCompactDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatClock(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatRelative(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `ha ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `ha ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `ha ${days}d`;
  return formatCompactDate(value);
}

function formatDayLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "short",
  }).format(date);
}

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getContactRoleLabel(contact: ChatContact) {
  const value = (contact.profile_kind ?? contact.permission_role ?? "").toLowerCase();
  if (value === "leader_tc") return "Líder TC";
  if (value === "technical_support") return "Suporte Tecnico";
  if (value === "empresa") return "Empresa";
  if (value === "company_user") return "Usuario da empresa";
  if (value === "testing_company_user") return "Usuario TC";
  return contact.origin_label ?? "Contato";
}

function getContactSubtitle(contact: ChatContact) {
  const parts = [
    contact.user ? `@${contact.user}` : "",
    contact.email,
    contact.job_title ?? "",
  ].filter(Boolean);
  return parts.join(" | ");
}

function getCompanySummary(contact: ChatContact) {
  const names = contact.company_names.filter(Boolean);
  if (!names.length) return contact.company_name ?? null;
  if (names.length === 1) return names[0];
  return `${names[0]} +${names.length - 1}`;
}

function isFullDirectoryUser(user: unknown) {
  const legacyUser = (user ?? null) as {
    isGlobalAdmin?: boolean;
    is_global_admin?: boolean;
    globalRole?: string | null;
    permissionRole?: string | null;
    companyRole?: string | null;
    role?: string | null;
  } | null;

  if (legacyUser?.isGlobalAdmin || legacyUser?.is_global_admin) return true;
  const roles = [
    legacyUser?.globalRole,
    legacyUser?.permissionRole,
    legacyUser?.companyRole,
    legacyUser?.role,
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map((value) => value.trim().toLowerCase());

  return roles.some((value) =>
    value === "global_admin" || value === "leader_tc" || value === "technical_support",
  );
}

function buildFileAttachments(files: File[]) {
  return files
    .filter((file) => Boolean(file.name.trim()))
    .map<ChatAttachment>((file) => ({
      id: makeClientId("file"),
      kind: "file",
      label: file.name.trim(),
      url: null,
      mimeType: file.type || null,
      sizeLabel: formatFileSize(file.size),
      sourceLabel: "Arquivo local",
    }));
}

function buildUrlAttachment(url: string, sourceLabel: string) {
  const trimmed = url.trim();
  if (!trimmed) return null;

  const isSystemUrl =
    trimmed.startsWith("/") ||
    trimmed.startsWith("http://localhost") ||
    trimmed.includes("/admin/") ||
    trimmed.includes("/empresas/") ||
    trimmed.includes("/chat");

  return {
    id: makeClientId(isSystemUrl ? "system" : "link"),
    kind: isSystemUrl ? "system" : "link",
    label: trimmed.replace(/^https?:\/\//i, "").slice(0, 96),
    url: trimmed,
    mimeType: null,
    sizeLabel: null,
    sourceLabel,
  } satisfies ChatAttachment;
}

function buildNoteAttachment(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return null;
  return {
    id: makeClientId("note"),
    kind: "note",
    label: trimmed.slice(0, 120),
    url: null,
    mimeType: "text/plain",
    sizeLabel: `${trimmed.length} caracteres`,
    sourceLabel: "Nota arrastada",
  } satisfies ChatAttachment;
}

function attachmentTone(attachment: ChatAttachment) {
  if (attachment.kind === "system") return "border-sky-400/20 bg-sky-400/10 text-sky-100";
  if (attachment.kind === "link") return "border-emerald-400/20 bg-emerald-400/10 text-emerald-100";
  if (attachment.kind === "note") return "border-violet-400/20 bg-violet-400/10 text-violet-100";
  return "border-black/10 bg-(--tc-surface-alt) text-(--tc-text-primary) dark:border-white/12 dark:bg-white/8 dark:text-white";
}

function ContactRow({
  contact,
  active,
  recent,
  onSelect,
}: {
  contact: ChatContact;
  active: boolean;
  recent: boolean;
  onSelect: (contactId: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(contact.id)}
      className={`group flex w-full items-start gap-3 rounded-[20px] border px-3 py-3 text-left transition ${
        active
          ? "border-black/16 bg-(--tc-surface) text-(--tc-text-primary) shadow-[0_12px_26px_rgba(1,24,72,0.10)] dark:border-white/16 dark:bg-white/10 dark:text-white dark:shadow-[0_12px_26px_rgba(1,24,72,0.24)]"
          : "border-transparent bg-transparent text-(--tc-text-primary) hover:border-black/10 hover:bg-black/2 dark:text-white/82 dark:hover:border-white/10 dark:hover:bg-white/6 dark:hover:text-white"
      }`}
    >
      <UserAvatar
        src={contact.avatar_url}
        name={contact.name}
        size="sm"
        className="shrink-0"
        frameClassName={active ? "border border-black/16 dark:border-white/16" : "border border-black/10 dark:border-white/10"}
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold leading-5">{contact.name}</div>
            <div className="truncate text-xs leading-5 opacity-65">{getContactSubtitle(contact)}</div>
          </div>
          {recent ? (
            <span className="inline-flex rounded-full border border-black/10 bg-black/4 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-(--tc-text-muted) dark:border-white/10 dark:bg-white/8 dark:text-white/68">
              Recente
            </span>
          ) : null}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="inline-flex rounded-full border border-black/10 bg-black/4 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-(--tc-text-muted) dark:border-white/10 dark:bg-white/8 dark:text-white/72">
            {getContactRoleLabel(contact)}
          </span>
          {getCompanySummary(contact) ? (
            <span className="inline-flex max-w-full rounded-full border border-black/10 bg-black/4 px-2.5 py-1 text-[10px] font-semibold text-(--tc-text-muted) dark:border-white/10 dark:bg-white/8 dark:text-white/72">
              <span className="truncate">{getCompanySummary(contact)}</span>
            </span>
          ) : null}
        </div>
      </div>

      <FiChevronRight
        className="mt-1 shrink-0 text-(--tc-text-muted) transition group-hover:text-(--tc-text-primary) dark:text-white/38 dark:group-hover:text-white"
        size={16}
      />
    </button>
  );
}

function ThreadRow({
  summary,
  contact,
  active,
  currentUserId,
  onSelect,
}: {
  summary: ChatThreadSummary;
  contact: ChatContact | null;
  active: boolean;
  currentUserId: string;
  onSelect: (contactId: string) => void;
}) {
  const label = summary.lastSenderId === currentUserId ? "Voce" : summary.lastSenderName;

  return (
    <button
      type="button"
      onClick={() => onSelect(summary.peerId)}
      className={`group flex w-full items-start gap-3 rounded-[20px] border px-3 py-3 text-left transition ${
        active
          ? "border-black/16 bg-(--tc-surface) text-(--tc-text-primary) shadow-[0_12px_26px_rgba(1,24,72,0.10)] dark:border-white/16 dark:bg-white/10 dark:text-white dark:shadow-[0_12px_26px_rgba(1,24,72,0.24)]"
          : "border-transparent bg-transparent text-(--tc-text-primary) hover:border-black/10 hover:bg-black/2 dark:text-white/82 dark:hover:border-white/10 dark:hover:bg-white/6 dark:hover:text-white"
      }`}
    >
      <UserAvatar
        src={contact?.avatar_url ?? summary.peerAvatarUrl}
        name={contact?.name ?? summary.peerName}
        size="sm"
        className="shrink-0"
        frameClassName={active ? "border border-black/16 dark:border-white/16" : "border border-black/10 dark:border-white/10"}
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold leading-5">{contact?.name ?? summary.peerName}</div>
            <div className="truncate text-xs leading-5 opacity-65">
              {summary.messageCount} mensagem{summary.messageCount === 1 ? "" : "s"}
            </div>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full border border-black/10 bg-black/4 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-(--tc-text-muted) dark:border-white/10 dark:bg-white/8 dark:text-white/68">
            <FiClock size={10} />
            {formatRelative(summary.lastMessageAt)}
          </span>
        </div>
        <div className="mt-2 truncate text-xs leading-5 opacity-72">
          <span className="font-semibold text-(--tc-text-primary) dark:text-white/88">{label}:</span> {summary.lastMessage}
        </div>
      </div>
    </button>
  );
}

function AttachmentCard({
  attachment,
  compact = false,
  removable = false,
  onRemove,
}: {
  attachment: ChatAttachment;
  compact?: boolean;
  removable?: boolean;
  onRemove?: (attachmentId: string) => void;
}) {
  return (
    <div
      className={`rounded-2xl border px-3 py-2.5 ${attachmentTone(attachment)} ${compact ? "text-xs" : "text-sm"}`}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0">
          {attachment.kind === "file" ? <FiPaperclip size={15} /> : null}
          {attachment.kind === "link" ? <FiLink2 size={15} /> : null}
          {attachment.kind === "system" ? <FiBookmark size={15} /> : null}
          {attachment.kind === "note" ? <FiFileText size={15} /> : null}
        </div>

        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{attachment.label}</div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] opacity-80">
            {attachment.sourceLabel ? <span>{attachment.sourceLabel}</span> : null}
            {attachment.sizeLabel ? <span>{attachment.sizeLabel}</span> : null}
            {attachment.mimeType ? <span>{attachment.mimeType}</span> : null}
          </div>
        </div>

        {attachment.url ? (
          <a
            href={attachment.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-current/15 bg-black/10 transition hover:bg-black/20"
            title="Abrir referencia"
            aria-label={`Abrir ${attachment.label}`}
          >
            <FiArrowUpRight size={14} />
          </a>
        ) : null}

        {removable && onRemove ? (
          <button
            type="button"
            onClick={() => onRemove(attachment.id)}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-current/15 bg-black/10 transition hover:bg-black/20"
            aria-label={`Remover ${attachment.label}`}
            title="Remover referencia"
          >
            <FiX size={14} />
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default function Chat() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuthUser();
  const { activeClient } = useClientContext();
  const activeIdentity = resolveActiveIdentity({ user, activeCompany: activeClient });
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const contactsAbortRef = useRef<AbortController | null>(null);
  const threadsAbortRef = useRef<AbortController | null>(null);
  const messagesAbortRef = useRef<AbortController | null>(null);

  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [threads, setThreads] = useState<ChatThreadSummary[]>([]);
  const [selectedPeerId, setSelectedPeerId] = useState<string | null>(() => searchParams.get("peer")?.trim() || null);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draftAttachments, setDraftAttachments] = useState<ChatAttachment[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [threadsLoading, setThreadsLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [draggingComposer, setDraggingComposer] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [threadError, setThreadError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, router, user]);

  const loadContacts = useCallback(async () => {
    contactsAbortRef.current?.abort();
    const controller = new AbortController();
    contactsAbortRef.current = controller;

    setContactsLoading(true);
    setError(null);
    try {
      const response = await fetchApi("/api/chat/contacts", {
        signal: controller.signal,
        cache: "no-store",
      });
      if (response.status === 401) {
        router.replace("/login");
        return;
      }
      const payload = (await response.json().catch(() => ({ items: [] }))) as { items?: ChatContact[]; error?: string };
      if (!response.ok) {
        setError(payload.error || "Nao foi possivel carregar os contatos.");
        setContacts([]);
        return;
      }
      setContacts(Array.isArray(payload.items) ? payload.items : []);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Nao foi possivel carregar os contatos.");
      setContacts([]);
    } finally {
      setContactsLoading(false);
    }
  }, [router]);

  const loadThreads = useCallback(async () => {
    threadsAbortRef.current?.abort();
    const controller = new AbortController();
    threadsAbortRef.current = controller;

    setThreadsLoading(true);
    try {
      const response = await fetchApi("/api/chat/messages", {
        signal: controller.signal,
        cache: "no-store",
      });
      if (response.status === 401) {
        router.replace("/login");
        return;
      }
      const payload = (await response.json().catch(() => ({ threads: [] }))) as {
        threads?: ChatThreadSummary[];
      };
      if (!response.ok) {
        setThreads([]);
        return;
      }
      setThreads(Array.isArray(payload.threads) ? payload.threads : []);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setThreads([]);
    } finally {
      setThreadsLoading(false);
    }
  }, [router]);

  const loadMessages = useCallback(
    async (peerId: string | null) => {
      messagesAbortRef.current?.abort();
      if (!peerId) {
        setMessages([]);
        setThreadError(null);
        return;
      }

      const controller = new AbortController();
      messagesAbortRef.current = controller;

      setMessagesLoading(true);
      setThreadError(null);
      try {
        const response = await fetchApi(`/api/chat/messages?peerId=${encodeURIComponent(peerId)}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (response.status === 401) {
          router.replace("/login");
          return;
        }
        const payload = (await response.json().catch(() => ({ messages: [] }))) as {
          messages?: ChatMessage[];
          error?: string;
        };
        if (!response.ok) {
          setThreadError(payload.error || "Nao foi possivel carregar a conversa.");
          setMessages([]);
          return;
        }
        setMessages(Array.isArray(payload.messages) ? payload.messages : []);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setThreadError(err instanceof Error ? err.message : "Nao foi possivel carregar a conversa.");
        setMessages([]);
      } finally {
        setMessagesLoading(false);
      }
    },
    [router],
  );

  useEffect(() => {
    void loadContacts();
    void loadThreads();
  }, [loadContacts, loadThreads]);

  useEffect(() => {
    const peerId = searchParams.get("peer")?.trim() || null;
    if (peerId !== selectedPeerId) {
      setSelectedPeerId(peerId);
    }
  }, [searchParams, selectedPeerId]);

  useEffect(() => {
    void loadMessages(selectedPeerId);
  }, [loadMessages, selectedPeerId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const contactsById = useMemo(() => new Map(contacts.map((contact) => [contact.id, contact])), [contacts]);
  const threadByPeerId = useMemo(() => new Map(threads.map((thread) => [thread.peerId, thread])), [threads]);
  const selectedContact = selectedPeerId ? contactsById.get(selectedPeerId) ?? null : null;
  const selectedThreadSummary = selectedPeerId ? threadByPeerId.get(selectedPeerId) ?? null : null;
  const currentUserId = user?.id ?? "";
  const hasFullDirectoryAccess = isFullDirectoryUser(user);
  const accessLabel = hasFullDirectoryAccess ? "Visão global" : "Empresas vinculadas";
  const accessNote = hasFullDirectoryAccess
    ? "Suporte técnico, líder TC e administradores conseguem conversar com toda a plataforma."
    : "Os demais perfis enxergam apenas usuários das empresas vinculadas, respeitando as permissões atuais.";

  const filteredContacts = useMemo(() => {
    const term = normalizeSearch(search);
    if (!term) return contacts;
    return contacts.filter((contact) => {
      const haystack = normalizeSearch(
        [
          contact.name,
          contact.email,
          contact.user,
          contact.company_name,
          ...(contact.company_names ?? []),
          contact.permission_role ?? "",
          contact.profile_kind ?? "",
          contact.job_title ?? "",
          contact.origin_label ?? "",
        ]
          .filter(Boolean)
          .join(" "),
      );
      return haystack.includes(term);
    });
  }, [contacts, search]);

  const quickMatches = useMemo(() => filteredContacts.slice(0, 6), [filteredContacts]);
  const recentContactIds = useMemo(() => new Set(threads.map((thread) => thread.peerId)), [threads]);
  const recentThreads = useMemo(() => threads.slice(0, 8), [threads]);
  const activePeerAvatar = selectedContact?.avatar_url ?? selectedThreadSummary?.peerAvatarUrl ?? null;
  const activePeerName = selectedContact?.name ?? selectedThreadSummary?.peerName ?? "Selecione um usuário";
  const activePeerHandle = selectedContact?.user
    ? `@${selectedContact.user}`
    : selectedThreadSummary?.peerHandle
      ? `@${selectedThreadSummary.peerHandle}`
      : null;
  const activePeerCompany = selectedContact ? getCompanySummary(selectedContact) : null;
  const selectedThreadPreview = selectedThreadSummary
    ? `${selectedThreadSummary.lastSenderId === currentUserId ? "Voce" : selectedThreadSummary.lastSenderName}: ${selectedThreadSummary.lastMessage}`
    : "";

  const timeline = useMemo<TimelineEntry[]>(() => {
    const items: TimelineEntry[] = [];
    let lastDay = "";

    messages.forEach((messageItem) => {
      const day = new Date(messageItem.createdAt).toISOString().slice(0, 10);
      if (day !== lastDay) {
        lastDay = day;
        items.push({
          kind: "divider",
          key: `divider-${day}`,
          label: formatDayLabel(messageItem.createdAt),
        });
      }
      items.push({
        kind: "message",
        key: messageItem.id,
        message: messageItem,
      });
    });

    return items;
  }, [messages]);

  const appendDraftAttachments = useCallback((incoming: ChatAttachment[]) => {
    if (!incoming.length) return;
    setDraftAttachments((current) => {
      const next = [...current];
      for (const attachment of incoming) {
        const dedupeKey = `${attachment.kind}:${attachment.label}:${attachment.url ?? ""}`;
        const exists = next.some(
          (item) => `${item.kind}:${item.label}:${item.url ?? ""}` === dedupeKey,
        );
        if (!exists) next.push(attachment);
      }
      return next.slice(-8);
    });
  }, []);

  const removeDraftAttachment = useCallback((attachmentId: string) => {
    setDraftAttachments((current) => current.filter((attachment) => attachment.id !== attachmentId));
  }, []);

  const openConversation = useCallback(
    (peerId: string) => {
      setSelectedPeerId(peerId);
      setMessage("");
      setDraftAttachments([]);
      setThreadError(null);
      const params = new URLSearchParams(searchParams.toString());
      params.set("peer", peerId);
      router.replace(params.toString() ? `/chat?${params.toString()}` : "/chat", { scroll: false });
    },
    [router, searchParams],
  );

  const clearConversation = useCallback(() => {
    setSelectedPeerId(null);
    setMessage("");
    setDraftAttachments([]);
    setThreadError(null);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("peer");
    router.replace(params.toString() ? `/chat?${params.toString()}` : "/chat", { scroll: false });
    window.setTimeout(() => {
      searchInputRef.current?.focus();
    }, 0);
  }, [router, searchParams]);

  const handleSearchKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      const firstMatch = filteredContacts[0];
      if (firstMatch) {
        openConversation(firstMatch.id);
      }
    },
    [filteredContacts, openConversation],
  );

  const sendMessage = useCallback(
    async (event?: FormEvent<HTMLFormElement>) => {
      event?.preventDefault();
      const trimmedMessage = message.trim();
      if (!selectedPeerId || (!trimmedMessage && draftAttachments.length === 0) || sending) return;

      setSending(true);
      setThreadError(null);
      try {
        const response = await fetchApi("/api/chat/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            peerId: selectedPeerId,
            text: trimmedMessage,
            attachments: draftAttachments,
          }),
        });
        if (response.status === 401) {
          router.replace("/login");
          return;
        }
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        if (!response.ok) {
          setThreadError(payload.error || "Nao foi possivel enviar a mensagem.");
          return;
        }

        setMessage("");
        setDraftAttachments([]);
        await Promise.all([loadMessages(selectedPeerId), loadThreads()]);
      } catch (err) {
        setThreadError(err instanceof Error ? err.message : "Nao foi possivel enviar a mensagem.");
      } finally {
        setSending(false);
      }
    },
    [draftAttachments, loadMessages, loadThreads, message, router, sending, selectedPeerId],
  );

  const handleFileInputChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    appendDraftAttachments(buildFileAttachments(files));
    event.target.value = "";
  }, [appendDraftAttachments]);

  const exportConversation = useCallback(() => {
    if (!selectedPeerId || !selectedContact) return;

    const lines = [
      `Conversa com ${selectedContact.name}`,
      activePeerHandle ? `Usuario: ${activePeerHandle}` : null,
      activePeerCompany ? `Empresa: ${activePeerCompany}` : null,
      "",
      ...messages.flatMap((item) => {
        const header = `[${formatCompactDate(item.createdAt)}] ${item.senderName}`;
        const textLine = item.text ? item.text : "(sem texto)";
        const attachmentsLines =
          item.attachments?.map((attachment) => {
            const details = [attachment.sourceLabel, attachment.sizeLabel, attachment.url].filter(Boolean).join(" | ");
            return `  - ${attachment.label}${details ? ` (${details})` : ""}`;
          }) ?? [];
        return [header, textLine, ...(attachmentsLines.length > 0 ? ["Anexos:", ...attachmentsLines] : []), ""];
      }),
    ]
      .filter((line): line is string => typeof line === "string")
      .join("\n");

    const blob = new Blob([lines], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const safeName = selectedContact.name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase();
    anchor.href = url;
    anchor.download = `chat-${safeName || "conversa"}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [activePeerCompany, activePeerHandle, messages, selectedContact, selectedPeerId]);

  const handleComposerDrop = useCallback((event: DragEvent<HTMLFormElement>) => {
    event.preventDefault();
    setDraggingComposer(false);

    const attachments: ChatAttachment[] = [];
    const files = Array.from(event.dataTransfer.files ?? []);
    if (files.length > 0) {
      attachments.push(...buildFileAttachments(files));
    }

    const uriList = event.dataTransfer.getData("text/uri-list");
    if (uriList.trim()) {
      const attachment = buildUrlAttachment(uriList.split("\n").find(Boolean) ?? uriList, "Link arrastado");
      if (attachment) attachments.push(attachment);
    }

    const plainText = event.dataTransfer.getData("text/plain");
    if (!uriList.trim() && plainText.trim()) {
      const maybeUrl = plainText.trim();
      const isUrl = /^https?:\/\//i.test(maybeUrl) || maybeUrl.startsWith("/");
      const attachment = isUrl
        ? buildUrlAttachment(maybeUrl, maybeUrl.startsWith("/") ? "Atalho do sistema" : "Link arrastado")
        : buildNoteAttachment(maybeUrl);
      if (attachment) attachments.push(attachment);
    }

    appendDraftAttachments(attachments);
  }, [appendDraftAttachments]);

  if (loading && !user) {
    return (
      <div className="min-h-[calc(100vh-var(--topbar-h)-1rem)]">
        <div className="h-full overflow-hidden rounded-[28px] border border-black/10 bg-(--tc-surface) px-5 py-6 text-(--tc-text-primary) shadow-[0_26px_80px_rgba(1,24,72,0.14)] dark:border-white/10 dark:bg-[#07111f] dark:text-white dark:shadow-[0_26px_80px_rgba(1,24,72,0.28)]">
          <div className="grid h-full gap-5 lg:grid-cols-[22rem_minmax(0,1fr)]">
            <div className="rounded-3xl border border-black/10 bg-(--tc-surface-alt) p-4 dark:border-white/10 dark:bg-white/6">
              <div className="h-10 w-48 animate-pulse rounded-full bg-black/6 dark:bg-white/10" />
              <div className="mt-4 h-11 animate-pulse rounded-2xl bg-black/6 dark:bg-white/10" />
              <div className="mt-6 space-y-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="h-16 animate-pulse rounded-[20px] bg-black/4 dark:bg-white/8" />
                ))}
              </div>
            </div>
            <div className="rounded-3xl border border-black/10 bg-(--tc-surface-alt) p-4 dark:border-white/10 dark:bg-white/4">
              <div className="h-14 w-72 animate-pulse rounded-[20px] bg-black/6 dark:bg-white/10" />
              <div className="mt-6 space-y-4">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="h-20 animate-pulse rounded-[22px] bg-black/4 dark:bg-white/8" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-[calc(100vh-var(--topbar-h)-1rem)] bg-(--tc-surface) text-(--page-text) lg:h-[calc(100vh-var(--topbar-h)-1rem)]">
      <div className="flex h-full min-h-[calc(100vh-var(--topbar-h)-1rem)] flex-col overflow-hidden bg-(--tc-surface) text-(--tc-text-primary) dark:bg-[#07111f] dark:text-white lg:flex-row">
        <aside className="flex w-full shrink-0 flex-col border-b border-black/8 bg-(--tc-surface-alt) dark:border-white/8 dark:bg-[linear-gradient(180deg,rgba(9,18,34,0.98)_0%,rgba(8,17,31,0.96)_100%)] lg:w-88 lg:border-b-0 lg:border-r lg:border-black/8 lg:dark:border-white/8">
          <div className="border-b border-black/8 px-4 py-4 sm:px-5 dark:border-white/8">
            <div className="flex items-center gap-3">
              <UserAvatar
                src={activeIdentity.avatarUrl}
                name={activeIdentity.displayName}
                size="md"
                className="shrink-0"
                frameClassName="border border-black/10 dark:border-white/12"
              />
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-(--tc-text-primary) dark:text-white">
                  {activeIdentity.displayName}
                </div>
                <div className="truncate text-xs text-(--tc-text-muted) dark:text-white/56">
                  {activeIdentity.kind === "company" ? "Conta institucional" : activeIdentity.companyTagLabel ?? "Conta autenticada"}
                </div>
              </div>
            </div>

            <div className="mt-4">
              <label className="flex items-center gap-3 rounded-[20px] border border-black/10 bg-(--tc-surface) px-4 py-3 text-sm text-(--tc-text-primary) focus-within:border-black/18 focus-within:bg-(--tc-surface) dark:border-white/10 dark:bg-white/6 dark:text-white/78 dark:focus-within:border-white/18 dark:focus-within:bg-white/8">
                <FiSearch className="shrink-0 text-(--tc-text-muted) dark:text-white/42" />
                <input
                  ref={searchInputRef}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Buscar usuário pelo nome"
                  className="w-full bg-transparent outline-none placeholder:text-[color-mix(in_srgb,var(--tc-text-muted)_70%,transparent)] dark:placeholder:text-white/34"
                />
              </label>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="inline-flex rounded-full border border-black/10 bg-black/4 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-(--tc-text-muted) dark:border-white/10 dark:bg-white/8 dark:text-white/76">
                Chatcode
              </span>
              <span className="inline-flex rounded-full border border-black/10 bg-black/4 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-(--tc-text-muted) dark:border-white/10 dark:bg-white/8 dark:text-white/76">
                {accessLabel}
              </span>
              <span className="inline-flex rounded-full border border-black/10 bg-black/4 px-2.5 py-1 text-[10px] font-semibold text-(--tc-text-muted) dark:border-white/10 dark:bg-white/8 dark:text-white/72">
                {contacts.length} contatos
              </span>
            </div>

            <p className="mt-3 text-xs leading-5 text-(--tc-text-muted) dark:text-white/54">{accessNote}</p>

            {error ? (
              <div className="mt-3 rounded-[18px] border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">
                {error}
              </div>
            ) : null}

            {search.trim() ? (
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between gap-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-(--tc-text-muted) dark:text-white/52">
                  <span>Atalhos da busca</span>
                  <span>Enter abre o primeiro</span>
                </div>
                <div className="space-y-2">
                  {quickMatches.length > 0 ? (
                    quickMatches.map((contact) => (
                      <button
                        key={contact.id}
                        type="button"
                        onClick={() => openConversation(contact.id)}
                        className="flex w-full items-center gap-3 rounded-[18px] border border-black/10 bg-(--tc-surface) px-3 py-2.5 text-left transition hover:border-black/16 hover:bg-black/2 dark:border-white/10 dark:bg-white/6 dark:hover:border-white/16 dark:hover:bg-white/9"
                      >
                        <UserAvatar
                          src={contact.avatar_url}
                          name={contact.name}
                          size="sm"
                          className="shrink-0"
                          frameClassName="border border-black/10 dark:border-white/10"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-(--tc-text-primary) dark:text-white">{contact.name}</div>
                          <div className="truncate text-xs text-(--tc-text-muted) dark:text-white/58">{contact.user ? `@${contact.user}` : contact.email}</div>
                        </div>
                        <FiChevronRight size={14} className="shrink-0 text-(--tc-text-muted) dark:text-white/38" />
                      </button>
                    ))
                  ) : (
                    <div className="rounded-[18px] border border-dashed border-black/12 bg-black/2 px-3 py-3 text-sm text-(--tc-text-muted) dark:border-white/12 dark:bg-white/4 dark:text-white/58">
                      Nenhum resultado direto. Tente outro nome.
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>

          <div className="chat-scroll min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4">
            <section>
              <div className="mb-3 flex items-center justify-between gap-3 px-1">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-(--tc-text-muted) dark:text-white/52">
                  <FiInbox size={13} />
                  Recentes
                </div>
                <button
                  type="button"
                  onClick={() => void loadThreads()}
                  className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-(--tc-surface) px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-(--tc-text-primary) transition hover:border-black/16 hover:bg-black/2 dark:border-white/10 dark:bg-white/6 dark:text-white/72 dark:hover:border-white/16 dark:hover:bg-white/10 dark:hover:text-white"
                >
                  <FiRefreshCw size={11} />
                  Atualizar
                </button>
              </div>

              <div className="space-y-1.5">
                {threadsLoading ? (
                  <div className="rounded-[18px] border border-dashed border-black/12 bg-black/2 px-3 py-4 text-sm text-(--tc-text-muted) dark:border-white/12 dark:bg-white/4 dark:text-white/56">
                    Carregando conversas...
                  </div>
                ) : recentThreads.length > 0 ? (
                  recentThreads.map((summary) => (
                    <ThreadRow
                      key={summary.key}
                      summary={summary}
                      contact={contactsById.get(summary.peerId) ?? null}
                      active={summary.peerId === selectedPeerId}
                      currentUserId={currentUserId}
                      onSelect={openConversation}
                    />
                  ))
                ) : (
                  <div className="rounded-[18px] border border-dashed border-black/12 bg-black/2 px-3 py-4 text-sm text-(--tc-text-muted) dark:border-white/12 dark:bg-white/4 dark:text-white/56">
                    Ainda nao ha conversas recentes.
                  </div>
                )}
              </div>
            </section>

            <div className="my-4 h-px bg-black/8 dark:bg-white/8" />

            <section>
              <div className="mb-3 flex items-center justify-between gap-3 px-1">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-(--tc-text-muted) dark:text-white/52">
                  <FiUsers size={13} />
                  Usuarios visiveis
                </div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-(--tc-text-muted) dark:text-white/42">
                  {filteredContacts.length}
                </div>
              </div>

              <div className="space-y-1.5">
                {contactsLoading ? (
                  <div className="rounded-[18px] border border-dashed border-black/12 bg-black/2 px-3 py-4 text-sm text-(--tc-text-muted) dark:border-white/12 dark:bg-white/4 dark:text-white/56">
                    Carregando contatos...
                  </div>
                ) : filteredContacts.length > 0 ? (
                  filteredContacts.map((contact) => (
                    <ContactRow
                      key={contact.id}
                      contact={contact}
                      active={contact.id === selectedPeerId}
                      recent={recentContactIds.has(contact.id)}
                      onSelect={openConversation}
                    />
                  ))
                ) : search.trim() ? (
                  <div className="rounded-[18px] border border-dashed border-black/12 bg-black/2 px-3 py-4 text-sm text-(--tc-text-muted) dark:border-white/12 dark:bg-white/4 dark:text-white/56">
                    Nenhum usuário encontrado para &quot;{search.trim()}&quot;.
                  </div>
                ) : (
                  <div className="rounded-[18px] border border-dashed border-black/12 bg-black/2 px-3 py-4 text-sm text-(--tc-text-muted) dark:border-white/12 dark:bg-white/4 dark:text-white/56">
                    Digite um nome para iniciar uma conversa.
                  </div>
                )}
              </div>
            </section>
          </div>
        </aside>

        <section className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="border-b border-black/8 bg-(--tc-surface-alt) px-4 py-4 backdrop-blur dark:border-white/8 dark:bg-[linear-gradient(180deg,rgba(8,16,30,0.92)_0%,rgba(8,16,30,0.68)_100%)] xl:px-8">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-4">
                  <UserAvatar
                    src={activePeerAvatar}
                    name={activePeerName}
                    size="lg"
                    className="shrink-0"
                    frameClassName="border border-black/10 dark:border-white/12"
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="truncate text-2xl font-semibold tracking-tight text-(--tc-text-primary) dark:text-white">
                        {selectedPeerId ? activePeerName : "Conversas"}
                      </h1>
                      <span className="inline-flex rounded-full border border-black/10 bg-black/4 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-(--tc-text-muted) dark:border-white/10 dark:bg-white/8 dark:text-white/74">
                        {selectedPeerId ? "Thread ativa" : "Pronto para iniciar"}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-(--tc-text-muted) dark:text-white/62">
                      {activePeerHandle ? <span>{activePeerHandle}</span> : null}
                      {activePeerCompany ? <span>{activePeerCompany}</span> : null}
                      {selectedThreadSummary ? <span>{selectedThreadSummary.messageCount} mensagens</span> : null}
                    </div>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-(--tc-text-muted) dark:text-white/54">
                      {selectedPeerId
                        ? selectedThreadPreview || "Conversa pronta para receber a primeira mensagem."
                        : "Busque um usuário, arraste referências do sistema, adicione anexos e trabalhe a conversa em um fluxo contínuo."}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={exportConversation}
                  disabled={!selectedPeerId}
                  className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-(--tc-surface) px-4 py-2 text-sm font-semibold text-(--tc-text-primary) transition hover:border-black/16 hover:bg-black/2 disabled:cursor-not-allowed disabled:opacity-45 dark:border-white/10 dark:bg-white/8 dark:text-white/76 dark:hover:border-white/16 dark:hover:bg-white/12 dark:hover:text-white"
                >
                  <FiDownload size={14} />
                  Exportar
                </button>
                <button
                  type="button"
                  onClick={() => void loadMessages(selectedPeerId)}
                  disabled={!selectedPeerId}
                  className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-(--tc-surface) px-4 py-2 text-sm font-semibold text-(--tc-text-primary) transition hover:border-black/16 hover:bg-black/2 disabled:cursor-not-allowed disabled:opacity-45 dark:border-white/10 dark:bg-white/8 dark:text-white/76 dark:hover:border-white/16 dark:hover:bg-white/12 dark:hover:text-white"
                >
                  <FiRefreshCw size={14} />
                  Atualizar
                </button>
                <button
                  type="button"
                  onClick={clearConversation}
                  className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-(--tc-surface) px-4 py-2 text-sm font-semibold text-(--tc-text-primary) transition hover:border-black/16 hover:bg-black/2 dark:border-white/10 dark:bg-white/8 dark:text-white/76 dark:hover:border-white/16 dark:hover:bg-white/12 dark:hover:text-white"
                >
                  <FiX size={14} />
                  Trocar usuário
                </button>
              </div>
            </div>
          </header>

          {threadError ? (
            <div className="border-b border-rose-400/18 bg-rose-500/10 px-4 py-3 text-sm text-rose-100 xl:px-8">
              {threadError}
            </div>
          ) : null}

          <div className="chat-scroll min-h-0 flex-1 overflow-y-auto px-4 py-4 xl:px-8 xl:py-6">
            {selectedPeerId ? (
              <div className="flex min-h-full w-full flex-col gap-4">
                {messagesLoading && messages.length === 0 ? (
                  <div className="space-y-4">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <div
                        key={index}
                        className={`flex items-end gap-3 ${index % 2 === 0 ? "justify-start" : "justify-end"}`}
                      >
                        <div className="h-10 w-10 animate-pulse rounded-full bg-white/10" />
                        <div className="h-20 w-[min(32rem,80%)] animate-pulse rounded-[22px] bg-white/10" />
                      </div>
                    ))}
                  </div>
                ) : timeline.length > 0 ? (
                  timeline.map((entry) => {
                    if (entry.kind === "divider") {
                      return (
                        <div key={entry.key} className="flex items-center gap-3 py-2">
                          <div className="h-px flex-1 bg-black/10 dark:bg-white/8" />
                          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-(--tc-text-muted) dark:text-white/40">
                            {entry.label}
                          </div>
                          <div className="h-px flex-1 bg-black/10 dark:bg-white/8" />
                        </div>
                      );
                    }

                    const item = entry.message;
                    const isMine = item.senderId === currentUserId;
                    const bubbleAvatar = isMine ? activeIdentity.avatarUrl : activePeerAvatar;
                    const bubbleName = isMine ? activeIdentity.displayName : activePeerName;

                    return (
                      <div
                        key={entry.key}
                        className="group/message flex items-start gap-3 rounded-lg px-2 py-1.5 transition hover:bg-black/3 dark:hover:bg-white/5"
                      >
                        <UserAvatar
                          src={bubbleAvatar}
                          name={bubbleName}
                          size="sm"
                          className="mt-0.5 shrink-0"
                          frameClassName="border border-black/10 dark:border-white/10"
                        />

                        <div className="min-w-0 flex-1 text-(--tc-text-primary) dark:text-white">
                          <div className="flex flex-wrap items-baseline gap-2 text-xs text-(--tc-text-muted) dark:text-white/56">
                            <span className="text-sm font-semibold text-(--tc-text-primary) dark:text-white">
                              {isMine ? "Voce" : item.senderName}
                            </span>
                            <span>{formatClock(item.createdAt)}</span>
                          </div>

                          {item.text ? (
                            <p className="mt-1 whitespace-pre-wrap text-sm leading-6">{item.text}</p>
                          ) : null}

                          {item.attachments?.length ? (
                            <div className={`${item.text ? "mt-3" : "mt-2"} space-y-2`}>
                              {item.attachments.map((attachment) => (
                                <AttachmentCard key={attachment.id} attachment={attachment} compact />
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="flex min-h-96 flex-col items-center justify-center rounded-3xl border border-dashed border-black/12 bg-black/2 px-6 text-center dark:border-white/10 dark:bg-white/4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-[20px] border border-black/10 bg-black/4 dark:border-white/10 dark:bg-white/8">
                      <FiMessageSquare size={22} className="text-(--tc-text-muted) dark:text-white/72" />
                    </div>
                    <h2 className="mt-4 text-xl font-semibold text-(--tc-text-primary) dark:text-white">
                      Primeira mensagem pronta para sair
                    </h2>
                    <p className="mt-2 max-w-xl text-sm leading-6 text-(--tc-text-muted) dark:text-white/56">
                      Escreva, arraste um link ou anexe uma referencia. Essa thread foi limpa para funcionar como uma conversa continua, sem capas e sem blocos pesados.
                    </p>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            ) : (
              <div className="flex min-h-full w-full flex-col items-center justify-center rounded-3xl border border-dashed border-black/12 bg-black/2 px-6 text-center dark:border-white/10 dark:bg-white/4">
                <div className="flex h-16 w-16 items-center justify-center rounded-[22px] border border-black/10 bg-black/4 dark:border-white/10 dark:bg-white/8">
                  <FiUsers size={24} className="text-(--tc-text-muted) dark:text-white/72" />
                </div>
                <h2 className="mt-4 text-2xl font-semibold tracking-tight text-(--tc-text-primary) dark:text-white">
                  Digite o nome de um usuário
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-(--tc-text-muted) dark:text-white/56">
                  A conversa abre na hora com foto, escopo de acesso e histórico. Se quiser acelerar ainda mais, arraste uma tela do sistema para o composer e comece pelo contexto.
                </p>
                {filteredContacts.length > 0 ? (
                  <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                    {filteredContacts.slice(0, 3).map((contact) => (
                      <button
                        key={contact.id}
                        type="button"
                        onClick={() => openConversation(contact.id)}
                        className="inline-flex items-center gap-3 rounded-full border border-black/10 bg-(--tc-surface) px-4 py-2 text-sm font-semibold text-(--tc-text-primary) transition hover:border-black/16 hover:bg-black/2 dark:border-white/10 dark:bg-white/8 dark:text-white dark:hover:border-white/16 dark:hover:bg-white/12"
                      >
                        <UserAvatar
                          src={contact.avatar_url}
                          name={contact.name}
                          size="sm"
                          className="shrink-0"
                          frameClassName="border border-black/10 dark:border-white/10"
                        />
                        {contact.name}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            )}
          </div>

          <div className="border-t border-black/8 bg-(--tc-surface-alt) px-4 py-4 backdrop-blur dark:border-white/8 dark:bg-[linear-gradient(180deg,rgba(8,16,30,0.86)_0%,rgba(6,12,24,0.98)_100%)] xl:px-8">
            <div className="w-full">
              {draftAttachments.length > 0 ? (
                <div className="mb-3 grid gap-2 sm:grid-cols-2">
                  {draftAttachments.map((attachment) => (
                    <AttachmentCard
                      key={attachment.id}
                      attachment={attachment}
                      compact
                      removable
                      onRemove={removeDraftAttachment}
                    />
                  ))}
                </div>
              ) : null}

              <form
                onSubmit={sendMessage}
                onDragEnter={(event) => {
                  event.preventDefault();
                  setDraggingComposer(true);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  if (!draggingComposer) setDraggingComposer(true);
                }}
                onDragLeave={(event) => {
                  event.preventDefault();
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                    setDraggingComposer(false);
                  }
                }}
                onDrop={handleComposerDrop}
                className="relative overflow-hidden rounded-xl border border-black/10 bg-(--tc-surface) px-3 py-3 shadow-[0_10px_28px_rgba(1,24,72,0.08)] dark:border-white/10 dark:bg-white/5 dark:shadow-none"
              >
                {draggingComposer ? (
                  <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-xl border-2 border-dashed border-black/18 bg-[rgba(255,255,255,0.78)] text-center backdrop-blur dark:border-white/28 dark:bg-[#07111f]/84">
                    <div>
                      <div className="text-sm font-semibold text-(--tc-text-primary) dark:text-white">Solte aqui para anexar</div>
                      <div className="mt-2 text-xs text-(--tc-text-muted) dark:text-white/60">
                        Arquivos, links e referências do sistema entram na conversa como contexto.
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-3 rounded-xl border border-dashed border-black/12 bg-black/2.5 px-3 py-3 text-(--tc-text-muted) dark:border-white/12 dark:bg-white/[0.035] sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-black/10 bg-(--tc-surface) text-(--tc-text-primary) dark:border-white/10 dark:bg-white/8 dark:text-white">
                        <FiPaperclip size={16} />
                      </span>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-(--tc-text-primary) dark:text-white">
                          Anexos e contexto da plataforma
                        </div>
                        <div className="mt-0.5 text-xs leading-5">
                          Anexe arquivos ou arraste links, textos e referências do sistema para esta conversa.
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={!selectedPeerId || sending}
                      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-black/10 bg-(--tc-surface) px-4 py-2.5 text-sm font-semibold text-(--tc-text-primary) transition hover:border-black/16 hover:bg-black/3 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/8 dark:text-white dark:hover:border-white/16 dark:hover:bg-white/12"
                    >
                      <FiPaperclip size={14} />
                      Anexar
                    </button>
                  </div>

                  <textarea
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    onKeyDown={(event: KeyboardEvent<HTMLTextAreaElement>) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        void sendMessage();
                      }
                    }}
                    placeholder={
                      selectedPeerId
                        ? `Escreva para ${activePeerName}. Arraste um link, um arquivo ou uma tela do sistema se quiser contextualizar.`
                        : "Escolha um usuário para começar"
                    }
                    rows={3}
                    disabled={!selectedPeerId || sending}
                    className="w-full resize-none rounded-lg border-0 bg-transparent px-2 py-2 text-sm leading-6 text-(--tc-text-primary) outline-none placeholder:text-[color-mix(in_srgb,var(--tc-text-muted)_70%,transparent)] disabled:cursor-not-allowed disabled:opacity-70 dark:text-white dark:placeholder:text-white/34"
                  />

                  <div className="flex flex-col gap-3 border-t border-black/8 pt-3 dark:border-white/8 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-xs leading-5 text-(--tc-text-muted) dark:text-white/54">
                      Enter envia, Shift+Enter quebra linha. Arraste qualquer contexto da plataforma para dentro desta área.
                    </div>
                    <div className="flex items-center gap-3">
                      {sending ? (
                        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-(--tc-text-muted) dark:text-white/48">
                          Enviando...
                        </span>
                      ) : null}
                      <button
                        type="submit"
                        disabled={!selectedPeerId || (!message.trim() && draftAttachments.length === 0) || sending}
                        className="inline-flex items-center gap-2 rounded-full bg-(--tc-accent,#ef0001) px-5 py-3 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <FiSend size={14} />
                        Enviar mensagem
                      </button>
                    </div>
                  </div>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  aria-label="Anexar arquivos à conversa"
                  title="Anexar arquivos"
                  className="hidden"
                  onChange={handleFileInputChange}
                />
              </form>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
