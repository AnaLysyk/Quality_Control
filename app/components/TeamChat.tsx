"use client";

import { type PointerEvent as ReactPointerEvent, type CSSProperties, usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type FormEvent, type KeyboardEvent, type MouseEvent, type MouseEvent } from "react";
import { FiBell, FiChevronRight, FiFile, FiImage, FiInbox, FiPaperclip, FiPlus, FiRefreshCw, FiSearch, FiSend, FiSmile, FiUploadCloud, FiUsers, FiX } from "react-icons/fi";

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

const QUICK_REACTIONS = ["✅", "🐞", "🔥", "👀", "🙌", "⚠️", "🎉", "🤔"];

const CHAT_MESSAGE_REACTION_OPTIONS = [
  { emoji: "👍", label: "Curtir", description: "Curtir essa mensagem" },
  { emoji: "❤️", label: "Amei", description: "Gostei muito dessa mensagem" },
  { emoji: "✅", label: "Resolvido", description: "Essa mensagem resolveu" },
  { emoji: "👀", label: "Visto", description: "Estou acompanhando" },
  { emoji: "🔥", label: "Destaque", description: "Mensagem importante" },
  { emoji: "🎉", label: "Celebrar", description: "Comemorar avanço" },
  { emoji: "🐞", label: "Bug", description: "Marcar como ponto técnico" },
  { emoji: "⚠️", label: "Atenção", description: "Precisa de cuidado" },
  { emoji: "🤔", label: "Revisar", description: "Precisa revisar" },
  { emoji: "🙌", label: "Aprovado", description: "Está aprovado" },
];
const QUICK_GIFS = [
  { label: "Digitando", url: "https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif" },
  { label: "Feito", url: "https://media.giphy.com/media/26u4lOMA8JKSnL9Uk/giphy.gif" },
  { label: "Celebrando", url: "https://media.giphy.com/media/5GoVLqeAOo6PK/giphy.gif" },
];

const CHAT_UNIFIED_ACTION_OPTIONS = [
  { emoji: "👍", label: "Curtir", description: "Curtir ou enviar curtida" },
  { emoji: "❤️", label: "Amei", description: "Reação positiva" },
  { emoji: "✅", label: "Resolvido", description: "Marcar como resolvido" },
  { emoji: "👀", label: "Visto", description: "Estou acompanhando" },
  { emoji: "🔥", label: "Destaque", description: "Mensagem importante" },
  { emoji: "🎉", label: "Celebrar", description: "Comemorar avanço" },
  { emoji: "🐞", label: "Bug", description: "Sinalizar problema" },
  { emoji: "⚠️", label: "Atenção", description: "Marcar risco ou cuidado" },
  { emoji: "🤔", label: "Revisar", description: "Pedir revisão" },
  { emoji: "🙌", label: "Aprovado", description: "Aprovar mensagem" },
];

const CHAT_MESSAGE_EMOJI_OPTIONS = [
  { emoji: "👍", label: "Curtir", description: "Enviar curtida na conversa" },
  { emoji: "❤️", label: "Amei", description: "Enviar reação positiva" },
  { emoji: "✅", label: "Feito", description: "Confirmar que foi resolvido" },
  { emoji: "👀", label: "Vendo", description: "Avisar que está acompanhando" },
  { emoji: "🔥", label: "Destaque", description: "Marcar algo importante" },
  { emoji: "🎉", label: "Celebrar", description: "Comemorar avanço" },
  { emoji: "🐞", label: "Bug", description: "Sinalizar problema" },
  { emoji: "⚠️", label: "Atenção", description: "Marcar risco ou cuidado" },
];

const CHAT_REACTION_OPTIONS = [
  { emoji: "👍", label: "Curtir", description: "Marcar que você gostou da conversa" },
  { emoji: "❤️", label: "Amei", description: "Reação positiva com mais destaque" },
  { emoji: "✅", label: "Resolvido", description: "Indicar que ficou certo" },
  { emoji: "👀", label: "Estou vendo", description: "Mostrar que está acompanhando" },
  { emoji: "🔥", label: "Muito bom", description: "Dar destaque para algo importante" },
  { emoji: "🎉", label: "Celebrar", description: "Comemorar avanço ou entrega" },
  { emoji: "🐞", label: "Bug", description: "Marcar ponto de atenção técnico" },
  { emoji: "⚠️", label: "Atenção", description: "Sinalizar cuidado ou risco" },
  { emoji: "🤔", label: "Revisar", description: "Pedir análise com calma" },
  { emoji: "🙌", label: "Aprovado", description: "Confirmar que está bom" },
];

function normalizeSearch(value: string) {
  return value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function formatClock(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(date);
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
  if (value === "leader_tc") return "Líder TC";
  if (value === "technical_support") return "Suporte técnico";
  if (value === "empresa") return "Empresa";
  if (value === "company_user") return "Usuário empresa";
  if (value === "testing_company_user") return "Usuário TC";
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
      {removable && onRemove ? <button type="button" onClick={onRemove} className="rounded-full p-1 opacity-70 hover:bg-black/10"><FiX size={12} /></button> : null}
    </div>
  );
}

function ContactRow({ contact, active, recent, onSelect }: { contact: ChatContact; active: boolean; recent: boolean; onSelect: (id: string) => void }) {
  return (
    <button type="button" onClick={() => onSelect(contact.id)} className={`group flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition ${active ? "bg-white/12 text-white" : "text-white/78 hover:bg-white/8 hover:text-white"}`}>
      <UserAvatar src={contact.avatar_url} name={contact.name} size="sm" className="shrink-0" frameClassName="border border-white/15" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2"><span className="truncate text-sm font-bold">{contact.name}</span>{recent ? <span className="h-2 w-2 rounded-full bg-(--tc-accent)" /> : null}</span>
        <span className="block truncate text-[11px] text-white/48">{contact.user ? `@${contact.user}` : contact.email}</span>
        <span className="mt-1 flex flex-wrap gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white/50"><span>{getRoleLabel(contact)}</span>{getCompanyLabel(contact) ? <span>• {getCompanyLabel(contact)}</span> : null}</span>
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
        <div className={`flex items-center justify-between gap-3 text-[11px] font-bold ${mine ? "text-white/65" : "text-slate-500 dark:text-white/50"}`}><span>{mine ? "Você" : message.senderName}</span><span>{formatClock(message.createdAt)}</span></div>
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

  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [threads, setThreads] = useState<ChatThreadSummary[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [selectedPeerId, setSelectedPeerId] = useState<string | null>(() => searchParams.get("peer")?.trim() || null);
  const [chatSidebarWidth, setChatSidebarWidth] = useState(304);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
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
      if (!response.ok) throw new Error(payload.error || "Não foi possível carregar os contatos.");
      setContacts(Array.isArray(payload.items) ? payload.items : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar os contatos.");
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
      if (!response.ok) throw new Error(payload.error || "Não foi possível carregar a conversa.");
      setMessages(Array.isArray(payload.messages) ? payload.messages : []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar a conversa.");
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
    const term = normalizeSearch(search);
    if (!term) return contacts;
    return contacts.filter((contact) => normalizeSearch(`${contact.name} ${contact.email} ${contact.user} ${contact.company_name ?? ""} ${contact.company_names.join(" ")} ${contact.job_title ?? ""}`).includes(term));
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
      if (!response.ok) throw new Error(payload.error || "Não foi possível anexar.");
      setPendingAttachments((current) => [...current, ...(payload.attachments ?? [])].slice(0, 8));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível anexar.");
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
      if (!response.ok) throw new Error(payload.error || "Não foi possível enviar a mensagem.");
      openConversation(peerId);
      await Promise.all([loadMessages(peerId), loadThreads()]);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível enviar a mensagem.");
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

  if (!isChatRoute) return null;
  if (loading && !user) return <div className="h-screen animate-pulse bg-[#061225]" />;
  if (!user) return null;

  return (
    <div className="qc-team-chat-testing-company h-full min-h-0 overflow-hidden bg-[linear-gradient(180deg,var(--page-bg),var(--tc-bg))] text-(--tc-text-primary)" onClickCapture={handleChatModalButtonCapture}>
      {chatActionTarget ? (
        <div className="qc-chat-unified-action-modal" role="dialog" aria-modal="true" aria-label={isComposerAction ? "Enviar na conversa" : "Reagir à mensagem"}>
          <div className="qc-chat-modal-backdrop" onClick={() => setChatActionTarget(null)} />
          <div className="qc-chat-unified-action-modal__panel">
            <div className="qc-chat-unified-action-modal__header">
              <div>
                <span>{isComposerAction ? "Enviar na conversa" : "Reagir à mensagem"}</span>
                <h2>{isComposerAction ? "GIFs, ícones e figuras" : "Curtir comentário"}</h2>
                <p>{isComposerAction ? "Escolha uma opção para enviar na conversa." : "Escolha uma reação para essa mensagem."}</p>
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
              <h3>{isComposerAction ? "Ícones e figurinhas" : "Reações"}</h3>
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
                <h3>GIFs rápidos</h3>
                <div className="qc-chat-unified-action-modal__grid qc-chat-unified-action-modal__grid--compact">
                  {QUICK_GIFS.map((gif) => (
                    <button
                      key={gif.label}
                      type="button"
                      onClick={() => handleUnifiedGifAction(gif)}
                    >
                      <span className="qc-chat-unified-action-modal__emoji">🎞️</span>
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
        <div className="qc-chat-message-reaction-modal" role="dialog" aria-modal="true" aria-label="Reagir à mensagem">
          <div className="qc-chat-modal-backdrop" onClick={() => setMessageReactionTarget(null)} />
          <div className="qc-chat-modal-panel qc-chat-message-reaction-modal__panel">
            <div className="qc-chat-modal-header">
              <div>
                <span className="qc-chat-modal-eyebrow">Reagir à mensagem</span>
                <h2>Curtir comentário</h2>
                <p>Escolha uma reação para marcar essa mensagem. Pode ter várias reações na mesma mensagem.</p>
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
        <div className="qc-chat-reaction-modal" role="dialog" aria-modal="true" aria-label="Reagir à conversa">
          <div className="qc-chat-reaction-modal__backdrop" onClick={() => setReactionModalOpen(false)} />
          <div className="qc-chat-reaction-modal__panel">
            <div className="qc-chat-reaction-modal__header">
              <div>
                <span className="qc-chat-reaction-modal__eyebrow">Reação rápida</span>
                <h2>Curtir conversa</h2>
                <p>Escolha uma opção para reagir à mensagem/conversa atual.</p>
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
              <button type="button" onClick={() => void loadThreads()} className="rounded-full border border-white/10 bg-white/8 p-2 text-white/70 hover:text-white"><FiRefreshCw size={14} className={loadingThreads ? "animate-spin" : ""} /></button>
            </div>
            <div className="relative mt-4"><FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/35" size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => { if (event.key === "Enter" && filteredContacts[0]) openConversation(filteredContacts[0].id); }} placeholder="Buscar usuário pelo nome" className="w-full rounded-2xl border border-white/10 bg-white/8 py-3 pl-10 pr-3 text-sm text-white outline-none placeholder:text-white/38" /></div>
            <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.14em]"><span className="rounded-full border border-white/10 px-2.5 py-1 text-white/62">{contacts.length} contatos</span><span className="rounded-full border border-white/10 px-2.5 py-1 text-white/62">{contacts.filter((c) => c.active).length} ativos</span>{noticePermission === "granted" ? <span className="rounded-full border border-emerald-400/30 px-2.5 py-1 text-emerald-300">notifica</span> : null}</div>
          </div>
          {error ? <div className="m-4 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</div> : null}
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
            <div><div className="mb-2 flex items-center justify-between px-1 text-[10px] font-black uppercase tracking-[0.22em] text-white/40"><span className="inline-flex items-center gap-2"><FiInbox size={12} /> Recentes</span><span>{threads.length}</span></div><div className="space-y-1.5">{threads.slice(0, 6).map((thread) => <button key={thread.key} type="button" onClick={() => openConversation(thread.peerId)} className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left ${thread.peerId === selectedPeerId ? "bg-white/12" : "hover:bg-white/8"}`}><UserAvatar src={contactsById.get(thread.peerId)?.avatar_url ?? thread.peerAvatarUrl} name={thread.peerName} size="sm" frameClassName="border border-white/15" /><span className="min-w-0 flex-1"><span className="flex justify-between gap-2"><span className="truncate text-sm font-bold">{thread.peerName}</span><span className="text-[10px] text-white/40">{formatRelative(thread.lastMessageAt)}</span></span><span className="block truncate text-xs text-white/52">{thread.lastSenderId === currentUserId ? "Você" : thread.lastSenderName}: {thread.lastMessage}</span></span></button>)}{threads.length === 0 ? <div className="rounded-2xl border border-dashed border-white/10 px-4 py-4 text-sm text-white/48">Ainda não há conversas recentes.</div> : null}</div></div>
            <div><div className="mb-2 flex items-center justify-between px-1 text-[10px] font-black uppercase tracking-[0.22em] text-white/40"><span className="inline-flex items-center gap-2"><FiUsers size={12} /> Usuários visíveis</span><span>{filteredContacts.length}</span></div><div className="space-y-1.5">{loadingContacts ? <div className="px-4 py-4 text-sm text-white/48">Carregando contatos...</div> : filteredContacts.map((contact) => <ContactRow key={contact.id} contact={contact} active={contact.id === selectedPeerId} recent={recentIds.has(contact.id)} onSelect={openConversation} />)}</div></div>
          </div>
        </aside>

        <button
          type="button"
          aria-label="Ajustar largura da coluna de conversas"
          title="Ajustar largura"
          className="qc-chat-sidebar-resizer"
          onPointerDown={startChatSidebarResize}
        >
          <span>↔</span>
        </button>

        <main className="relative flex min-h-0 flex-col" onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={handleDrop}>
          {dragging ? <div className="pointer-events-none absolute inset-4 z-30 flex items-center justify-center rounded-[32px] border-2 border-dashed border-(--tc-accent) bg-slate-950/70 text-white"><div className="text-center"><FiUploadCloud size={42} className="mx-auto mb-3" /><div className="text-lg font-black">Solte aqui para anexar</div><div className="text-sm text-white/70">Imagem, GIF, PDF ou TXT até 10 MB</div></div></div> : null}
          <header className="flex min-h-[88px] items-center justify-between gap-4 border-b border-(--tc-border) bg-(--tc-surface)/90 px-5 py-4">
            <div className="flex min-w-0 items-center gap-4"><UserAvatar src={selectedAvatar} name={selectedName} size="lg" frameClassName="border border-(--tc-border)" /><div className="min-w-0"><h1 className="truncate text-2xl font-black tracking-[-0.04em]">{selectedName}</h1><div className="mt-1 truncate text-xs text-(--tc-text-muted)">{selectedContact?.user ? `@${selectedContact.user}` : selectedThread?.peerHandle ? `@${selectedThread.peerHandle}` : "Busque uma pessoa na lateral para começar"}{selectedCompany ? ` • ${selectedCompany}` : ""}</div></div></div>
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
                    />; }) : <div className="flex min-h-[42vh] flex-col items-center justify-center text-center"><FiInbox size={32} className="text-(--tc-text-muted)" /><h3 className="mt-4 text-2xl font-black">Conversa</h3><p className="mt-2 text-sm text-(--tc-text-muted)">Use mensagens, arquivos, GIFs e reações para conversar.</p></div> : <div className="flex min-h-full flex-col items-center justify-center text-center"><FiUsers size={34} className="text-(--tc-text-muted)" /><h3 className="mt-4 text-3xl font-black tracking-[-0.05em]">Selecione uma conversa</h3><p className="mt-2 max-w-xl text-sm text-(--tc-text-muted)">A conversa usa o espaço inteiro, com bolhas, anexos, GIFs, figurinhas e notificações.</p></div>}<div ref={messagesEndRef} /></div></div>
          <form onSubmit={sendMessage} className="border-t border-(--tc-border) bg-(--tc-surface)/94 px-5 py-4">
              <div className="qc-chat-composer-one-plus">
                <button
                  type="button"
                  onClick={() => setChatActionTarget("composer")}
                  disabled={!selectedPeerId || sending}
                  aria-label="Abrir opções da conversa"
                  title="Abrir opções"
                >
                  <FiPlus size={16} />
                  <span>Opções</span>
                </button>
              </div>
              <div className="qc-chat-composer-modal-actions">
                <button type="button" data-qc-chat-action="open-message-tools" disabled={!selectedPeerId || sending}>
                  <span>✨</span> GIFs, ícones e figuras
                </button>
                <button type="button" data-qc-chat-action="open-reaction-tools" disabled={!selectedPeerId || sending}>
                  <span>👍</span> Reagir
                </button>
              </div>
            <input ref={fileInputRef} type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,text/plain" className="hidden" onChange={handleFileChange} />
            <div className="w-full">{pendingAttachments.length > 0 ? <div className="mb-3 flex gap-2 overflow-x-auto">{pendingAttachments.map((attachment, index) => <AttachmentView key={attachment.id ?? index} attachment={attachment} removable onRemove={() => setPendingAttachments((items) => items.filter((_, i) => i !== index))} />)}</div> : null}
              <div className="mb-3 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <button type="button" disabled={!selectedPeerId || sending} onClick={() => setToolsOpen((value) => !value)} className="inline-flex items-center gap-2 rounded-full border border-(--tc-border) bg-(--tc-surface-2) px-4 py-2 text-xs font-black text-(--tc-text-primary) disabled:opacity-50">
                    <FiSmile size={14} /> Reações
                  </button>
                  <span className="text-[11px] text-(--tc-text-muted)">Anexe arquivos no clipe ou arraste para a conversa.</span>
                </div>
                {toolsOpen ? (
                  <div data-qc-chat-tools-panel className="grid max-h-48 grid-cols-4 gap-2 overflow-y-auto rounded-[24px] border border-(--tc-border) bg-(--tc-surface-2) p-3 sm:grid-cols-6 lg:grid-cols-8">
                    {QUICK_REACTIONS.map((reaction) => (
                      <button key={reaction} type="button" disabled={!selectedPeerId || sending} onClick={() => void sendSticker(reaction)} className="flex h-12 items-center justify-center rounded-2xl border border-(--tc-border) bg-(--tc-surface) text-lg transition hover:scale-[1.03] disabled:opacity-50">
                        {reaction}
                      </button>
                    ))}
                    {QUICK_GIFS.map((gif) => (
                      <button key={gif.label} type="button" disabled={!selectedPeerId || sending} onClick={() => void sendGif(gif)} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-(--tc-border) bg-(--tc-surface) px-3 text-xs font-bold transition hover:scale-[1.03] disabled:opacity-50">
                        <FiImage size={12} /> {gif.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="flex items-end gap-3 rounded-[28px] border border-(--tc-border) bg-(--tc-surface-2) p-2"><button type="button" onClick={() => fileInputRef.current?.click()} disabled={!selectedPeerId || uploading} className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-(--tc-border) bg-(--tc-surface)">{uploading ? <FiRefreshCw className="animate-spin" /> : <FiPaperclip />}</button><textarea value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event: KeyboardEvent<HTMLTextAreaElement>) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }} placeholder={selectedPeerId ? `Enviar mensagem para ${selectedName}...` : "Escolha uma pessoa para começar"} rows={1} disabled={!selectedPeerId || sending} className="max-h-36 min-h-12 flex-1 resize-none bg-transparent px-1 py-3 text-sm leading-6 outline-none placeholder:text-(--tc-text-muted)" /><button type="submit" disabled={!selectedPeerId || sending || uploading || (!message.trim() && pendingAttachments.length === 0)} className="inline-flex h-12 shrink-0 items-center gap-2 rounded-full bg-(--tc-accent) px-5 text-sm font-black text-white disabled:opacity-50"><FiSend size={16} /> Enviar</button></div>
              <div className="mt-2 flex justify-between px-2 text-[11px] text-(--tc-text-muted)"><span>Enter envia, Shift+Enter quebra linha. Arraste arquivos para anexar.</span><span>{uploading ? "Anexando..." : "Imagem, GIF, PDF ou TXT"}</span></div></div>
          </form>
        </main>
      </section>
    </div>
  );
}
