"use client";

import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import {
  FiChevronRight,
  FiImage,
  FiPaperclip,
  FiMic,
  FiStopCircle,
  FiInbox,
  FiMessageSquare,
  FiRefreshCw,
  FiSearch,
  FiSend,
  FiSmile,
  FiUsers,
  FiX,
  FiZap,
} from "react-icons/fi";

import UserAvatar from "@/components/UserAvatar";
import { useAuthUser } from "@/hooks/useAuthUser";
import { useClientContext } from "@/context/ClientContext";
import { fetchApi } from "@/backend/api";
import { resolveActiveIdentity } from "@/backend/activeIdentity";

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

type ChatAttachment = {
  id?: string;
  kind: "file" | "link" | "note" | "system";
  label: string;
  url: string | null;
  mimeType: string | null;
  sizeLabel: string | null;
  sourceLabel: string | null;
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

type ChatAsset = {
  id: string;
  label: string;
  preview: string;
  kind: "emoji" | "gif";
  url?: string;
  keywords: string;
};

const CHAT_ASSETS: ChatAsset[] = [
  { id: "emoji-ok", label: "Aprovado", preview: "âœ…", kind: "emoji", keywords: "ok aprovado feito sucesso" },
  { id: "emoji-bug", label: "Bug", preview: "ðŸž", kind: "emoji", keywords: "bug defeito problema" },
  { id: "emoji-fire", label: "Urgente", preview: "ðŸ”¥", kind: "emoji", keywords: "urgente prioridade fogo" },
  { id: "emoji-eye", label: "Estou olhando", preview: "ðŸ‘€", kind: "emoji", keywords: "olhando revisar conferir" },
  { id: "emoji-thanks", label: "Valeu", preview: "ðŸ™Œ", kind: "emoji", keywords: "obrigado valeu thanks" },
  { id: "gif-cat-typing", label: "Cat typing", preview: "ðŸ±", kind: "gif", url: "https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif", keywords: "gato digitando meme trabalho" },
  { id: "gif-done", label: "Done", preview: "ðŸ", kind: "gif", url: "https://media.giphy.com/media/26u4lOMA8JKSnL9Uk/giphy.gif", keywords: "feito done sucesso" },
  { id: "gif-celebration", label: "Celebration", preview: "ðŸŽ‰", kind: "gif", url: "https://media.giphy.com/media/5GoVLqeAOo6PK/giphy.gif", keywords: "celebracao sucesso aprovado" },
  { id: "gif-thinking", label: "Thinking", preview: "ðŸ¤”", kind: "gif", url: "https://media.giphy.com/media/10zxDv7Hv5RF9C/giphy.gif", keywords: "pensando analise" },
  { id: "gif-brain", label: "Brain loading", preview: "ðŸ§ ", kind: "gif", url: "https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/giphy.gif", keywords: "pensando carregando brain" },
];

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
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(date);
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

function getContactRoleLabel(contact: ChatContact) {
  const value = (contact.profile_kind ?? contact.permission_role ?? "").toLowerCase();
  if (value === "leader_tc") return "Lider TC";
  if (value === "technical_support") return "Administrador";
  if (value === "empresa") return "Empresa";
  if (value === "company_user") return "Usuario da empresa";
  if (value === "testing_company_user") return "Usuario TC";
  return contact.origin_label ?? "Contato";
}

function getContactSubtitle(contact: ChatContact) {
  const parts = [contact.user ? `@${contact.user}` : "", contact.email, contact.job_title ?? ""].filter(Boolean);
  return parts.join(" | ");
}

function getCompanySummary(contact: ChatContact) {
  const names = contact.company_names.filter(Boolean);
  if (!names.length) return contact.company_name ?? null;
  if (names.length === 1) return names[0];
  return `${names[0]} +${names.length - 1}`;
}

function getScopeLabel(roleKind: "global" | "leader_tc" | "empresa" | "usuario") {
  return roleKind === "global" || roleKind === "leader_tc" ? "Visao global" : "Empresas vinculadas";
}

function getScopeNote(roleKind: "global" | "leader_tc" | "empresa" | "usuario") {
  return roleKind === "global" || roleKind === "leader_tc"
    ? "Voce ve os contatos internos e os usuarios das empresas permitidas pelo seu perfil."
    : "Voce ve apenas pessoas das empresas vinculadas ao seu acesso.";
}

function Chip({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "accent" | "soft" }) {
  const className =
    tone === "accent"
      ? "border-[rgba(239,0,1,0.22)] bg-[rgba(239,0,1,0.08)] text-[var(--tc-accent)]"
      : tone === "soft"
        ? "border-[var(--tc-border)] bg-[var(--tc-surface-2)] text-[var(--tc-text-primary)]"
        : "border-[var(--tc-border)] bg-[var(--tc-surface)] text-[var(--tc-text-muted)]";

  return (
    <span className={`inline-flex max-w-full items-center rounded-full border px-3 py-1 text-[11px] font-semibold ${className}`}>
      <span className="truncate">{children}</span>
    </span>
  );
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
      className={`group flex w-full items-center gap-3 border-b border-[var(--tc-border)] px-3 py-3 text-left transition last:border-b-0 ${
        active
          ? "bg-[linear-gradient(135deg,rgba(1,24,72,0.08),rgba(239,0,1,0.08))]"
          : "hover:bg-[var(--tc-surface-2)]"
      }`}
    >
      <UserAvatar src={contact.avatar_url} name={contact.name} size="sm" className="shrink-0" frameClassName="border border-[var(--tc-border)]" />

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold leading-5 text-[var(--tc-text-primary)]">{contact.name}</div>
            <div className="truncate text-xs leading-5 text-[var(--tc-text-muted)]">{getContactSubtitle(contact)}</div>
          </div>
          {recent ? <span className="rounded-full bg-[rgba(239,0,1,0.1)] px-2 py-1 text-[10px] font-bold text-[var(--tc-accent)]">recente</span> : null}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Chip tone={active ? "accent" : "neutral"}>{getContactRoleLabel(contact)}</Chip>
          {getCompanySummary(contact) ? <Chip tone="neutral">{getCompanySummary(contact) ?? ""}</Chip> : null}
        </div>
      </div>

      <FiChevronRight className="shrink-0 text-[var(--tc-text-muted)] group-hover:text-[var(--tc-text-primary)]" size={16} />
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
  const senderLabel = summary.lastSenderId === currentUserId ? "Voce" : summary.lastSenderName;

  return (
    <button
      type="button"
      onClick={() => onSelect(summary.peerId)}
      className={`group flex w-full items-center gap-3 border-b border-[var(--tc-border)] px-3 py-3 text-left transition last:border-b-0 ${
        active
          ? "bg-[linear-gradient(135deg,rgba(1,24,72,0.08),rgba(239,0,1,0.08))]"
          : "hover:bg-[var(--tc-surface-2)]"
      }`}
    >
      <UserAvatar src={contact?.avatar_url ?? summary.peerAvatarUrl} name={contact?.name ?? summary.peerName} size="sm" className="shrink-0" frameClassName="border border-[var(--tc-border)]" />

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold leading-5 text-[var(--tc-text-primary)]">{contact?.name ?? summary.peerName}</div>
            <div className="truncate text-xs leading-5 text-[var(--tc-text-muted)]">{summary.messageCount} mensagem{summary.messageCount === 1 ? "" : "s"}</div>
          </div>
          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--tc-text-muted)]">{formatRelative(summary.lastMessageAt)}</span>
        </div>

        <div className="mt-2 truncate text-xs leading-5 text-[var(--tc-text-muted)]">
          <span className="font-semibold text-[var(--tc-text-primary)]">{senderLabel}:</span> {summary.lastMessage}
        </div>
      </div>
    </button>
  );
}

function AttachmentPreview({ attachment }: { attachment: ChatAttachment }) {
  const isGif = attachment.sourceLabel === "GIF" || attachment.mimeType === "image/gif" || attachment.url?.includes("giphy.com");
  const isSticker = attachment.sourceLabel === "Figurinha";
  const isAudio = attachment.sourceLabel === "Áudio" || attachment.mimeType?.startsWith("audio/");

  if (isGif && attachment.url) {
    return (
      <a href={attachment.url} target="_blank" rel="noreferrer" className="mt-3 block overflow-hidden rounded-[22px] border border-white/20 bg-black/10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={attachment.url} alt={attachment.label} className="max-h-52 w-full object-cover" loading="lazy" />
        <span className="block px-3 py-2 text-xs font-semibold text-current opacity-80">GIF: {attachment.label}</span>
      </a>
    );
  }

  if (isSticker) {
    return (
      <div className="mt-3 inline-flex items-center gap-2 rounded-2xl border border-[var(--tc-border)] bg-[var(--tc-surface-2)] px-4 py-3 text-3xl">
        <span>{attachment.label}</span>
      </div>
    );
  }

  if (isAudio && attachment.url) {
    return (
      <div className="mt-3 rounded-2xl border border-[var(--tc-border)] bg-[var(--tc-surface-2)] px-4 py-3">
        <div className="mb-2 text-xs font-semibold text-[var(--tc-text-muted)]">Áudio: {attachment.label}</div>
        <audio controls src={attachment.url} className="w-full" />
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-2xl border border-[var(--tc-border)] bg-[var(--tc-surface-2)] px-4 py-3 text-xs font-semibold text-[var(--tc-text-muted)]">
      {attachment.sourceLabel ?? "Anexo"}: {attachment.label}
    </div>
  );
}

function MessageBubble({
  message,
  mine,
  avatarSrc,
  avatarName,
}: {
  message: ChatMessage;
  mine: boolean;
  avatarSrc: string | null;
  avatarName: string;
}) {
  const attachments = message.attachments ?? [];
  return (
    <div className={`flex items-end gap-3 ${mine ? "justify-end" : "justify-start"}`}>
      {!mine ? <UserAvatar src={avatarSrc} name={avatarName} size="sm" className="shrink-0" frameClassName="border border-[var(--tc-border)]" /> : null}

      <div
        className={`max-w-[min(42rem,84%)] rounded-[26px] border px-4 py-3 shadow-[0_12px_28px_rgba(15,23,42,0.08)] ${
          mine
            ? "border-[rgba(1,24,72,0.3)] bg-[linear-gradient(135deg,#011848_0%,#0b2b66_100%)] text-white"
            : "border-[var(--tc-border)] bg-[var(--tc-surface)] text-[var(--tc-text-primary)]"
        }`}
      >
        <div className={`flex items-center justify-between gap-3 text-xs font-semibold ${mine ? "text-white/74" : "text-[var(--tc-text-muted)]"}`}>
          <span className="truncate">{mine ? "Voce" : message.senderName}</span>
          <span className="shrink-0">{formatClock(message.createdAt)}</span>
        </div>
        {message.text ? <p className={`mt-2 whitespace-pre-wrap text-sm leading-6 ${mine ? "text-white" : "text-[var(--tc-text-primary)]"}`}>{message.text}</p> : null}
        {attachments.map((attachment) => <AttachmentPreview key={attachment.id ?? `${attachment.label}-${attachment.url}`} attachment={attachment} />)}
      </div>

      {mine ? <UserAvatar src={avatarSrc} name={avatarName} size="sm" className="shrink-0" frameClassName="border border-[var(--tc-border)]" /> : null}
    </div>
  );
}

function SectionHeader({ icon, title, count, action }: { icon: ReactNode; title: string; count?: number; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--tc-border)] px-4 py-3">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--tc-text-muted)]">
        {icon}
        {title}
        {typeof count === "number" ? <span className="tracking-normal text-[var(--tc-text-muted)]">({count})</span> : null}
      </div>
      {action}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,var(--page-bg)_0%,var(--page-grad-2)_100%)] px-4 py-5 text-[var(--tc-text-primary)] sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <div className="h-[calc(100vh-7rem)] animate-pulse rounded-[30px] border border-[var(--tc-border)] bg-[var(--tc-surface)]" />
      </div>
    </div>
  );
}

function buildAttachmentFromAsset(asset: ChatAsset): ChatAttachment {
  if (asset.kind === "gif") {
    return {
      kind: "link",
      label: asset.label,
      url: asset.url ?? null,
      mimeType: "image/gif",
      sizeLabel: null,
      sourceLabel: "GIF",
    };
  }

  return {
    kind: "note",
    label: asset.preview,
    url: null,
    mimeType: null,
    sizeLabel: null,
    sourceLabel: "Figurinha",
  };
}

function findCommandContact(command: string, contacts: ChatContact[]) {
  const normalizedCommand = normalizeSearch(command);
  return contacts.find((contact) => {
    const names = [contact.name, contact.user, contact.email]
      .filter(Boolean)
      .map((value) => normalizeSearch(value));
    return names.some((name) => name && normalizedCommand.includes(name.split(" ")[0]) || normalizedCommand.includes(name));
  }) ?? null;
}

function extractCommandMessage(command: string, contact: ChatContact | null) {
  const raw = command.trim();
  const patterns = [
    /(?:diz|diga|fala|fale)\s+(?:pra|para)\s+(?:ela|ele|[\w.\-@]+)\s+(?:que\s+)?(.+)/i,
    /(?:avisa|avise|manda|mande|envia|envie)\s+.+?\s+(?:que|:)\s+(.+)/i,
    /:\s*(.+)$/i,
  ];

  for (const pattern of patterns) {
    const match = raw.match(pattern);
    if (match?.[1]?.trim()) return match[1].trim();
  }

  if (!contact) return raw;
  const normalizedName = normalizeSearch(contact.name).split(" ")[0];
  const words = raw.split(/\s+/);
  const index = words.findIndex((word) => normalizeSearch(word).includes(normalizedName));
  if (index >= 0 && words[index + 1]) return words.slice(index + 1).join(" ").replace(/^(de|que|e|para|pra)\s+/i, "").trim();
  return raw;
}

export default function ChatWorkspace() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isChatRoute = pathname === "/chat" || pathname.startsWith("/chat/");
  const { user, loading } = useAuthUser();
  const { activeClient } = useClientContext();
  const activeIdentity = resolveActiveIdentity({ user, activeCompany: activeClient });
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const contactsAbortRef = useRef<AbortController | null>(null);
  const threadsAbortRef = useRef<AbortController | null>(null);
  const messagesAbortRef = useRef<AbortController | null>(null);

  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [threads, setThreads] = useState<ChatThreadSummary[]>([]);
  const [selectedPeerId, setSelectedPeerId] = useState<string | null>(() => searchParams.get("peer")?.trim() || null);
  const [search, setSearch] = useState("");
  const [assetSearch, setAssetSearch] = useState("");
  const [assistantCommand, setAssistantCommand] = useState("");
  const [message, setMessage] = useState("");
  const [composerPanelOpen, setComposerPanelOpen] = useState(false);
  const [composerTab, setComposerTab] = useState<"stickers" | "gifs">("stickers");
  const [pendingAttachments, setPendingAttachments] = useState<ChatAttachment[]>([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [recordingAudio, setRecordingAudio] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [threadsLoading, setThreadsLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [commandSending, setCommandSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [threadError, setThreadError] = useState<string | null>(null);

  useEffect(() => {
    if (!isChatRoute) return;
    if (!loading && !user) router.replace("/login");
  }, [isChatRoute, loading, router, user]);

  useEffect(() => {
    return () => {
      contactsAbortRef.current?.abort();
      threadsAbortRef.current?.abort();
      messagesAbortRef.current?.abort();
    };
  }, []);

  const loadContacts = useCallback(async () => {
    contactsAbortRef.current?.abort();
    const controller = new AbortController();
    contactsAbortRef.current = controller;

    setContactsLoading(true);
    setError(null);
    try {
      const response = await fetchApi("/api/chat/contacts", { signal: controller.signal, cache: "no-store" });
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
      const response = await fetchApi("/api/chat/messages", { signal: controller.signal, cache: "no-store" });
      if (response.status === 401) {
        router.replace("/login");
        return;
      }
      const payload = (await response.json().catch(() => ({ threads: [] }))) as { threads?: ChatThreadSummary[]; error?: string };
      setThreads(response.ok && Array.isArray(payload.threads) ? payload.threads : []);
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
        const response = await fetchApi(`/api/chat/messages?peerId=${encodeURIComponent(peerId)}`, { signal: controller.signal, cache: "no-store" });
        if (response.status === 401) {
          router.replace("/login");
          return;
        }
        const payload = (await response.json().catch(() => ({ messages: [] }))) as { messages?: ChatMessage[]; error?: string };
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
    if (!isChatRoute) return;
    void loadContacts();
    void loadThreads();
  }, [isChatRoute, loadContacts, loadThreads]);

  useEffect(() => {
    if (!isChatRoute) return;
    const peerId = searchParams.get("peer")?.trim() || null;
    if (peerId !== selectedPeerId) setSelectedPeerId(peerId);
  }, [isChatRoute, searchParams, selectedPeerId]);

  useEffect(() => {
    if (!isChatRoute) return;
    void loadMessages(selectedPeerId);
  }, [isChatRoute, loadMessages, selectedPeerId]);

  useEffect(() => {
    setMessage("");
    setPendingAttachments([]);
    setComposerPanelOpen(false);
  }, [selectedPeerId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const contactsById = useMemo(() => new Map(contacts.map((contact) => [contact.id, contact])), [contacts]);
  const threadByPeerId = useMemo(() => new Map(threads.map((thread) => [thread.peerId, thread])), [threads]);
  const selectedContact = selectedPeerId ? contactsById.get(selectedPeerId) ?? null : null;
  const selectedThreadSummary = selectedPeerId ? threadByPeerId.get(selectedPeerId) ?? null : null;

  const filteredContacts = useMemo(() => {
    const term = normalizeSearch(search);
    if (!term) return contacts;
    return contacts.filter((contact) => {
      const haystack = normalizeSearch([
        contact.name,
        contact.email,
        contact.user,
        contact.company_name,
        ...(contact.company_names ?? []),
        contact.permission_role ?? "",
        contact.profile_kind ?? "",
        contact.job_title ?? "",
        contact.origin_label ?? "",
      ].filter(Boolean).join(" "));
      return haystack.includes(term);
    });
  }, [contacts, search]);

  const filteredAssets = useMemo(() => {
    const term = normalizeSearch(assetSearch);
    if (!term) return CHAT_ASSETS;
    return CHAT_ASSETS.filter((asset) => normalizeSearch(`${asset.label} ${asset.keywords}`).includes(term));
  }, [assetSearch]);

  const recentContactIds = useMemo(() => new Set(threads.map((thread) => thread.peerId)), [threads]);
  const recentThreads = useMemo(() => threads.slice(0, 5), [threads]);
  const currentUserId = user?.id ?? "";
  const scopeLabel = getScopeLabel(activeIdentity.roleKind);
  const scopeNote = getScopeNote(activeIdentity.roleKind);
  const visibleContactsCount = filteredContacts.length;
  const activeContactsCount = contacts.filter((contact) => contact.active).length;

  const openConversation = useCallback(
    (peerId: string) => {
      setSelectedPeerId(peerId);
      setThreadError(null);
      const params = new URLSearchParams(searchParams.toString());
      params.set("peer", peerId);
      router.replace(params.toString() ? `/chat?${params.toString()}` : "/chat", { scroll: false });
    },
    [router, searchParams],
  );

  const clearConversation = useCallback(() => {
    setSelectedPeerId(null);
    setThreadError(null);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("peer");
    router.replace(params.toString() ? `/chat?${params.toString()}` : "/chat", { scroll: false });
    window.setTimeout(() => searchInputRef.current?.focus(), 0);
  }, [router, searchParams]);

  const handleSearchKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      const firstMatch = filteredContacts[0];
      if (firstMatch) openConversation(firstMatch.id);
    },
    [filteredContacts, openConversation],
  );

  const sendToPeer = useCallback(
    async (peerId: string, text: string, attachments: ChatAttachment[] = []) => {
      if ((!text.trim() && attachments.length === 0) || sending) return false;
      setSending(true);
      setThreadError(null);
      try {
        const response = await fetchApi("/api/chat/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ peerId, text: text.trim(), attachments }),
        });
        if (response.status === 401) {
          router.replace("/login");
          return false;
        }
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        if (!response.ok) {
          setThreadError(payload.error || "Nao foi possivel enviar a mensagem.");
          return false;
        }

        openConversation(peerId);
        await Promise.all([loadMessages(peerId), loadThreads()]);
        return true;
      } catch (err) {
        setThreadError(err instanceof Error ? err.message : "Nao foi possivel enviar a mensagem.");
        return false;
      } finally {
        setSending(false);
      }
    },
    [loadMessages, loadThreads, openConversation, router, sending],
  );


  const uploadChatFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileList = Array.from(files);
      if (!fileList.length || uploadingAttachment) return;

      setUploadingAttachment(true);
      setThreadError(null);

      try {
        const formData = new FormData();
        fileList.forEach((file) => formData.append("files", file));

        const response = await fetchApi("/api/chat/attachments", {
          method: "POST",
          body: formData,
        });

        if (response.status === 401) {
          router.replace("/login");
          return;
        }

        const payload = (await response.json().catch(() => ({}))) as {
          attachments?: ChatAttachment[];
          error?: string;
        };

        if (!response.ok || !Array.isArray(payload.attachments)) {
          setThreadError(payload.error || "Não foi possível anexar o arquivo.");
          return;
        }

        setPendingAttachments((current) => [...current, ...payload.attachments!]);
      } catch (err) {
        setThreadError(err instanceof Error ? err.message : "Não foi possível anexar o arquivo.");
      } finally {
        setUploadingAttachment(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [router, uploadingAttachment],
  );

  const addAssetToComposer = useCallback((asset: ChatAsset) => {
    setPendingAttachments((current) => [...current, buildAttachmentFromAsset(asset)]);
    setComposerPanelOpen(false);
  }, []);

  const removePendingAttachment = useCallback((index: number) => {
    setPendingAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }, []);

  const startAudioRecording = useCallback(async () => {
    if (recordingAudio) return;

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setThreadError("Gravação de áudio não está disponível neste navegador.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        const file = new File([blob], `audio-${Date.now()}.webm`, { type: blob.type || "audio/webm" });
        stream.getTracks().forEach((track) => track.stop());
        setRecordingAudio(false);
        void uploadChatFiles([file]);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecordingAudio(true);
    } catch {
      setThreadError("Não foi possível acessar o microfone.");
      setRecordingAudio(false);
    }
  }, [recordingAudio, uploadChatFiles]);

  const stopAudioRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      setRecordingAudio(false);
      return;
    }

    recorder.stop();
  }, []);

  const sendMessage = useCallback(
    async (event?: FormEvent<HTMLFormElement>) => {
      event?.preventDefault();
      if (!selectedPeerId || sending) return;

      const text = message.trim();
      if (!text && pendingAttachments.length === 0) return;

      const ok = await sendToPeer(selectedPeerId, text, pendingAttachments);
      if (ok) {
        setMessage("");
        setPendingAttachments([]);
        setComposerPanelOpen(false);
      }
    },
    [message, pendingAttachments, selectedPeerId, sendToPeer, sending],
  );

  const sendAsset = useCallback(
    async (asset: ChatAsset) => {
      if (!selectedPeerId) return;
      addAssetToComposer(asset);
      setAssetSearch("");
    },
    [addAssetToComposer, selectedPeerId],
  );

  const runAssistantCommand = useCallback(async () => {
    const command = assistantCommand.trim();
    if (!command || commandSending) return;
    const contact = findCommandContact(command, contacts);
    if (!contact) {
      setThreadError("Nao encontrei a pessoa no escopo do seu perfil. Tente escrever o nome como aparece na lista de contatos.");
      return;
    }
    const text = extractCommandMessage(command, contact);
    if (!text) {
      setThreadError("Encontrei o contato, mas nao entendi a mensagem que devo enviar.");
      return;
    }

    setCommandSending(true);
    const ok = await sendToPeer(contact.id, text);
    setCommandSending(false);
    if (ok) {
      setAssistantCommand("");
      setSearch("");
    }
  }, [assistantCommand, commandSending, contacts, sendToPeer]);

  const selectedPeerAvatar = selectedContact?.avatar_url ?? selectedThreadSummary?.peerAvatarUrl ?? null;
  const selectedPeerName = selectedContact?.name ?? selectedThreadSummary?.peerName ?? "Escolha uma conversa";
  const selectedPeerHandle = selectedContact?.user ? `@${selectedContact.user}` : selectedThreadSummary?.peerHandle ? `@${selectedThreadSummary.peerHandle}` : null;
  const selectedPeerCompany = selectedContact ? getCompanySummary(selectedContact) : null;
  const selectedThreadPreview = selectedThreadSummary
    ? `${selectedThreadSummary.lastSenderId === currentUserId ? "Voce" : selectedThreadSummary.lastSenderName}: ${selectedThreadSummary.lastMessage}`
    : "";
  const canSeeAllContacts = activeIdentity.roleKind === "global" || activeIdentity.roleKind === "leader_tc";

  if (!isChatRoute) return null;
  if (loading && !user) return <LoadingSkeleton />;
  if (!user) return null;

  return (
    <div className="qc-chat-workspace min-h-screen bg-[linear-gradient(180deg,var(--page-bg)_0%,var(--tc-bg)_100%)] px-3 py-4 text-[var(--tc-text-primary)] sm:px-5 lg:px-6">
      <div className="mx-auto flex max-w-[1500px] flex-col gap-4">
        <header className="flex flex-col gap-4 rounded-[28px] border border-[var(--tc-border)] bg-[var(--tc-surface)]/95 px-4 py-4 shadow-[0_18px_44px_rgba(15,23,42,0.07)] sm:px-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[var(--tc-border)] bg-[var(--tc-surface-2)]">
              <Image src="/images/tc.png" alt="Quality Control" width={48} height={48} className="h-10 w-10 object-contain" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-[var(--tc-text-muted)]">Chat operacional</p>
              <h1 className="mt-1 truncate text-2xl font-black tracking-[-0.05em] text-[var(--tc-text-primary)] sm:text-3xl">Conversas da equipe</h1>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--tc-text-muted)]">{scopeNote}</p>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[440px]">
            <div className="rounded-2xl border border-[var(--tc-border)] bg-[var(--tc-surface-2)] px-4 py-3">
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--tc-text-muted)]">Contatos</div>
              <div className="mt-1 text-xl font-black text-[var(--tc-text-primary)]">{contactsLoading ? "..." : contacts.length}</div>
            </div>
            <div className="rounded-2xl border border-[var(--tc-border)] bg-[var(--tc-surface-2)] px-4 py-3">
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--tc-text-muted)]">Ativos</div>
              <div className="mt-1 text-xl font-black text-[var(--tc-text-primary)]">{activeContactsCount}</div>
            </div>
            <div className="rounded-2xl border border-[rgba(239,0,1,0.22)] bg-[rgba(239,0,1,0.08)] px-4 py-3">
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--tc-text-muted)]">Escopo</div>
              <div className="mt-1 truncate text-sm font-black text-[var(--tc-text-primary)]">{scopeLabel}</div>
            </div>
          </div>
        </header>

        <section className="grid min-h-[calc(100vh-12.5rem)] overflow-hidden rounded-[30px] border border-[var(--tc-border)] bg-[var(--tc-surface)] shadow-[0_22px_58px_rgba(15,23,42,0.09)] xl:grid-cols-[390px_minmax(0,1fr)]">
          <aside className="flex min-h-0 flex-col border-b border-[var(--tc-border)] bg-[var(--tc-surface-2)] xl:border-b-0 xl:border-r">
            <div className="border-b border-[var(--tc-border)] p-4">
              <div className="flex items-center gap-3">
                <UserAvatar src={activeIdentity.avatarUrl} name={activeIdentity.displayName} size="md" className="shrink-0" frameClassName="border border-[var(--tc-border)]" />
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-[var(--tc-text-primary)]">{activeIdentity.displayName}</div>
                  <div className="truncate text-xs text-[var(--tc-text-muted)]">{activeIdentity.username ? `@${activeIdentity.username}` : activeIdentity.email ?? "Conta autenticada"}</div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Chip tone={canSeeAllContacts ? "accent" : "neutral"}>{scopeLabel}</Chip>
                {activeIdentity.companyTagLabel ? <Chip tone="neutral">{activeIdentity.companyTagLabel}</Chip> : null}
              </div>
            </div>

            <div className="border-b border-[var(--tc-border)] p-4">
              <label className="flex flex-col gap-2 text-sm text-[var(--tc-text-primary)]">
                <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--tc-text-muted)]">Buscar pessoa</span>
                <div className="relative">
                  <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--tc-text-muted)]" size={15} />
                  <input
                    ref={searchInputRef}
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    placeholder="Nome, usuario, empresa ou perfil"
                    className="w-full rounded-[18px] border border-[var(--tc-border)] bg-[var(--tc-input-bg,#eef4ff)] py-3 pl-10 pr-3 text-sm text-[var(--tc-text-primary)] outline-none transition placeholder:text-[var(--tc-text-muted)] focus:border-[var(--tc-accent)] focus:ring-2 focus:ring-[rgba(239,0,1,0.12)]"
                  />
                </div>
              </label>
            </div>

            {error ? <div className="m-4 rounded-[18px] border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-200">{error}</div> : null}

            <div className="min-h-0 flex-1 overflow-y-auto">
              <SectionHeader
                icon={<FiInbox size={14} />}
                title="Recentes"
                count={recentThreads.length}
                action={
                  <button type="button" onClick={() => void loadThreads()} className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--tc-text-muted)] hover:text-[var(--tc-text-primary)]">
                    {threadsLoading ? "Atualizando" : "Atualizar"}
                  </button>
                }
              />
              {recentThreads.length > 0 ? recentThreads.map((summary) => {
                const contact = contactsById.get(summary.peerId) ?? null;
                return <ThreadRow key={summary.key} summary={summary} contact={contact} active={summary.peerId === selectedPeerId} currentUserId={currentUserId} onSelect={openConversation} />;
              }) : (
                <div className="px-4 py-5 text-sm text-[var(--tc-text-muted)]">Ainda nao ha conversas recentes.</div>
              )}

              <SectionHeader icon={<FiUsers size={14} />} title="Pessoas" count={visibleContactsCount} />
              {contactsLoading ? (
                <div className="px-4 py-5 text-sm text-[var(--tc-text-muted)]">Carregando contatos...</div>
              ) : filteredContacts.length > 0 ? filteredContacts.map((contact) => (
                <ContactRow key={contact.id} contact={contact} active={contact.id === selectedPeerId} recent={recentContactIds.has(contact.id)} onSelect={openConversation} />
              )) : (
                <div className="px-4 py-5 text-sm text-[var(--tc-text-muted)]">{search.trim() ? `Nenhum usuario encontrado para "${search.trim()}".` : "Digite um nome para iniciar uma conversa."}</div>
              )}
            </div>
          </aside>

          <main className="flex min-h-0 min-w-0 flex-col bg-[linear-gradient(180deg,var(--tc-surface)_0%,var(--tc-surface-2)_100%)]">
            <div className="flex flex-col gap-4 border-b border-[var(--tc-border)] bg-[var(--tc-surface)]/95 px-4 py-4 sm:px-5 md:flex-row md:items-center md:justify-between">
              <div className="flex min-w-0 items-center gap-4">
                <UserAvatar src={selectedPeerAvatar} name={selectedPeerName} size="lg" className="shrink-0" frameClassName="border border-[var(--tc-border)]" />
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--tc-text-muted)]">Conversa atual</p>
                  <h2 className="mt-1 truncate text-2xl font-black tracking-[-0.04em] text-[var(--tc-text-primary)]">{selectedPeerName}</h2>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-[var(--tc-text-muted)]">
                    {selectedPeerHandle ? <span>{selectedPeerHandle}</span> : null}
                    {selectedPeerCompany ? <span>| {selectedPeerCompany}</span> : null}
                    {selectedThreadSummary ? <span>| {selectedThreadSummary.messageCount} mensagens</span> : null}
                  </div>
                  <p className="mt-2 max-w-2xl truncate text-xs leading-5 text-[var(--tc-text-muted)]">{selectedThreadPreview || "Sem mensagens nesta conversa ainda. Envie a primeira mensagem."}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={clearConversation} className="inline-flex items-center gap-2 rounded-full border border-[var(--tc-border)] bg-[var(--tc-surface-2)] px-4 py-2 text-sm font-semibold text-[var(--tc-text-primary)] transition hover:border-[rgba(239,0,1,0.18)] hover:bg-[var(--tc-surface)]">
                  <FiX size={14} /> Trocar pessoa
                </button>
                <button type="button" onClick={() => void loadMessages(selectedPeerId)} disabled={!selectedPeerId} className="inline-flex items-center gap-2 rounded-full border border-[var(--tc-border)] bg-[var(--tc-surface-2)] px-4 py-2 text-sm font-semibold text-[var(--tc-text-primary)] transition hover:border-[rgba(239,0,1,0.18)] hover:bg-[var(--tc-surface)] disabled:cursor-not-allowed disabled:opacity-60">
                  <FiRefreshCw size={14} className={messagesLoading ? "animate-spin" : ""} /> Atualizar
                </button>
              </div>
            </div>

            <div className="border-b border-[var(--tc-border)] bg-[var(--tc-surface-2)] px-4 py-3 sm:px-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--tc-text-muted)]">
                  <FiZap size={14} /> Comando rapido
                </div>
                <div className="flex min-w-0 flex-1 gap-2">
                  <input
                    value={assistantCommand}
                    onChange={(event) => setAssistantCommand(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void runAssistantCommand();
                      }
                    }}
                    placeholder="Ex.: Chat, chama a Barbara e diz pra ela revisar o chamado 123"
                    className="min-w-0 flex-1 rounded-full border border-[var(--tc-border)] bg-[var(--tc-input-bg,#eef4ff)] px-4 py-2.5 text-sm text-[var(--tc-text-primary)] outline-none placeholder:text-[var(--tc-text-muted)] focus:border-[var(--tc-accent)] focus:ring-2 focus:ring-[rgba(239,0,1,0.12)]"
                  />
                  <button type="button" onClick={() => void runAssistantCommand()} disabled={!assistantCommand.trim() || commandSending} className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[var(--tc-accent)] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
                    <FiSend size={14} /> Mandar
                  </button>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-5">
              {threadError ? <div className="mb-4 rounded-[20px] border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-200">{threadError}</div> : null}

              {selectedPeerId ? (
                <div className="space-y-4">
                  {messagesLoading && messages.length === 0 ? (
                    <div className="space-y-3">
                      {Array.from({ length: 3 }).map((_, index) => (
                        <div key={index} className={`flex items-end gap-3 ${index % 2 === 0 ? "justify-start" : "justify-end"}`}>
                          <div className="h-10 w-10 animate-pulse rounded-full bg-[var(--tc-surface)]" />
                          <div className="h-20 w-[min(28rem,70%)] animate-pulse rounded-[26px] bg-[var(--tc-surface)]" />
                        </div>
                      ))}
                    </div>
                  ) : messages.length > 0 ? messages.map((item) => {
                    const isMine = item.senderId === currentUserId;
                    const bubbleAvatar = isMine ? activeIdentity.avatarUrl : selectedPeerAvatar;
                    const bubbleName = isMine ? activeIdentity.displayName : selectedPeerName;
                    return <MessageBubble key={item.id} message={item} mine={isMine} avatarSrc={bubbleAvatar} avatarName={bubbleName} />;
                  }) : (
                    <div className="flex min-h-96 flex-col items-center justify-center rounded-[26px] border border-dashed border-[var(--tc-border)] bg-[var(--tc-surface)] px-6 text-center">
                      <div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-[var(--tc-border)] bg-[var(--tc-surface-2)]">
                        <FiInbox size={24} className="text-[var(--tc-text-muted)]" />
                      </div>
                      <h3 className="mt-4 text-xl font-bold text-[var(--tc-text-primary)]">Conversa pronta</h3>
                      <p className="mt-2 max-w-md text-sm leading-6 text-[var(--tc-text-muted)]">Escreva, envie uma figurinha ou use o comando rapido para acionar alguem pelo nome.</p>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              ) : (
                <div className="qc-chat-empty-state flex min-h-120 flex-1 flex-col items-center justify-center rounded-[26px] border border-dashed border-[var(--tc-border)] bg-[var(--tc-surface)] px-6 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-[var(--tc-border)] bg-[var(--tc-surface-2)]">
                    <FiUsers size={24} className="text-[var(--tc-text-muted)]" />
                  </div>
                  <h3 className="mt-4 text-2xl font-black tracking-[-0.04em] text-[var(--tc-text-primary)]">Escolha uma pessoa</h3>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--tc-text-muted)]">A lista respeita o escopo do seu perfil e das empresas que voce pode acessar.</p>
                </div>
              )}
            </div>

            <form onSubmit={sendMessage} className="border-t border-[var(--tc-border)] bg-[var(--tc-surface)] px-4 py-4 sm:px-5">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,text/plain,audio/webm,audio/ogg,audio/mpeg,audio/mp4,audio/wav"
                onChange={(event) => {
                  if (event.target.files) void uploadChatFiles(event.target.files);
                }}
              />

              {composerPanelOpen ? (
                <div className="mb-3 rounded-[28px] border border-[var(--tc-border)] bg-[var(--tc-surface-2)] p-3 shadow-[0_18px_44px_rgba(15,23,42,0.10)]">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-black uppercase tracking-[0.22em] text-[var(--tc-text-muted)]">Biblioteca rápida</div>
                      <div className="text-sm font-semibold text-[var(--tc-text-primary)]">GIFs, figurinhas e reações</div>
                    </div>
                    <button type="button" onClick={() => setComposerPanelOpen(false)} className="rounded-full border border-[var(--tc-border)] p-2 text-[var(--tc-text-muted)] hover:text-[var(--tc-text-primary)]">
                      <FiX size={16} />
                    </button>
                  </div>

                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => setComposerTab("stickers")} className={`rounded-full border px-4 py-2 text-xs font-black transition ${composerTab === "stickers" ? "border-[rgba(239,0,1,0.32)] bg-[rgba(239,0,1,0.10)] text-[var(--tc-accent)]" : "border-[var(--tc-border)] bg-[var(--tc-surface)] text-[var(--tc-text-muted)]"}`}>
                      Figurinhas
                    </button>
                    <button type="button" onClick={() => setComposerTab("gifs")} className={`rounded-full border px-4 py-2 text-xs font-black transition ${composerTab === "gifs" ? "border-[rgba(239,0,1,0.32)] bg-[rgba(239,0,1,0.10)] text-[var(--tc-accent)]" : "border-[var(--tc-border)] bg-[var(--tc-surface)] text-[var(--tc-text-muted)]"}`}>
                      GIFs
                    </button>

                    <label className="relative ml-auto min-w-52 flex-1 sm:max-w-80">
                      <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--tc-text-muted)]" size={13} />
                      <input
                        value={assetSearch}
                        onChange={(event) => setAssetSearch(event.target.value)}
                        placeholder="Buscar reação"
                        className="w-full rounded-full border border-[var(--tc-border)] bg-[var(--tc-input-bg,#eef4ff)] py-2 pl-9 pr-3 text-xs text-[var(--tc-text-primary)] outline-none placeholder:text-[var(--tc-text-muted)] focus:border-[var(--tc-accent)]"
                      />
                    </label>
                  </div>

                  <div className="grid max-h-72 grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3 lg:grid-cols-4">
                    {filteredAssets
                      .filter((asset) => composerTab === "gifs" ? asset.kind === "gif" : asset.kind === "emoji")
                      .map((asset) => (
                        <button
                          key={asset.id}
                          type="button"
                          onClick={() => void sendAsset(asset)}
                          disabled={!selectedPeerId || sending}
                          className="group flex min-h-24 flex-col items-center justify-center gap-2 rounded-3xl border border-[var(--tc-border)] bg-[var(--tc-surface)] px-3 py-3 text-center text-sm font-semibold text-[var(--tc-text-primary)] transition hover:border-[rgba(239,0,1,0.24)] hover:bg-[var(--tc-surface-2)] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <span className="text-3xl transition group-hover:scale-110">{asset.preview}</span>
                          <span className="max-w-full truncate text-xs">{asset.label}</span>
                          {asset.kind === "gif" ? <FiImage size={12} className="text-[var(--tc-text-muted)]" /> : null}
                        </button>
                      ))}
                  </div>
                </div>
              ) : null}

              {pendingAttachments.length ? (
                <div className="mb-3 flex flex-wrap gap-2 rounded-[22px] border border-[var(--tc-border)] bg-[var(--tc-surface-2)] p-3">
                  {pendingAttachments.map((attachment, index) => (
                    <div key={attachment.id ?? `${attachment.label}-${index}`} className="inline-flex max-w-full items-center gap-2 rounded-2xl border border-[var(--tc-border)] bg-[var(--tc-surface)] px-3 py-2 text-xs font-semibold text-[var(--tc-text-primary)]">
                      <span className="truncate">{attachment.sourceLabel ?? "Anexo"}: {attachment.label}</span>
                      <button type="button" onClick={() => removePendingAttachment(index)} className="text-[var(--tc-text-muted)] hover:text-[var(--tc-accent)]">
                        <FiX size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="flex items-end gap-3">
                <UserAvatar src={activeIdentity.avatarUrl} name={activeIdentity.displayName} size="md" className="hidden shrink-0 sm:block" frameClassName="border border-[var(--tc-border)]" />

                <div className="min-w-0 flex-1 rounded-[30px] border border-[var(--tc-border)] bg-[var(--tc-surface-2)] p-2 shadow-[0_12px_32px_rgba(15,23,42,0.08)]">
                  <div className="mb-2 flex items-center justify-between gap-3 px-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-[var(--tc-text-primary)]">{activeIdentity.displayName}</div>
                      <div className="truncate text-xs text-[var(--tc-text-muted)]">{selectedPeerId ? `Escrevendo para ${selectedPeerName}` : "Selecione uma pessoa para enviar mensagem"}</div>
                    </div>
                    {sending || uploadingAttachment ? <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--tc-text-muted)]">{uploadingAttachment ? "Anexando..." : "Enviando..."}</span> : null}
                  </div>

                  <div className="flex items-end gap-2">
                    <div className="flex shrink-0 items-center gap-1 pb-1">
                      <button type="button" disabled={!selectedPeerId || sending} onClick={() => setComposerPanelOpen((value) => !value)} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--tc-border)] bg-[var(--tc-surface)] text-[var(--tc-text-muted)] transition hover:text-[var(--tc-accent)] disabled:opacity-50" title="GIFs e figurinhas">
                        <FiSmile size={17} />
                      </button>
                      <button type="button" disabled={!selectedPeerId || sending || uploadingAttachment} onClick={() => fileInputRef.current?.click()} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--tc-border)] bg-[var(--tc-surface)] text-[var(--tc-text-muted)] transition hover:text-[var(--tc-accent)] disabled:opacity-50" title="Anexar arquivo">
                        <FiPaperclip size={17} />
                      </button>
                      <button type="button" disabled={!selectedPeerId || sending || uploadingAttachment} onClick={() => recordingAudio ? stopAudioRecording() : void startAudioRecording()} className={`inline-flex h-10 w-10 items-center justify-center rounded-full border transition disabled:opacity-50 ${recordingAudio ? "border-[rgba(239,0,1,0.35)] bg-[rgba(239,0,1,0.12)] text-[var(--tc-accent)]" : "border-[var(--tc-border)] bg-[var(--tc-surface)] text-[var(--tc-text-muted)] hover:text-[var(--tc-accent)]"}`} title={recordingAudio ? "Parar áudio" : "Gravar áudio"}>
                        {recordingAudio ? <FiStopCircle size={17} /> : <FiMic size={17} />}
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
                      placeholder={selectedPeerId ? `Mensagem para ${selectedPeerName}...` : "Escolha uma pessoa para começar"}
                      rows={2}
                      disabled={!selectedPeerId || sending}
                      className="min-h-12 flex-1 resize-none rounded-[24px] border border-[var(--tc-border)] bg-[var(--tc-input-bg,#eef4ff)] px-4 py-3 text-sm leading-6 text-[var(--tc-text-primary)] outline-none transition placeholder:text-[var(--tc-text-muted)] focus:border-[var(--tc-accent)] focus:ring-2 focus:ring-[rgba(239,0,1,0.12)] disabled:cursor-not-allowed disabled:opacity-70"
                    />
                  </div>
                </div>

                <button type="submit" disabled={!selectedPeerId || (!message.trim() && pendingAttachments.length === 0) || sending || uploadingAttachment} className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[var(--tc-accent)] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50">
                  <FiSend size={14} /> Enviar
                </button>
              </div>
            </form>
          </main>
        </section>
      </div>
    </div>
  );
}
