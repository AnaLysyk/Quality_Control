"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type FormEvent, type KeyboardEvent, type MouseEvent, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { FiBell, FiCalendar, FiCamera, FiChevronRight, FiFile, FiImage, FiInbox, FiMic, FiPaperclip, FiPauseCircle, FiPlus, FiRefreshCw, FiSearch, FiSend, FiSmile, FiUploadCloud, FiUsers, FiVideo, FiVolume2, FiX, FiStopCircle } from "react-icons/fi";

import UserAvatar from "@/components/UserAvatar";
import { useAuthUser } from "@/hooks/useAuthUser";
import { useClientContext } from "@/context/ClientContext";
import { fetchApi } from "@/lib/api";
import { resolveActiveIdentity } from "@/lib/activeIdentity";

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
  presence_status?: "online" | "busy" | "offline";
  presence_label?: string;
  presence_last_seen_at?: string | null;
  presence_busy_until?: string | null;
  presence_busy_title?: string | null;
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
  senderId: string;
  senderName: string;
  senderAvatarUrl: string | null;
  text: string;
  attachments?: ChatAttachment[];
  createdAt: string;
};

const QUICK_REACTIONS = ["âœ…", "ðŸž", "ðŸ”¥", "ðŸ‘€", "ðŸ™Œ", "âš ï¸", "ðŸŽ‰", "ðŸ¤”"];

const CHAT_MESSAGE_REACTION_OPTIONS = [
  { emoji: "ðŸ‘", label: "Curtir", description: "Curtir essa mensagem" },
  { emoji: "â¤ï¸", label: "Amei", description: "Gostei muito dessa mensagem" },
  { emoji: "âœ…", label: "Resolvido", description: "Essa mensagem resolveu" },
  { emoji: "ðŸ‘€", label: "Visto", description: "Estou acompanhando" },
  { emoji: "ðŸ”¥", label: "Destaque", description: "Mensagem importante" },
  { emoji: "ðŸŽ‰", label: "Celebrar", description: "Comemorar avanÃ§o" },
  { emoji: "ðŸž", label: "Bug", description: "Marcar como ponto tÃ©cnico" },
  { emoji: "âš ï¸", label: "AtenÃ§Ã£o", description: "Precisa de cuidado" },
  { emoji: "ðŸ¤”", label: "Revisar", description: "Precisa revisar" },
  { emoji: "ðŸ™Œ", label: "Aprovado", description: "EstÃ¡ aprovado" },
];
const QUICK_GIFS = [
  { label: "Digitando", url: "https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif" },
  { label: "Feito", url: "https://media.giphy.com/media/26u4lOMA8JKSnL9Uk/giphy.gif" },
  { label: "Celebrando", url: "https://media.giphy.com/media/5GoVLqeAOo6PK/giphy.gif" },
];

const CHAT_UNIFIED_ACTION_OPTIONS = [
  { emoji: "ðŸ‘", label: "Curtir", description: "Curtir ou enviar curtida" },
  { emoji: "â¤ï¸", label: "Amei", description: "ReaÃ§Ã£o positiva" },
  { emoji: "âœ…", label: "Resolvido", description: "Marcar como resolvido" },
  { emoji: "ðŸ‘€", label: "Visto", description: "Estou acompanhando" },
  { emoji: "ðŸ”¥", label: "Destaque", description: "Mensagem importante" },
  { emoji: "ðŸŽ‰", label: "Celebrar", description: "Comemorar avanÃ§o" },
  { emoji: "ðŸž", label: "Bug", description: "Sinalizar problema" },
  { emoji: "âš ï¸", label: "AtenÃ§Ã£o", description: "Marcar risco ou cuidado" },
  { emoji: "ðŸ¤”", label: "Revisar", description: "Pedir revisÃ£o" },
  { emoji: "ðŸ™Œ", label: "Aprovado", description: "Aprovar mensagem" },
];

const CHAT_MESSAGE_EMOJI_OPTIONS = [
  { emoji: "ðŸ‘", label: "Curtir", description: "Enviar curtida na conversa" },
  { emoji: "â¤ï¸", label: "Amei", description: "Enviar reação positiva" },
  { emoji: "âœ…", label: "Feito", description: "Confirmar que foi resolvido" },
  { emoji: "ðŸ‘€", label: "Vendo", description: "Avisar que estÃ¡ acompanhando" },
  { emoji: "ðŸ”¥", label: "Destaque", description: "Marcar algo importante" },
  { emoji: "ðŸŽ‰", label: "Celebrar", description: "Comemorar avanÃ§o" },
  { emoji: "ðŸž", label: "Bug", description: "Sinalizar problema" },
  { emoji: "âš ï¸", label: "AtenÃ§Ã£o", description: "Marcar risco ou cuidado" },
];

const CHAT_REACTION_OPTIONS = [
  { emoji: "ðŸ‘", label: "Curtir", description: "Marcar que vocÃª gostou da conversa" },
  { emoji: "â¤ï¸", label: "Amei", description: "ReaÃ§Ã£o positiva com mais destaque" },
  { emoji: "âœ…", label: "Resolvido", description: "Indicar que ficou certo" },
  { emoji: "ðŸ‘€", label: "Estou vendo", description: "Mostrar que estÃ¡ acompanhando" },
  { emoji: "ðŸ”¥", label: "Muito bom", description: "Dar destaque para algo importante" },
  { emoji: "ðŸŽ‰", label: "Celebrar", description: "Comemorar avanÃ§o ou entrega" },
  { emoji: "ðŸž", label: "Bug", description: "Marcar ponto de atenÃ§Ã£o tÃ©cnico" },
  { emoji: "âš ï¸", label: "AtenÃ§Ã£o", description: "Sinalizar cuidado ou risco" },
  { emoji: "ðŸ¤”", label: "Revisar", description: "Pedir anÃ¡lise com calma" },
  { emoji: "ðŸ™Œ", label: "Aprovado", description: "Confirmar que estÃ¡ bom" },
];

function normalizeSearch(value: string) {
  return value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function formatClock(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(date);
}

function getDefaultMeetingDateTime() {
  const date = new Date();
  date.setMinutes(date.getMinutes() + 30);
  date.setSeconds(0, 0);

  const pad = (value: number) => String(value).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toGoogleCalendarDate(value: Date) {
  return value.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function formatScheduleDate(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(value);
}

function formatRelative(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours}h`;
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(date);
}

function getRoleLabel(contact: ChatContact) {
  const value = (contact.profile_kind ?? contact.permission_role ?? "").toLowerCase();
  if (value === "leader_tc") return "LÃ­der TC";
  if (value === "technical_support") return "Suporte tÃ©cnico";
  if (value === "empresa") return "Empresa";
  if (value === "company_user") return "UsuÃ¡rio empresa";
  if (value === "testing_company_user") return "UsuÃ¡rio TC";
  return contact.origin_label ?? "Contato";
}

function getCompanyLabel(contact: ChatContact) {
  const names = contact.company_names.filter(Boolean);
  if (names.length === 0) return contact.company_name ?? "";
  if (names.length === 1) return names[0];
  return `${names[0]} +${names.length - 1}`;
}

function isImage(attachment: ChatAttachment) {
  return Boolean(attachment.url) && (attachment.mimeType?.startsWith("image/") || attachment.sourceLabel === "GIF");
}

function AttachmentView({ attachment, mine, removable, onRemove }: { attachment: ChatAttachment; mine?: boolean; removable?: boolean; onRemove?: () => void }) {
  if (attachment.sourceLabel === "Figurinha") {
    return <div className="mt-2 text-5xl leading-none">{attachment.label}</div>;
  }

  if ((attachment.mimeType?.startsWith("audio/") || attachment.sourceLabel === "Áudio") && attachment.url) {
    return (
      <div className={`qc-chat-audio-attachment mt-2 rounded-2xl border px-3 py-3 ${mine ? "border-white/15 bg-white/10" : "border-(--tc-border) bg-(--tc-surface-2)"}`}>
        <div className={`mb-2 flex items-center justify-between gap-3 text-xs font-black ${mine ? "text-white/80" : "text-slate-600 dark:text-white/70"}`}>
          <span>Áudio</span>
          {attachment.sizeLabel ? <span>{attachment.sizeLabel}</span> : null}
        </div>
        <audio controls src={attachment.url} className="w-full" preload="metadata" />
      </div>
    );
  }

  if (isImage(attachment) && attachment.url) {
    return (
      <a href={attachment.url} target="_blank" rel="noreferrer" className="mt-2 block max-w-sm overflow-hidden rounded-[22px] border border-white/15 bg-black/10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={attachment.url} alt={attachment.label} className="max-h-72 w-full object-cover" loading="lazy" />
        <span className={`flex items-center justify-between gap-3 px-3 py-2 text-xs font-semibold ${mine ? "text-white/80" : "text-slate-600 dark:text-white/60"}`}>
          <span className="truncate">{attachment.sourceLabel ?? "Imagem"}: {attachment.label}</span>
          <span>Abrir</span>
        </span>
      </a>
    );
  }

  return (
    <div className={`mt-2 flex max-w-md items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-semibold ${mine ? "border-white/15 bg-white/10 text-white" : "border-(--tc-border) bg-(--tc-surface-2) text-(--tc-text-primary)"}`}>
      <FiFile size={15} className="shrink-0" />
      {attachment.url ? <a href={attachment.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate">{attachment.label}</a> : <span className="min-w-0 flex-1 truncate">{attachment.label}</span>}
      {attachment.sizeLabel ? <span className="shrink-0 opacity-60">{attachment.sizeLabel}</span> : null}
      {removable && onRemove ? <button type="button" onClick={onRemove} aria-label={`Remover anexo ${attachment.label}`} title={`Remover anexo ${attachment.label}`} className="rounded-full p-1 opacity-70 hover:bg-black/10"><FiX size={12} /></button> : null}
    </div>
  );
}

function ContactRow({ contact, active, recent, onSelect }: { contact: ChatContact; active: boolean; recent: boolean; onSelect: (id: string) => void }) {
  return (
    <button type="button" onClick={() => onSelect(contact.id)} className={`group flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition ${active ? "bg-white/12 text-white" : "text-white/78 hover:bg-white/8 hover:text-white"}`}>
      <span className="qc-chat-contact-avatar">
        <UserAvatar src={contact.avatar_url} name={contact.name} size="sm" className="shrink-0" frameClassName="border border-white/15" />
        <span
          className={`qc-chat-presence-dot ${contact.presence_status === "busy" ? "is-busy" : contact.presence_status === "online" ? "is-online" : "is-offline"}`}
          title={contact.presence_label ?? "Offline"}
          aria-label={contact.presence_label ?? "Offline"}
        />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2"><span className="truncate text-sm font-bold">{contact.name}</span>{recent ? <span className="h-2 w-2 rounded-full bg-(--tc-accent)" /> : null}</span>
        <span className="block truncate text-[11px] text-white/48">{contact.user ? `@${contact.user}` : contact.email}</span>
        <span className="mt-1 flex flex-wrap gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white/50"><span>{getRoleLabel(contact)}</span>{getCompanyLabel(contact) ? <span>â€¢ {getCompanyLabel(contact)}</span> : null}</span>
      </span>
      <FiChevronRight size={14} className="text-white/32 group-hover:text-white/70" />
    </button>
  );
}

function MessageBubble({
  message,
  mine,
  avatar,
  name,
  reactions,
  onOpenMessageReaction,
}: {
  message: ChatMessage;
  mine: boolean;
  avatar: string | null;
  name: string;
  reactions: Record<string, number>;
  onOpenMessageReaction: (message: ChatMessage) => void;
}) {
  return (
    <div className={`qc-chat-message-row group flex items-end gap-2 ${mine ? "justify-end" : "justify-start"}`}>
      {!mine ? <UserAvatar src={avatar} name={name} size="sm" frameClassName="border border-(--tc-border)" /> : null}
      <div className={`qc-chat-message-bubble relative max-w-[min(52rem,86%)] rounded-[28px] px-4 py-3 shadow-[0_14px_34px_rgba(15,23,42,0.08)] ${mine ? "rounded-br-md bg-[linear-gradient(135deg,#011848,#0b2b66)] text-white" : "rounded-bl-md bg-white text-slate-900 dark:bg-white/10 dark:text-white"}`}>
        <div className={`flex items-center justify-between gap-3 text-[11px] font-bold ${mine ? "text-white/65" : "text-slate-500 dark:text-white/50"}`}><span>{mine ? "VocÃª" : message.senderName}</span><span>{formatClock(message.createdAt)}</span></div>
        {message.text ? <p className="mt-1 whitespace-pre-wrap text-sm leading-6">{message.text}</p> : null}
        {(message.attachments ?? []).map((attachment) => <AttachmentView key={attachment.id ?? `${attachment.label}-${attachment.url}`} attachment={attachment} mine={mine} />)}

        {Object.keys(reactions).length > 0 ? (
          <div className="qc-chat-message-reactions">
            {Object.entries(reactions).map(([emoji, count]) => (
              <span key={emoji}>
                {emoji}
                {count > 1 ? <strong>{count}</strong> : null}
              </span>
            ))}
          </div>
        ) : null}

        <button
          type="button"
          className="qc-chat-message-reaction-plus"
          title="Reagir a esta mensagem"
          aria-label="Reagir a esta mensagem"
          onClick={() => onOpenMessageReaction(message)}
        >
          <FiPlus size={14} />
        </button>
      </div>
      {mine ? <UserAvatar src={avatar} name={name} size="sm" frameClassName="border border-(--tc-border)" /> : null}
    </div>
  );
}

export default function TeamChat() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isChatRoute = pathname === "/chat" || pathname.startsWith("/chat/");
  const { user, loading } = useAuthUser();
  const { activeClient } = useClientContext();
  const activeIdentity = resolveActiveIdentity({ user, activeCompany: activeClient });
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const latestIncomingRef = useRef<string | null>(null);
  const notificationBootstrappedRef = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioAnimationRef = useRef<number | null>(null);
  const scheduleReminderTimeoutsRef = useRef<number[]>([]);

  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [threads, setThreads] = useState<ChatThreadSummary[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [selectedPeerId, setSelectedPeerId] = useState<string | null>(() => searchParams.get("peer")?.trim() || null);
  const [chatSidebarWidth, setChatSidebarWidth] = useState(304);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [typingUserName, setTypingUserName] = useState<string | null>(null);
  const [recordingAudio, setRecordingAudio] = useState(false);
  const [recordedAudioFile, setRecordedAudioFile] = useState<File | null>(null);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [recordingStartedAt, setRecordingStartedAt] = useState<number | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioLevels, setAudioLevels] = useState<number[]>(() => Array.from({ length: 18 }, () => 12));
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [scheduleTitle, setScheduleTitle] = useState("");
  const [scheduleDateTime, setScheduleDateTime] = useState(getDefaultMeetingDateTime);
  const [scheduleDurationMinutes, setScheduleDurationMinutes] = useState("30");
  const [scheduleNotes, setScheduleNotes] = useState("");
  const [scheduleWithMeet, setScheduleWithMeet] = useState(true);
  const [chatActionTarget, setChatActionTarget] = useState<"composer" | ChatMessage | null>(null);
  const [messageReactions, setMessageReactions] = useState<Record<string, Record<string, number>>>({});
  const [messageReactionTarget, setMessageReactionTarget] = useState<ChatMessage | null>(null);
  const [pendingAttachments, setPendingAttachments] = useState<ChatAttachment[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [loadingThreads, setLoadingThreads] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [messageToolsModalOpen, setMessageToolsModalOpen] = useState(false);
  const [reactionModalOpen, setReactionModalOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noticePermission, setNoticePermission] = useState<NotificationPermission | "unsupported">("default");

  useEffect(() => {
    if (!isChatRoute) return;
    if (!loading && !user) router.replace("/login");
  }, [isChatRoute, loading, router, user]);

  useEffect(() => {
    if (typeof window !== "undefined") setNoticePermission("Notification" in window ? Notification.permission : "unsupported");
  }, []);

  // qc-chat-recording-timer-effect
  useEffect(() => {
    if (!recordingAudio || !recordingStartedAt) return;

    const interval = window.setInterval(() => {
      setRecordingSeconds(Math.max(0, Math.floor((Date.now() - recordingStartedAt) / 1000)));
    }, 250);

    return () => window.clearInterval(interval);
  }, [recordingAudio, recordingStartedAt]);

  useEffect(() => {
    setChatActionTarget(null);
  }, [selectedPeerId]);

  const loadContacts = useCallback(async () => {
    setLoadingContacts(true);
    setError(null);
    try {
      const response = await fetchApi("/api/chat/contacts", { cache: "no-store" });
      if (response.status === 401) return router.replace("/login");
      const payload = (await response.json().catch(() => ({ items: [] }))) as { items?: ChatContact[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "NÃ£o foi possÃ­vel carregar os contatos.");
      setContacts(Array.isArray(payload.items) ? payload.items : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "NÃ£o foi possÃ­vel carregar os contatos.");
      setContacts([]);
    } finally {
      setLoadingContacts(false);
    }
  }, [router]);

  const loadThreads = useCallback(async () => {
    setLoadingThreads(true);
    try {
      const response = await fetchApi("/api/chat/messages", { cache: "no-store" });
      if (response.status === 401) return router.replace("/login");
      const payload = (await response.json().catch(() => ({ threads: [] }))) as { threads?: ChatThreadSummary[] };
      setThreads(response.ok && Array.isArray(payload.threads) ? payload.threads : []);
    } finally {
      setLoadingThreads(false);
    }
  }, [router]);

  const loadMessages = useCallback(async (peerId: string | null) => {
    if (!peerId) {
      setMessages([]);
      return;
    }
    setLoadingMessages(true);
    try {
      const response = await fetchApi(`/api/chat/messages?peerId=${encodeURIComponent(peerId)}`, { cache: "no-store" });
      if (response.status === 401) return router.replace("/login");
      const payload = (await response.json().catch(() => ({ messages: [] }))) as { messages?: ChatMessage[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "NÃ£o foi possÃ­vel carregar a conversa.");
      setMessages(Array.isArray(payload.messages) ? payload.messages : []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "NÃ£o foi possÃ­vel carregar a conversa.");
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  }, [router]);

  useEffect(() => {
    if (!isChatRoute) return;
    void loadContacts();
    void loadThreads();
  }, [isChatRoute, loadContacts, loadThreads]);

  useEffect(() => {
    if (!isChatRoute || !user) return;
    const interval = window.setInterval(() => {
      void loadThreads();
      if (selectedPeerId) void loadMessages(selectedPeerId);
    }, 15000);
    return () => window.clearInterval(interval);
  }, [isChatRoute, loadMessages, loadThreads, selectedPeerId, user]);

  useEffect(() => {
    if (!isChatRoute) return;
    const peerId = searchParams.get("peer")?.trim() || null;
    if (peerId !== selectedPeerId) setSelectedPeerId(peerId);
  }, [isChatRoute, searchParams, selectedPeerId]);

  useEffect(() => {
    if (!isChatRoute) return;
    void loadMessages(selectedPeerId);
    setMessage("");
    setPendingAttachments([]);

    if (selectedPeerId) {
      void fetch("/api/chat/typing", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ peerId: selectedPeerId, active: false }),
      }).catch(() => null);
    }
    setToolsOpen(false);
  }, [isChatRoute, loadMessages, selectedPeerId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const contactsById = useMemo(() => new Map(contacts.map((contact) => [contact.id, contact])), [contacts]);
  const threadsByPeer = useMemo(() => new Map(threads.map((thread) => [thread.peerId, thread])), [threads]);
  const selectedContact = selectedPeerId ? contactsById.get(selectedPeerId) ?? null : null;
  const selectedThread = selectedPeerId ? threadsByPeer.get(selectedPeerId) ?? null : null;
  const selectedName = selectedContact?.name ?? selectedThread?.peerName ?? "Selecione uma conversa";
  const selectedAvatar = selectedContact?.avatar_url ?? selectedThread?.peerAvatarUrl ?? null;
  const selectedCompany = selectedContact ? getCompanyLabel(selectedContact) : "";
  const currentUserId = user?.id ?? "";
  const recentIds = useMemo(() => new Set(threads.map((thread) => thread.peerId)), [threads]);
  const filteredContacts = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    if (normalizedSearch.length < 2) {
      return [];
    }

    return contacts
      .filter((contact) => {
        return [
          contact.name,
          contact.email,
          contact.user,
          contact.company_name,
          (contact.origin_label ?? contact.permission_role ?? contact.profile_kind ?? ''),
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedSearch));
      })
      .slice(0, 20);
  }, [contacts, search]);

  const openConversation = useCallback((peerId: string) => {
    setSelectedPeerId(peerId);
    const params = new URLSearchParams(searchParams.toString());
    params.set("peer", peerId);
    router.replace(`/chat?${params.toString()}`, { scroll: false });
  }, [router, searchParams]);

  useEffect(() => {
    const latestIncoming = threads.find((thread) => thread.lastSenderId !== currentUserId) ?? null;
    if (!latestIncoming || !currentUserId) return;
    const signature = `${latestIncoming.key}:${latestIncoming.lastMessageAt}`;
    if (!notificationBootstrappedRef.current) {
      notificationBootstrappedRef.current = true;
      latestIncomingRef.current = signature;
      return;
    }
    if (latestIncomingRef.current === signature) return;
    latestIncomingRef.current = signature;
    if (typeof window === "undefined" || !("Notification" in window) || Notification.permission !== "granted") return;
    const notification = new Notification(`Nova mensagem de ${latestIncoming.lastSenderName}`, { body: latestIncoming.lastMessage, tag: `qc-chat-${latestIncoming.key}`, icon: "/images/tc.png" });
    notification.onclick = () => {
      window.focus();
      openConversation(latestIncoming.peerId);
      notification.close();
    };
  }, [currentUserId, openConversation, threads]);

  const requestNotifications = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return setNoticePermission("unsupported");
    setNoticePermission(await Notification.requestPermission());
  }, []);

  const uploadFiles = useCallback(async (files: FileList | File[]) => {
    const list = Array.from(files).slice(0, 8);
    if (list.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      list.forEach((file) => form.append("files", file));
      const response = await fetchApi("/api/chat/attachments", { method: "POST", body: form });
      if (response.status === 401) return router.replace("/login");
      const payload = (await response.json().catch(() => ({}))) as { attachments?: ChatAttachment[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "NÃ£o foi possÃ­vel anexar.");
      setPendingAttachments((current) => [...current, ...(payload.attachments ?? [])].slice(0, 8));
    } catch (err) {
      setError(err instanceof Error ? err.message : "NÃ£o foi possÃ­vel anexar.");
    } finally {
      setUploading(false);
    }
  }, [router]);

  const sendToPeer = useCallback(async (peerId: string, text: string, attachments: ChatAttachment[] = []) => {
    if ((!text.trim() && attachments.length === 0) || sending) return false;
    setSending(true);
    try {
      const response = await fetchApi("/api/chat/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ peerId, text: text.trim(), attachments }) });
      if (response.status === 401) return router.replace("/login"), false;
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "NÃ£o foi possÃ­vel enviar a mensagem.");
      openConversation(peerId);
      await Promise.all([loadMessages(peerId), loadThreads()]);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "NÃ£o foi possÃ­vel enviar a mensagem.");
      return false;
    } finally {
      setSending(false);
    }
  }, [loadMessages, loadThreads, openConversation, router, sending]);

  const sendMessage = useCallback(async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (!selectedPeerId || sending || uploading || (!message.trim() && pendingAttachments.length === 0)) return;
    const ok = await sendToPeer(selectedPeerId, message, pendingAttachments);
    if (ok) {
      setMessage("");
      setPendingAttachments([]);
    }
  }, [message, pendingAttachments, selectedPeerId, sendToPeer, sending, uploading]);

  const reactToMessage = useCallback((emoji: string) => {
    if (!messageReactionTarget) return;

    setMessageReactions((current) => {
      const currentMessage = current[messageReactionTarget.id] ?? {};
      const nextCount = (currentMessage[emoji] ?? 0) + 1;

      return {
        ...current,
        [messageReactionTarget.id]: {
          ...currentMessage,
          [emoji]: nextCount,
        },
      };
    });

    setMessageReactionTarget(null);
  }, [messageReactionTarget]);

  const sendSticker = useCallback(async (label: string) => {
    if (!selectedPeerId) return;
    await sendToPeer(selectedPeerId, label, [{ kind: "note", label, url: null, mimeType: null, sizeLabel: null, sourceLabel: "Figurinha" }]);
    setReactionModalOpen(false);
  }, [selectedPeerId, sendToPeer]);

  const sendGif = useCallback(async (gif: (typeof QUICK_GIFS)[number]) => {
    if (!selectedPeerId) return;
    await sendToPeer(selectedPeerId, "", [{ kind: "link", label: gif.label, url: gif.url, mimeType: "image/gif", sizeLabel: null, sourceLabel: "GIF" }]);
  }, [selectedPeerId, sendToPeer]);

  const playChatScheduleSound = useCallback(() => {
    if (typeof window === "undefined") return;

    try {
      const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;

      const audio = new AudioContextClass();
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(880, audio.currentTime);
      gain.gain.setValueAtTime(0.001, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.18, audio.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.35);

      oscillator.connect(gain);
      gain.connect(audio.destination);

      oscillator.start();
      oscillator.stop(audio.currentTime + 0.38);
    } catch {
      // Som Ã© opcional.
    }
  }, []);

  const showScheduleNotification = useCallback((title: string, body: string) => {
    playChatScheduleSound();

    if (typeof window === "undefined" || !("Notification" in window)) return;

    if (Notification.permission === "granted") {
      new Notification(title, {
        body,
        icon: "/images/tc.png",
        tag: "qc-chat-schedule",
      });
    }
  }, [playChatScheduleSound]);

  const startMeetNow = useCallback(async () => {
    if (!selectedPeerId) return;

    const start = new Date();
    const end = new Date(start.getTime() + 30 * 60 * 1000);
    const participantEmail = selectedContact?.email ?? selectedThread?.peerHandle ?? "";
    const title = `Ligação com ${selectedName}`;
    const meetUrl = "https://meet.google.com/new";

    const callNote = [
      "[LIGACAO_QC]",
      `TÃ­tulo: ${title}`,
      `Quando: ${formatScheduleDate(start)}`,
      "Tipo: ligaÃ§Ã£o iniciada agora",
      "DuraÃ§Ã£o prevista: 30 minutos",
      `Pessoa vinculada: ${selectedName}`,
      `Contato: ${participantEmail || "não informado"}`,
      `Empresa/contexto: ${selectedCompany || "não informado"}`,
      "Google Meet: Sim",
      "[/LIGACAO_QC]",
    ].join("\n");

    await fetch("/api/chat/schedules", {
      method: "POST",
      cache: "no-store",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        type: "meeting",
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        userIds: [selectedPeerId],
        companyName: selectedCompany || null,
        notes: "Ligação iniciada agora pelo chat.",
        meet: true,
        status: "started",
      }),
    }).catch(() => null);

    await sendToPeer(selectedPeerId, callNote, [
      {
        kind: "link",
        label: "Abrir Google Meet",
        url: meetUrl,
        mimeType: null,
        sizeLabel: "Ligação iniciada agora",
        sourceLabel: "Meet",
      },
    ]);

    if (typeof window !== "undefined") {
      window.open(meetUrl, "_blank", "noopener,noreferrer");
    }

    showScheduleNotification("Ligação iniciada", `${title} foi registrada no chat.`);
    setScheduleModalOpen(false);
  }, [
    selectedCompany,
    selectedContact?.email,
    selectedName,
    selectedPeerId,
    selectedThread?.peerHandle,
    sendToPeer,
    showScheduleNotification,
  ]);

  const openCameraCapture = useCallback(() => {
    if (typeof window === "undefined" || uploading) return;

    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*,video/*";
    input.capture = "environment";

    input.onchange = () => {
      if (input.files?.length) void uploadFiles(input.files);
    };

    input.click();
  }, [uploadFiles, uploading]);


  const formatRecordingTime = useCallback((seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const rest = seconds % 60;
    return String(minutes).padStart(2, "0") + ":" + String(rest).padStart(2, "0");
  }, []);

  const stopAudioMeter = useCallback(() => {
    if (audioAnimationRef.current) {
      cancelAnimationFrame(audioAnimationRef.current);
      audioAnimationRef.current = null;
    }

    if (audioContextRef.current) {
      void audioContextRef.current.close().catch(() => null);
      audioContextRef.current = null;
    }
  }, []);

  const stopAudioStream = useCallback(() => {
    audioStreamRef.current?.getTracks().forEach((track) => track.stop());
    audioStreamRef.current = null;
  }, []);

  const startAudioMeter = useCallback((stream: MediaStream) => {
    stopAudioMeter();

    try {
      const AudioContextClass =
        window.AudioContext ||
        (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

      if (!AudioContextClass) return;

      const audioContext = new AudioContextClass();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      const data = new Uint8Array(analyser.frequencyBinCount);

      analyser.fftSize = 64;
      source.connect(analyser);
      audioContextRef.current = audioContext;

      const tick = () => {
        analyser.getByteFrequencyData(data);

        const next = Array.from({ length: 18 }, (_, index) => {
          const value = data[index % data.length] ?? 0;
          return Math.max(8, Math.min(46, 8 + (value / 255) * 42));
        });

        setAudioLevels(next);
        audioAnimationRef.current = requestAnimationFrame(tick);
      };

      tick();
    } catch {
      setAudioLevels(Array.from({ length: 18 }, () => 16));
    }
  }, [stopAudioMeter]);

  const discardRecordedAudio = useCallback(() => {
    if (recordedAudioUrl) URL.revokeObjectURL(recordedAudioUrl);

    setRecordedAudioFile(null);
    setRecordedAudioUrl(null);
    setRecordingSeconds(0);
    setRecordingStartedAt(null);
    setAudioLevels(Array.from({ length: 18 }, () => 12));
  }, [recordedAudioUrl]);

  const sendRecordedAudio = useCallback(async () => {
    if (!recordedAudioFile || !selectedPeerId) return;

    setUploading(true);
    setError(null);

    try {
      const form = new FormData();
      form.append("files", recordedAudioFile, recordedAudioFile.name);

      const response = await fetchApi("/api/chat/attachments", {
        method: "POST",
        body: form,
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
        throw new Error(payload.error || "NÃ£o foi possÃ­vel enviar o áudio.");
      }

      const ok = await sendToPeer(
        selectedPeerId,
        "",
        payload.attachments.map((attachment) => ({
          ...attachment,
          sourceLabel: attachment.sourceLabel || "Áudio",
        })),
      );

      if (ok) discardRecordedAudio();
    } catch (err) {
      setError(err instanceof Error ? err.message : "NÃ£o foi possÃ­vel enviar o áudio.");
    } finally {
      setUploading(false);
    }
  }, [discardRecordedAudio, recordedAudioFile, router, selectedPeerId, sendToPeer]);

  const stopAudioRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
  }, []);

  const cancelAudioRecording = useCallback(() => {
    audioChunksRef.current = [];
    mediaRecorderRef.current?.stop();
    stopAudioMeter();
    stopAudioStream();
    setRecordingAudio(false);
    setRecordingStartedAt(null);
    setRecordingSeconds(0);
  }, [stopAudioMeter, stopAudioStream]);

  const startAudioRecording = useCallback(async () => {
    if (recordingAudio) {
      stopAudioRecording();
      return;
    }

    if (!selectedPeerId) {
      setError("Selecione uma conversa para gravar áudio.");
      return;
    }

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Este navegador não permitiu gravação de áudio.");
      return;
    }

    discardRecordedAudio();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(
        stream,
        MediaRecorder.isTypeSupported("audio/webm") ? { mimeType: "audio/webm" } : undefined,
      );

      audioStreamRef.current = stream;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        stopAudioMeter();
        stopAudioStream();

        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        audioChunksRef.current = [];

        mediaRecorderRef.current = null;
        setRecordingAudio(false);
        setRecordingStartedAt(null);

        if (blob.size > 0) {
          const file = new File([blob], "audio-chat-" + Date.now() + ".webm", { type: "audio/webm" });
          setRecordedAudioFile(file);
          setRecordedAudioUrl(URL.createObjectURL(blob));
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecordingAudio(true);
      setRecordingStartedAt(Date.now());
      setRecordingSeconds(0);
      startAudioMeter(stream);
      setError(null);
    } catch {
      stopAudioMeter();
      stopAudioStream();
      setRecordingAudio(false);
      setRecordingStartedAt(null);
      setError("NÃ£o foi possÃ­vel acessar o microfone.");
    }
  }, [
    discardRecordedAudio,
    recordingAudio,
    selectedPeerId,
    startAudioMeter,
    stopAudioMeter,
    stopAudioRecording,
    stopAudioStream,
  ]);


  const openScheduleModal = useCallback(() => {
    setScheduleTitle(selectedPeerId ? `Reunião com ${selectedName}` : "Nova reunião");
    setScheduleDateTime(getDefaultMeetingDateTime());
    setScheduleDurationMinutes("30");
    setScheduleNotes("");
    setScheduleWithMeet(true);
    setScheduleModalOpen(true);
  }, [selectedName, selectedPeerId]);

  const submitSchedule = useCallback(async () => {
    if (!selectedPeerId) return;

    const start = new Date(scheduleDateTime);
    const duration = Number(scheduleDurationMinutes) || 30;

    if (Number.isNaN(start.getTime())) {
      setError("Informe uma data vÃ¡lida para o agendamento.");
      return;
    }

    const end = new Date(start.getTime() + duration * 60 * 1000);
    const participantEmail = selectedContact?.email ?? selectedThread?.peerHandle ?? "";
    const meetText = scheduleWithMeet ? "Sim" : "NÃ£o";

    const brainScheduleNote = [
      "[AGENDA_QC]",
      `TÃ­tulo: ${scheduleTitle || `Reunião com ${selectedName}`}`,
      `Quando: ${formatScheduleDate(start)}`,
      `DuraÃ§Ã£o: ${duration} minutos`,
      `Pessoa vinculada: ${selectedName}`,
      `Contato: ${participantEmail || "não informado"}`,
      `Empresa/contexto: ${selectedCompany || "não informado"}`,
      `Google Meet: ${meetText}`,
      `Nota/descrição: ${scheduleNotes.trim() || "sem nota"}`,
      "[/AGENDA_QC]",
    ].join("\n");

    await fetch("/api/chat/schedules", {
      method: "POST",
      cache: "no-store",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: scheduleTitle || `Reunião com ${selectedName}`,
        type: "meeting",
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        userIds: [selectedPeerId],
        companyName: selectedCompany || null,
        notes: scheduleNotes,
        meet: scheduleWithMeet,
      }),
    }).catch(() => null);

    await sendToPeer(selectedPeerId, brainScheduleNote, [
      {
        kind: "system",
        label: "Agendamento registrado",
        url: null,
        mimeType: null,
        sizeLabel: null,
        sourceLabel: "Agenda",
      },
    ]);

    const params = new URLSearchParams({
      action: "TEMPLATE",
      text: scheduleTitle || `Reunião com ${selectedName}`,
      dates: `${toGoogleCalendarDate(start)}/${toGoogleCalendarDate(end)}`,
      details: [
        scheduleNotes.trim() || "Reunião criada pelo Chat do Quality Control.",
        "",
        "Registro para Brain:",
        brainScheduleNote,
      ].join("\n"),
      location: scheduleWithMeet ? "Google Meet" : "",
    });

    if (participantEmail.includes("@")) params.set("add", participantEmail);

    if (typeof window !== "undefined") {
      window.open(`https://calendar.google.com/calendar/render?${params.toString()}`, "_blank", "noopener,noreferrer");

      const reminderDelay = start.getTime() - Date.now() - 5 * 60 * 1000;

      if (reminderDelay > 0 && reminderDelay < 24 * 60 * 60 * 1000) {
        const timeoutId = window.setTimeout(() => {
          showScheduleNotification("Reunião chegando", `${scheduleTitle || selectedName} começa em 5 minutos.`);
        }, reminderDelay);

        scheduleReminderTimeoutsRef.current.push(timeoutId);
      }
    }

    showScheduleNotification("Agendamento preparado", `${scheduleTitle || selectedName} foi registrado no chat e aberto no calendÃ¡rio.`);

    setScheduleModalOpen(false);
  }, [
    scheduleDateTime,
    scheduleDurationMinutes,
    scheduleNotes,
    scheduleTitle,
    scheduleWithMeet,
    selectedCompany,
    selectedContact?.email,
    selectedName,
    selectedPeerId,
    selectedThread?.peerHandle,
    sendToPeer,
    showScheduleNotification,
  ]);



  const applyMessageReaction = useCallback((target: ChatMessage, emoji: string) => {
    setMessageReactions((current) => {
      const currentMessage = current[target.id] ?? {};
      const nextCount = (currentMessage[emoji] ?? 0) + 1;

      return {
        ...current,
        [target.id]: {
          ...currentMessage,
          [emoji]: nextCount,
        },
      };
    });

    setChatActionTarget(null);
  }, []);

  const handleUnifiedEmojiAction = useCallback((emoji: string) => {
    if (!chatActionTarget) return;

    if (chatActionTarget === "composer") {
      setChatActionTarget(null);
      void sendSticker(emoji);
      return;
    }

    applyMessageReaction(chatActionTarget, emoji);
  }, [applyMessageReaction, chatActionTarget, sendSticker]);

  const handleUnifiedGifAction = useCallback((gif: (typeof QUICK_GIFS)[number]) => {
    setChatActionTarget(null);
    void sendGif(gif);
  }, [sendGif]);

  const selectedActionMessage = chatActionTarget && chatActionTarget !== "composer" ? chatActionTarget : null;
  const isComposerAction = chatActionTarget === "composer";

  const handleDrop = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    if (event.dataTransfer.files?.length) void uploadFiles(event.dataTransfer.files);
  }, [uploadFiles]);

  const handleFileChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) void uploadFiles(event.target.files);
    event.target.value = "";
  }, [uploadFiles]);

  const handleChatModalButtonCapture = useCallback((event: MouseEvent<HTMLDivElement>) => {
    const target = event.target instanceof HTMLElement ? event.target : null;
    const button = target?.closest("button");

    if (!button) return;

    const action = button.getAttribute("data-qc-chat-action");
    const label = button.textContent?.trim().toLowerCase() ?? "";

    if (action === "open-message-tools" || label.includes("gif") || label.includes("figura") || label.includes("ícone") || label.includes("icone")) {
      event.preventDefault();
      event.stopPropagation();

      if (!selectedPeerId || sending) return;
      setMessageToolsModalOpen(true);
      return;
    }

    if (action === "open-reaction-tools" || label.includes("reações") || label.includes("reacoes") || label.includes("reagir")) {
      event.preventDefault();
      event.stopPropagation();

      if (!selectedPeerId || sending) return;
      setReactionModalOpen(true);
    }
  }, [selectedPeerId, sending]);

  const handleReactionButtonCapture = useCallback((event: MouseEvent<HTMLDivElement>) => {
    const target = event.target instanceof HTMLElement ? event.target : null;
    const button = target?.closest("button");

    if (!button) return;

    const label = button.textContent?.trim().toLowerCase() ?? "";
    const opensReactionModal = label.includes("reações") || label.includes("reacoes");

    if (!opensReactionModal) return;

    event.preventDefault();
    event.stopPropagation();

    if (!selectedPeerId || sending) return;

    setReactionModalOpen(true);
  }, [selectedPeerId, sending]);


  const startChatSidebarResize = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();

    const startX = event.clientX;
    const startWidth = chatSidebarWidth;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const nextWidth = Math.min(Math.max(startWidth + moveEvent.clientX - startX, 248), 420);
      setChatSidebarWidth(nextWidth);
    };

    const handlePointerUp = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  }, [chatSidebarWidth]);

  useEffect(() => {
    if (!isChatRoute || !user?.id) return;

    const ping = () => {
      void fetch(`/api/chat/presence?path=${encodeURIComponent(window.location.pathname)}`, {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
      }).catch(() => null);
    };

    ping();

    const interval = window.setInterval(ping, 30_000);
    window.addEventListener("focus", ping);
    document.addEventListener("visibilitychange", ping);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", ping);
      document.removeEventListener("visibilitychange", ping);
    };
  }, [isChatRoute, user?.id]);

  if (!isChatRoute) return null;
  if (loading && !user) return <div className="h-screen animate-pulse bg-[#061225]" />;
  if (!user) return null;

  return (
    <div className="qc-chat-shell qc-team-chat-testing-company h-full min-h-0 overflow-hidden bg-[linear-gradient(180deg,var(--page-bg),var(--tc-bg))] text-(--tc-text-primary)" onClickCapture={handleChatModalButtonCapture}>
      {scheduleModalOpen ? (
        <div className="qc-chat-schedule-modal" role="dialog" aria-modal="true" aria-label="Agendar reunião">
          <div className="qc-chat-modal-backdrop" onClick={() => setScheduleModalOpen(false)} />
          <div className="qc-chat-schedule-modal__panel">
            <div className="qc-chat-schedule-modal__header">
              <div>
                <span>Ligação e agenda</span>
                <h2>Ligação / Meet</h2>
                <p>Inicie uma ligaÃ§Ã£o agora ou agende para mais tarde com registro no chat.</p>
              </div>
              <button type="button" onClick={() => setScheduleModalOpen(false)} aria-label="Fechar">
                <FiX size={18} />
              </button>
            </div>

            <div className="qc-chat-schedule-modal__quick">
              <button type="button" onClick={() => void startMeetNow()} disabled={!selectedPeerId || sending}>
                <FiVideo size={18} />
                <span>
                  <strong>Iniciar agora</strong>
                  <small>Abre o Meet e registra a ligaÃ§Ã£o no chat automaticamente.</small>
                </span>
              </button>

              <div>
                <strong>Agendar para mais tarde</strong>
                <small>Informe data e horÃ¡rio abaixo para criar o registro de agenda.</small>
              </div>
            </div>

            <div className="qc-chat-schedule-modal__body">
              <label>
                <span>TÃ­tulo</span>
                <input value={scheduleTitle} onChange={(event) => setScheduleTitle(event.target.value)} placeholder="Reunião com..." />
              </label>

              <div className="qc-chat-schedule-modal__row">
                <label>
                  <span>Data e horÃ¡rio para mais tarde</span>
                  <input type="datetime-local" value={scheduleDateTime} onChange={(event) => setScheduleDateTime(event.target.value)} />
                </label>

                <label>
                  <span>DuraÃ§Ã£o</span>
                  <select value={scheduleDurationMinutes} onChange={(event) => setScheduleDurationMinutes(event.target.value)}>
                    <option value="15">15 minutos</option>
                    <option value="30">30 minutos</option>
                    <option value="45">45 minutos</option>
                    <option value="60">1 hora</option>
                    <option value="90">1h30</option>
                  </select>
                </label>
              </div>

              <label>
                <span>Contexto da ligaÃ§Ã£o</span>
                <textarea value={scheduleNotes} onChange={(event) => setScheduleNotes(event.target.value)} rows={4} placeholder="DescriÃ§Ã£o, pauta, contexto, pendÃªncias e pessoas vinculadas..." />
              </label>

              <label className="qc-chat-schedule-modal__check">
                <input type="checkbox" checked={scheduleWithMeet} onChange={(event) => setScheduleWithMeet(event.target.checked)} />
                <span>Criar registro como Google Meet</span>
              </label>

              <div className="qc-chat-schedule-modal__linked">
                <strong>Pessoas vinculadas</strong>
                <span>{selectedName}</span>
                {selectedContact?.email ? <small>{selectedContact.email}</small> : null}
                {selectedCompany ? <small>{selectedCompany}</small> : null}
              </div>
            </div>

            <div className="qc-chat-schedule-modal__footer">
              <button type="button" onClick={() => setScheduleModalOpen(false)}>Cancelar</button>
              <button type="button" onClick={() => void submitSchedule()}>
                <FiCalendar size={15} />
                Agendar e abrir calendÃ¡rio
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {chatActionTarget ? (
        <div className="qc-chat-unified-action-modal" role="dialog" aria-modal="true" aria-label={isComposerAction ? "Enviar na conversa" : "Reagir Ã  mensagem"}>
          <div className="qc-chat-modal-backdrop" onClick={() => setChatActionTarget(null)} />
          <div className="qc-chat-unified-action-modal__panel">
            <div className="qc-chat-unified-action-modal__header">
              <div>
                <span>{isComposerAction ? "Enviar na conversa" : "Reagir Ã  mensagem"}</span>
                <h2>{isComposerAction ? "GIFs, ícones e figuras" : "Curtir comentÃ¡rio"}</h2>
                <p>{isComposerAction ? "Escolha uma opÃ§Ã£o para enviar na conversa." : "Escolha uma reação para essa mensagem."}</p>
              </div>
              <button type="button" onClick={() => setChatActionTarget(null)} aria-label="Fechar">
                <FiX size={18} />
              </button>
            </div>

            {selectedActionMessage ? (
              <div className="qc-chat-unified-action-modal__preview">
                <strong>{selectedActionMessage.senderName}</strong>
                <span>{selectedActionMessage.text || "Mensagem com anexo"}</span>
              </div>
            ) : null}

            <div className="qc-chat-unified-action-modal__section">
              <h3>{isComposerAction ? "Ãcones e figurinhas" : "ReaÃ§Ãµes"}</h3>
              <div className="qc-chat-unified-action-modal__grid">
                {CHAT_UNIFIED_ACTION_OPTIONS.map((option) => (
                  <button
                    key={option.label}
                    type="button"
                    onClick={() => handleUnifiedEmojiAction(option.emoji)}
                  >
                    <span className="qc-chat-unified-action-modal__emoji">{option.emoji}</span>
                    <span>
                      <strong>{option.label}</strong>
                      <small>{option.description}</small>
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {isComposerAction ? (
              <div className="qc-chat-unified-action-modal__section">
                <h3>GIFs rÃ¡pidos</h3>
                <div className="qc-chat-unified-action-modal__grid qc-chat-unified-action-modal__grid--compact">
                  {QUICK_GIFS.map((gif) => (
                    <button
                      key={gif.label}
                      type="button"
                      onClick={() => handleUnifiedGifAction(gif)}
                    >
                      <span className="qc-chat-unified-action-modal__emoji">ðŸŽžï¸</span>
                      <span>
                        <strong>{gif.label}</strong>
                        <small>Enviar GIF na conversa</small>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      {messageReactionTarget ? (
        <div className="qc-chat-message-reaction-modal" role="dialog" aria-modal="true" aria-label="Reagir Ã  mensagem">
          <div className="qc-chat-modal-backdrop" onClick={() => setMessageReactionTarget(null)} />
          <div className="qc-chat-modal-panel qc-chat-message-reaction-modal__panel">
            <div className="qc-chat-modal-header">
              <div>
                <span className="qc-chat-modal-eyebrow">Reagir Ã  mensagem</span>
                <h2>Curtir comentÃ¡rio</h2>
                <p>Escolha uma reação para marcar essa mensagem. Pode ter vÃ¡rias reações na mesma mensagem.</p>
              </div>
              <button type="button" onClick={() => setMessageReactionTarget(null)} aria-label="Fechar">
                <FiX size={18} />
              </button>
            </div>

            <div className="qc-chat-message-reaction-preview">
              <strong>{messageReactionTarget.senderName}</strong>
              <span>{messageReactionTarget.text || "Mensagem com anexo"}</span>
            </div>

            <div className="qc-chat-modal-grid">
              {CHAT_MESSAGE_REACTION_OPTIONS.map((option) => (
                <button
                  key={option.label}
                  type="button"
                  onClick={() => reactToMessage(option.emoji)}
                >
                  <span className="qc-chat-modal-emoji">{option.emoji}</span>
                  <span>
                    <strong>{option.label}</strong>
                    <small>{option.description}</small>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
      {reactionModalOpen ? (
        <div className="qc-chat-reaction-modal" role="dialog" aria-modal="true" aria-label="Reagir Ã  conversa">
          <div className="qc-chat-reaction-modal__backdrop" onClick={() => setReactionModalOpen(false)} />
          <div className="qc-chat-reaction-modal__panel">
            <div className="qc-chat-reaction-modal__header">
              <div>
                <span className="qc-chat-reaction-modal__eyebrow">ReaÃ§Ã£o rÃ¡pida</span>
                <h2>Curtir conversa</h2>
                <p>Escolha uma opÃ§Ã£o para reagir Ã  mensagem/conversa atual.</p>
              </div>
              <button type="button" onClick={() => setReactionModalOpen(false)} aria-label="Fechar reações">
                <FiX size={18} />
              </button>
            </div>

            <div className="qc-chat-reaction-modal__grid">
              {CHAT_REACTION_OPTIONS.map((reaction) => (
                <button
                  key={reaction.label}
                  type="button"
                  onClick={() => void sendSticker(reaction.emoji)}
                  disabled={!selectedPeerId || sending}
                >
                  <span className="qc-chat-reaction-modal__emoji">{reaction.emoji}</span>
                  <span className="qc-chat-reaction-modal__content">
                    <strong>{reaction.label}</strong>
                    <small>{reaction.description}</small>
                  </span>
                </button>
              ))}
            </div>

            <div className="qc-chat-reaction-modal__footer">
              <span>Essa reação entra na conversa como mensagem rápida.</span>
              <button type="button" onClick={() => setReactionModalOpen(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      ) : null}
      <section
        className="grid h-full min-h-0 grid-cols-1 overflow-hidden lg:grid-cols-[320px_minmax(0,1fr)]"
        style={{
          gridTemplateColumns: `${chatSidebarWidth}px minmax(0, 1fr)`,
          "--qc-chat-sidebar-width": `${chatSidebarWidth}px`,
        } as CSSProperties}
      >
        <aside className="flex min-h-0 flex-col border-r border-white/10 bg-[#061225]/95 text-white">
          <div className="border-b border-white/10 p-4">
            <div className="flex items-center gap-3">
              <UserAvatar src={activeIdentity.avatarUrl} name={activeIdentity.displayName} size="md" frameClassName="border border-white/15" />
              <div className="min-w-0 flex-1"><div className="truncate text-sm font-black">{activeIdentity.displayName}</div><div className="truncate text-xs text-white/52">{activeIdentity.username ? `@${activeIdentity.username}` : activeIdentity.email ?? "Conta autenticada"}</div></div>
              <button type="button" onClick={() => void loadThreads()} aria-label="Atualizar conversas" title="Atualizar conversas" className="rounded-full border border-white/10 bg-white/8 p-2 text-white/70 hover:text-white"><FiRefreshCw size={14} className={loadingThreads ? "animate-spin" : ""} /></button>
            </div>
            <div className="relative mt-4"><FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/35" size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => { if (event.key === "Enter" && filteredContacts[0]) openConversation(filteredContacts[0].id); }} placeholder="Buscar usuário pelo nome" className="w-full rounded-2xl border border-white/10 bg-white/8 py-3 pl-10 pr-3 text-sm text-white outline-none placeholder:text-white/38" /></div>
            <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.14em]"><span className="rounded-full border border-white/10 px-2.5 py-1 text-white/62">{contacts.length} contatos</span><span className="rounded-full border border-white/10 px-2.5 py-1 text-white/62">{contacts.filter((c) => c.presence_status === "online").length} ativos</span>{noticePermission === "granted" ? <span className="rounded-full border border-emerald-400/30 px-2.5 py-1 text-emerald-300">notifica</span> : null}</div>
          </div>
          {error ? <div className="m-4 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</div> : null}
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
            <div><div className="mb-2 flex items-center justify-between px-1 text-[10px] font-black uppercase tracking-[0.22em] text-white/40"><span className="inline-flex items-center gap-2"><FiInbox size={12} /> Recentes</span><span>{threads.length}</span></div><div className="space-y-1.5">{threads.slice(0, 6).map((thread) => <button key={thread.key} type="button" onClick={() => openConversation(thread.peerId)} className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left ${thread.peerId === selectedPeerId ? "bg-white/12" : "hover:bg-white/8"}`}><UserAvatar src={contactsById.get(thread.peerId)?.avatar_url ?? thread.peerAvatarUrl} name={thread.peerName} size="sm" frameClassName="border border-white/15" /><span className="min-w-0 flex-1"><span className="flex justify-between gap-2"><span className="truncate text-sm font-bold">{thread.peerName}</span><span className="text-[10px] text-white/40">{formatRelative(thread.lastMessageAt)}</span></span><span className="block truncate text-xs text-white/52">{thread.lastSenderId === currentUserId ? "VocÃª" : thread.lastSenderName}: {thread.lastMessage}</span></span></button>)}{threads.length === 0 ? <div className="rounded-2xl border border-dashed border-white/10 px-4 py-4 text-sm text-white/48">Ainda não há conversas recentes.</div> : null}</div></div>
            <div><div className="mb-2 flex items-center justify-between px-1 text-[10px] font-black uppercase tracking-[0.22em] text-white/40"><span className="inline-flex items-center gap-2"><FiUsers size={12} /> Conversas</span><span className="qc-chat-sidebar-presence-label">{contacts.filter((c) => c.presence_status === "online").length} online</span></div><div className="space-y-1.5">{loadingContacts ? <div className="px-4 py-4 text-sm text-white/48">Digite pelo menos 2 caracteres para buscar usuários.</div> : filteredContacts.map((contact) => <ContactRow key={contact.id} contact={contact} active={contact.id === selectedPeerId} recent={recentIds.has(contact.id)} onSelect={openConversation} />)}</div></div>
          </div>
        </aside>

        <button
          type="button"
          aria-label="Ajustar largura da coluna de conversas"
          title="Ajustar largura"
          className="qc-chat-sidebar-resizer"
          onPointerDown={startChatSidebarResize}
        >
          <span>â†”</span>
        </button>

        <main className="relative flex min-h-0 flex-col" onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={handleDrop}>
          {dragging ? <div className="pointer-events-none absolute inset-4 z-30 flex items-center justify-center rounded-4xl border-2 border-dashed border-(--tc-accent) bg-slate-950/70 text-white"><div className="text-center"><FiUploadCloud size={42} className="mx-auto mb-3" /><div className="text-lg font-black">Solte aqui para anexar</div><div className="text-sm text-white/70">Imagem, GIF, PDF, TXT ou áudio atÃ© 10 MB</div></div></div> : null}
          <header className="flex min-h-22 items-center justify-between gap-4 border-b border-(--tc-border) bg-(--tc-surface)/90 px-5 py-4">
            <div className="flex min-w-0 items-center gap-4"><UserAvatar src={selectedAvatar} name={selectedName} size="lg" frameClassName="border border-(--tc-border)" /><div className="min-w-0"><h1 className="truncate text-2xl font-black tracking-[-0.04em]">{selectedName}</h1><div className="mt-1 truncate text-xs text-(--tc-text-muted)">{selectedContact?.user ? `@${selectedContact.user}` : selectedThread?.peerHandle ? `@${selectedThread.peerHandle}` : "Busque uma pessoa na lateral para começar"}{selectedCompany ? ` â€¢ ${selectedCompany}` : ""}</div></div></div>
            <div className="hidden" aria-hidden />
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5"><div className="flex min-h-full w-full flex-col justify-end gap-4">{selectedPeerId ? loadingMessages && messages.length === 0 ? <div className="h-24 animate-pulse rounded-[28px] bg-white/50 dark:bg-white/8" /> : messages.length > 0 ? messages.map((item) => { const mine = item.senderId === currentUserId; return <MessageBubble
                      key={item.id}
                      message={item}
                      mine={mine}
                      avatar={mine ? activeIdentity.avatarUrl : selectedAvatar}
                      name={mine ? activeIdentity.displayName : selectedName}
                      reactions={messageReactions[item.id] ?? {}}
                      onOpenMessageReaction={setChatActionTarget}
                    />; }) : <div className="flex min-h-[42vh] flex-col items-center justify-center text-center"><FiInbox size={32} className="text-(--tc-text-muted)" /><h3 className="mt-4 text-2xl font-black">Conversa</h3><p className="mt-2 text-sm text-(--tc-text-muted)">Use mensagens, arquivos, GIFs e reações para conversar.</p></div> : <div className="flex min-h-full flex-col items-center justify-center text-center"><FiUsers size={34} className="text-(--tc-text-muted)" /><h3 className="mt-4 text-3xl font-black tracking-tighter">Selecione uma conversa</h3><p className="mt-2 max-w-xl text-sm text-(--tc-text-muted)">A conversa usa o espaço inteiro, com bolhas, anexos, GIFs, figurinhas e notificações.</p></div>}<div ref={messagesEndRef} /></div></div>
          <form onSubmit={sendMessage} className="border-t border-(--tc-border) bg-(--tc-surface)/94 px-5 py-4">
              <div className="qc-chat-composer-action-bar">
                <button
                  type="button"
                  className="qc-chat-action-pill qc-chat-action-pill--primary"
                  onClick={() => setChatActionTarget("composer")}
                  disabled={!selectedPeerId || sending}
                  aria-label="Abrir opÃ§Ãµes da conversa"
                  title="Abrir opÃ§Ãµes"
                >
                  <FiPlus size={15} />
                  <span>Opções</span>
                </button>

                <button
                  type="button"
                  className={`qc-chat-action-pill ${recordingAudio ? "qc-chat-action-pill--recording" : ""}`}
                  onClick={() => recordingAudio ? stopAudioRecording() : void startAudioRecording()}
                  disabled={!selectedPeerId || sending || uploading}
                  title={recordingAudio ? "Parar gravação" : "Gravar áudio"}
                >
                  {recordingAudio ? <FiStopCircle size={15} /> : <FiMic size={15} />}
                  <span>{recordingAudio ? "Gravando" : "Áudio"}</span>
                </button>

                <button
                  type="button"
                  className="qc-chat-action-pill"
                  onClick={openScheduleModal}
                  disabled={!selectedPeerId}
                  title="Ligação / Meet"
                >
                  <FiVideo size={15} />
                  <span>Ligação</span>
                </button>

                <button
                  type="button"
                  className="qc-chat-action-pill"
                  onClick={openScheduleModal}
                  disabled={!selectedPeerId}
                  title="Agendar reunião"
                >
                  <FiCalendar size={15} />
                  <span>Agenda</span>
                </button>
              </div>
            <input ref={fileInputRef} type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,text/plain,audio/mpeg,audio/wav,audio/webm,audio/ogg" aria-label="Selecionar arquivos para anexar" title="Selecionar arquivos" className="hidden" onChange={handleFileChange} />
            <div className="w-full">{pendingAttachments.length > 0 ? <div className="mb-3 flex gap-2 overflow-x-auto">{pendingAttachments.map((attachment, index) => <AttachmentView key={attachment.id ?? index} attachment={attachment} removable onRemove={() => setPendingAttachments((items) => items.filter((_, i) => i !== index))} />)}</div> : null}
{typingUserName ? (
                <div className="qc-chat-typing-indicator">
                  {typingUserName} estÃ¡ digitando...
                </div>
              ) : null}

              
              {recordingAudio || recordedAudioUrl ? (
                <div className="qc-chat-audio-recorder-card !border-white/10 !bg-slate-950/95 !text-white shadow-2xl">
                  <div className="qc-chat-audio-recorder-head">
                    <div>
                      <strong>{recordingAudio ? "Gravando áudio" : "Prévia do áudio"}</strong>
                      <span className="text-white/70">{recordingAudio ? "Fale agora. Clique em Gravando para parar." : "Ouça antes de enviar."}</span>
                    </div>
                    <span className="qc-chat-audio-recorder-time text-white/80">{formatRecordingTime(recordingSeconds)}</span>
                  </div>

                  <div className="qc-chat-audio-visualizer" aria-hidden="true">
                    {audioLevels.map((level, index) => (
                      <span key={index} style={{ height: `${level}px` }} />
                    ))}
                  </div>

                  {recordedAudioUrl ? (
                    <audio controls src={recordedAudioUrl} preload="metadata" className="qc-chat-audio-preview-player" />
                  ) : null}

                  <div className="qc-chat-audio-recorder-actions">
                    <button type="button" onClick={recordingAudio ? cancelAudioRecording : discardRecordedAudio}>
                      Descartar
                    </button>

                    {recordingAudio ? (
                      <button type="button" onClick={stopAudioRecording} className="is-primary">
                        Parar gravação
                      </button>
                    ) : (
                      <button type="button" onClick={() => void sendRecordedAudio()} disabled={!recordedAudioFile || uploading || sending} className="is-primary">
                        Enviar áudio
                      </button>
                    )}
                  </div>
                </div>
              ) : null}

              <div className="flex items-end gap-3 rounded-[28px] border border-(--tc-border) bg-(--tc-surface-2) p-2"><button type="button" onClick={() => fileInputRef.current?.click()} disabled={!selectedPeerId || uploading} className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-(--tc-border) bg-(--tc-surface)">{uploading ? <FiRefreshCw className="animate-spin" /> : <FiPaperclip />}</button><textarea value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event: KeyboardEvent<HTMLTextAreaElement>) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }} placeholder={selectedPeerId ? `Enviar mensagem para ${selectedName}...` : "Escolha uma pessoa para começar"} rows={1} disabled={!selectedPeerId || sending} className="max-h-36 min-h-12 flex-1 resize-none bg-transparent px-1 py-3 text-sm leading-6 outline-none placeholder:text-(--tc-text-muted)" /><button type="submit" disabled={!selectedPeerId || sending || uploading || (!message.trim() && pendingAttachments.length === 0)} className="inline-flex h-12 shrink-0 items-center gap-2 rounded-full bg-(--tc-accent) px-5 text-sm font-black text-white disabled:opacity-50"><FiSend size={16} /> Enviar</button></div>
              <div className="mt-2 flex justify-between px-2 text-[11px] text-(--tc-text-muted)"><span>Enter envia, Shift+Enter quebra linha. Arraste arquivos para anexar.</span><span>{uploading ? "Anexando..." : "Imagem, GIF, PDF, TXT ou áudio"}</span></div></div>
          </form>
        </main>
      </section>
    </div>
  );
}



