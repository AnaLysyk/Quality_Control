"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import {
  FiChevronRight,
  FiInbox,
  FiMessageSquare,
  FiRefreshCw,
  FiSearch,
  FiSend,
  FiUsers,
  FiX,
} from "react-icons/fi";

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
  createdAt: string;
};

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

function getContactRoleLabel(contact: ChatContact) {
  const value = (contact.profile_kind ?? contact.permission_role ?? "").toLowerCase();
  if (value === "leader_tc") return "Lider TC";
  if (value === "technical_support") return "Suporte tecnico";
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
    ? "Suporte tecnico, lider TC e admin veem todos os usuarios."
    : "Os demais perfis veem apenas usuarios das empresas vinculadas.";
}

function Chip({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "accent" | "soft";
}) {
  const className =
    tone === "accent"
      ? "border-[rgba(239,0,1,0.22)] bg-[rgba(239,0,1,0.08)] text-(--tc-accent)"
      : tone === "soft"
        ? "border-(--tc-border) bg-(--tc-surface-2) text-(--tc-text-primary)"
        : "border-(--tc-border) bg-(--tc-surface) text-(--tc-text-muted)";

  return (
    <span className={`inline-flex max-w-full items-center rounded-full border px-3 py-1 text-[11px] font-semibold ${className}`}>
      <span className="truncate">{children}</span>
    </span>
  );
}

function MetricCard({
  label,
  value,
  note,
  accent = false,
}: {
  label: string;
  value: string | number;
  note: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-[22px] border p-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)] ${
        accent ? "border-[rgba(239,0,1,0.22)] bg-[linear-gradient(135deg,rgba(1,24,72,0.08),rgba(239,0,1,0.08))]" : "border-(--tc-border) bg-(--tc-surface)"
      }`}
    >
      <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-(--tc-text-muted)">{label}</div>
      <div className="mt-2 truncate text-[1.45rem] font-black tracking-[-0.04em] text-(--tc-text-primary)">{value}</div>
      <div className="mt-2 text-xs leading-5 text-(--tc-text-muted)">{note}</div>
    </div>
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
      className={`group flex w-full items-center gap-3 rounded-[22px] border px-3 py-3 text-left transition ${
        active
          ? "border-[rgba(239,0,1,0.22)] bg-[linear-gradient(135deg,rgba(1,24,72,0.08),rgba(239,0,1,0.08))] shadow-[0_14px_28px_rgba(15,23,42,0.08)]"
          : "border-(--tc-border) bg-(--tc-surface) hover:border-[rgba(239,0,1,0.16)] hover:bg-(--tc-surface-2)"
      }`}
    >
      <UserAvatar
        src={contact.avatar_url}
        name={contact.name}
        size="sm"
        className="shrink-0"
        frameClassName="border border-(--tc-border)"
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold leading-5 text-(--tc-text-primary)">{contact.name}</div>
            <div className="truncate text-xs leading-5 text-(--tc-text-muted)">{getContactSubtitle(contact)}</div>
          </div>
          {recent ? <Chip tone="soft">Recente</Chip> : null}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Chip tone={active ? "accent" : "neutral"}>{getContactRoleLabel(contact)}</Chip>
          <Chip tone="neutral">{contact.active ? "Ativo" : "Inativo"}</Chip>
          {getCompanySummary(contact) ? <Chip tone="neutral">{getCompanySummary(contact) ?? ""}</Chip> : null}
        </div>
      </div>

      <FiChevronRight className="shrink-0 text-(--tc-text-muted) group-hover:text-(--tc-text-primary)" size={16} />
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
      className={`group flex w-full items-center gap-3 rounded-[22px] border px-3 py-3 text-left transition ${
        active
          ? "border-[rgba(239,0,1,0.22)] bg-[linear-gradient(135deg,rgba(1,24,72,0.08),rgba(239,0,1,0.08))] shadow-[0_14px_28px_rgba(15,23,42,0.08)]"
          : "border-(--tc-border) bg-(--tc-surface) hover:border-[rgba(239,0,1,0.16)] hover:bg-(--tc-surface-2)"
      }`}
    >
      <UserAvatar
        src={contact?.avatar_url ?? summary.peerAvatarUrl}
        name={contact?.name ?? summary.peerName}
        size="sm"
        className="shrink-0"
        frameClassName="border border-(--tc-border)"
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold leading-5 text-(--tc-text-primary)">
              {contact?.name ?? summary.peerName}
            </div>
            <div className="truncate text-xs leading-5 text-(--tc-text-muted)">{summary.messageCount} mensagem{summary.messageCount === 1 ? "" : "s"}</div>
          </div>
          <Chip tone="neutral">{formatRelative(summary.lastMessageAt)}</Chip>
        </div>

        <div className="mt-2 truncate text-xs leading-5 text-(--tc-text-muted)">
          <span className="font-semibold text-(--tc-text-primary)">{senderLabel}:</span> {summary.lastMessage}
        </div>
      </div>

      <FiChevronRight className="shrink-0 text-(--tc-text-muted) group-hover:text-(--tc-text-primary)" size={16} />
    </button>
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
  return (
    <div className={`flex items-end gap-3 ${mine ? "justify-end" : "justify-start"}`}>
      {!mine ? (
        <UserAvatar
          src={avatarSrc}
          name={avatarName}
          size="sm"
          className="shrink-0"
          frameClassName="border border-(--tc-border)"
        />
      ) : null}

      <div
        className={`max-w-[min(38rem,82%)] rounded-[26px] border px-4 py-3 shadow-[0_12px_28px_rgba(15,23,42,0.08)] ${
          mine
            ? "border-[rgba(1,24,72,0.3)] bg-[linear-gradient(135deg,#011848_0%,#0b2b66_100%)] text-white"
            : "border-(--tc-border) bg-(--tc-surface) text-(--tc-text-primary)"
        }`}
      >
        <div className={`flex items-center justify-between gap-3 text-xs font-semibold ${mine ? "text-white/74" : "text-(--tc-text-muted)"}`}>
          <span className="truncate">{mine ? "Voce" : message.senderName}</span>
          <span className="shrink-0">{formatClock(message.createdAt)}</span>
        </div>
        <p className={`mt-2 whitespace-pre-wrap text-sm leading-6 ${mine ? "text-white" : "text-(--tc-text-primary)"}`}>{message.text}</p>
      </div>

      {mine ? (
        <UserAvatar
          src={avatarSrc}
          name={avatarName}
          size="sm"
          className="shrink-0"
          frameClassName="border border-(--tc-border)"
        />
      ) : null}
    </div>
  );
}

function SectionHeader({
  icon,
  title,
  count,
  action,
}: {
  icon: ReactNode;
  title: string;
  count?: number;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-(--tc-text-muted)">
        {icon}
        {title}
        {typeof count === "number" ? <span className="tracking-normal text-(--tc-text-muted)">({count})</span> : null}
      </div>
      {action}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,var(--page-bg)_0%,var(--page-grad-2)_100%)] px-4 py-5 text-(--tc-text-primary) sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <div className="rounded-[30px] border border-(--tc-border) bg-(--tc-surface) p-5 shadow-[0_18px_44px_rgba(15,23,42,0.08)] sm:p-6">
          <div className="h-1 rounded-full bg-(--tc-brand-gradient)" />
          <div className="mt-5 h-7 w-40 animate-pulse rounded-full bg-(--tc-surface-2)" />
          <div className="mt-3 h-12 w-full max-w-3xl animate-pulse rounded-[20px] bg-(--tc-surface-2)" />
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-28 animate-pulse rounded-[22px] border border-(--tc-border) bg-(--tc-surface-2)" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ChatWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuthUser();
  const { activeClient } = useClientContext();
  const activeIdentity = resolveActiveIdentity({ user, activeCompany: activeClient });
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const contactsAbortRef = useRef<AbortController | null>(null);
  const threadsAbortRef = useRef<AbortController | null>(null);
  const messagesAbortRef = useRef<AbortController | null>(null);

  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [threads, setThreads] = useState<ChatThreadSummary[]>([]);
  const [selectedPeerId, setSelectedPeerId] = useState<string | null>(() => searchParams.get("peer")?.trim() || null);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [threadsLoading, setThreadsLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [threadError, setThreadError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, router, user]);

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
        error?: string;
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
    setMessage("");
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

  const recentContactIds = useMemo(() => new Set(threads.map((thread) => thread.peerId)), [threads]);
  const recentThreads = useMemo(() => threads.slice(0, 6), [threads]);
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
      if (!selectedPeerId || !message.trim() || sending) return;

      setSending(true);
      setThreadError(null);
      try {
        const response = await fetchApi("/api/chat/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ peerId: selectedPeerId, text: message.trim() }),
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
        await Promise.all([loadMessages(selectedPeerId), loadThreads()]);
      } catch (err) {
        setThreadError(err instanceof Error ? err.message : "Nao foi possivel enviar a mensagem.");
      } finally {
        setSending(false);
      }
    },
    [loadMessages, loadThreads, message, router, sending, selectedPeerId],
  );

  const selectedPeerAvatar = selectedContact?.avatar_url ?? selectedThreadSummary?.peerAvatarUrl ?? null;
  const selectedPeerName = selectedContact?.name ?? selectedThreadSummary?.peerName ?? "Selecione um usuario";
  const selectedPeerHandle =
    selectedContact?.user ? `@${selectedContact.user}` : selectedThreadSummary?.peerHandle ? `@${selectedThreadSummary.peerHandle}` : null;
  const selectedPeerCompany = selectedContact ? getCompanySummary(selectedContact) : null;
  const selectedThreadPreview = selectedThreadSummary
    ? `${selectedThreadSummary.lastSenderId === currentUserId ? "Voce" : selectedThreadSummary.lastSenderName}: ${selectedThreadSummary.lastMessage}`
    : "";
  const canSeeAllContacts = activeIdentity.roleKind === "global" || activeIdentity.roleKind === "leader_tc";

  if (loading && !user) {
    return <LoadingSkeleton />;
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,var(--page-bg)_0%,var(--page-grad-2)_100%)] px-4 py-5 text-(--tc-text-primary) sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <section className="overflow-hidden rounded-[30px] border border-(--tc-border) bg-(--tc-surface) shadow-[0_18px_44px_rgba(15,23,42,0.08)]">
          <div className="h-1 bg-(--tc-brand-gradient)" />

          <div className="flex flex-col gap-4 p-5 sm:p-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-[22px] border border-(--tc-border) bg-(--tc-surface-2)">
                <Image src="/images/tc.png" alt="Quality Control" width={56} height={56} className="h-12 w-12 object-contain" />
              </div>

              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-(--tc-text-muted)">Chatcode</p>
                <h1 className="mt-1 text-[2rem] font-black tracking-[-0.05em] text-(--tc-text-primary) sm:text-[2.15rem]">
                  Conversas por usuario
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-(--tc-text-muted)">
                  Busque uma pessoa pelo nome, abra a conversa certa e acompanhe o fluxo com fotos, identidade da
                  plataforma e respostas por usuario.
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Chip tone={canSeeAllContacts ? "accent" : "neutral"}>{scopeLabel}</Chip>
                  <Chip tone="neutral">{visibleContactsCount} contatos</Chip>
                  <Chip tone="neutral">{threads.length} conversas</Chip>
                </div>

                <p className="mt-3 text-xs leading-5 text-(--tc-text-muted)">{scopeNote}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void loadContacts()}
                className="inline-flex items-center gap-2 rounded-full border border-(--tc-border) bg-(--tc-surface-2) px-4 py-2.5 text-sm font-semibold text-(--tc-text-primary) transition hover:border-[rgba(239,0,1,0.2)] hover:bg-(--tc-surface)"
              >
                <FiRefreshCw size={14} className={contactsLoading ? "animate-spin" : ""} />
                Atualizar contatos
              </button>
              <button
                type="button"
                onClick={() => void loadThreads()}
                className="inline-flex items-center gap-2 rounded-full border border-(--tc-border) bg-(--tc-surface-2) px-4 py-2.5 text-sm font-semibold text-(--tc-text-primary) transition hover:border-[rgba(239,0,1,0.2)] hover:bg-(--tc-surface)"
              >
                <FiRefreshCw size={14} className={threadsLoading ? "animate-spin" : ""} />
                Atualizar conversas
              </button>
            </div>
          </div>

          <div className="grid gap-3 border-t border-(--tc-border) bg-(--tc-surface-2) p-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Contatos visiveis"
              value={contactsLoading ? "..." : visibleContactsCount}
              note={search.trim() ? `Filtrados por "${search.trim()}"` : `${activeContactsCount} ativos`}
            />
            <MetricCard
              label="Conversas recentes"
              value={threadsLoading ? "..." : recentThreads.length}
              note="Atalhos por pessoa"
            />
            <MetricCard label="Escopo" value={scopeLabel} note={scopeNote} accent />
            <MetricCard
              label="Mensagens"
              value={messagesLoading ? "..." : messages.length}
              note={selectedPeerId ? "Conversa aberta" : "Nenhuma conversa aberta"}
            />
          </div>
        </section>

        <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="flex min-w-0 flex-col gap-4 rounded-[28px] border border-(--tc-border) bg-(--tc-surface) p-4 shadow-[0_20px_48px_rgba(15,23,42,0.08)]">
            <section className="rounded-[24px] border border-(--tc-border) bg-(--tc-surface-2) p-4">
              <div className="flex items-center gap-3">
                <UserAvatar
                  src={activeIdentity.avatarUrl}
                  name={activeIdentity.displayName}
                  size="md"
                  className="shrink-0"
                  frameClassName="border border-(--tc-border)"
                />

                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-(--tc-text-primary)">{activeIdentity.displayName}</div>
                  <div className="truncate text-xs text-(--tc-text-muted)">
                    {activeIdentity.username ? `@${activeIdentity.username}` : activeIdentity.email ?? "Conta autenticada"}
                  </div>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Chip tone={canSeeAllContacts ? "accent" : "neutral"}>{scopeLabel}</Chip>
                {activeIdentity.companyTagLabel ? <Chip tone="neutral">{activeIdentity.companyTagLabel}</Chip> : null}
              </div>

              <p className="mt-3 text-xs leading-5 text-(--tc-text-muted)">
                Digite um nome para encontrar a pessoa certa e abrir a conversa em poucos cliques.
              </p>
            </section>

            <section className="rounded-[24px] border border-(--tc-border) bg-(--tc-surface-2) p-4">
              <label className="flex flex-col gap-2 text-sm text-(--tc-text-primary)">
                <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-(--tc-text-muted)">Buscar usuario</span>
                <div className="relative">
                  <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-(--tc-text-muted)" size={15} />
                  <input
                    ref={searchInputRef}
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    placeholder="Digite o nome do usuario"
                    className="w-full rounded-[18px] border border-(--tc-border) bg-(--tc-input-bg,#eef4ff) py-3 pl-10 pr-3 text-sm text-(--tc-text-primary) outline-none transition placeholder:text-(--tc-text-muted) focus:border-(--tc-accent) focus:ring-2 focus:ring-[rgba(239,0,1,0.12)]"
                  />
                </div>
              </label>
            </section>

            {error ? (
              <div className="rounded-[22px] border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                {error}
              </div>
            ) : null}

            <section className="rounded-[24px] border border-(--tc-border) bg-(--tc-surface-2) p-4">
              <SectionHeader
                icon={<FiInbox size={14} />}
                title="Recentes"
                count={recentThreads.length}
                action={
                  <button
                    type="button"
                    onClick={() => void loadThreads()}
                    className="inline-flex items-center gap-2 rounded-full border border-(--tc-border) bg-(--tc-surface) px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-(--tc-text-muted) transition hover:border-[rgba(239,0,1,0.18)] hover:text-(--tc-text-primary)"
                  >
                    <FiRefreshCw size={11} className={threadsLoading ? "animate-spin" : ""} />
                    Atualizar
                  </button>
                }
              />

              <div className="space-y-2">
                {threadsLoading ? (
                  <div className="rounded-[20px] border border-dashed border-(--tc-border) bg-(--tc-surface) px-4 py-5 text-sm text-(--tc-text-muted)">
                    Carregando conversas...
                  </div>
                ) : recentThreads.length > 0 ? (
                  recentThreads.map((summary) => {
                    const contact = contactsById.get(summary.peerId) ?? null;
                    return (
                      <ThreadRow
                        key={summary.key}
                        summary={summary}
                        contact={contact}
                        active={summary.peerId === selectedPeerId}
                        currentUserId={currentUserId}
                        onSelect={openConversation}
                      />
                    );
                  })
                ) : (
                  <div className="rounded-[20px] border border-dashed border-(--tc-border) bg-(--tc-surface) px-4 py-5 text-sm text-(--tc-text-muted)">
                    Ainda nao ha conversas recentes.
                  </div>
                )}
              </div>
            </section>

            <section className="min-h-0 flex-1 rounded-[24px] border border-(--tc-border) bg-(--tc-surface-2) p-4">
              <SectionHeader icon={<FiUsers size={14} />} title="Usuarios da plataforma" count={visibleContactsCount} />

              <div className="max-h-[28rem] space-y-2 overflow-y-auto pr-1">
                {contactsLoading ? (
                  <div className="rounded-[20px] border border-dashed border-(--tc-border) bg-(--tc-surface) px-4 py-5 text-sm text-(--tc-text-muted)">
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
                  <div className="rounded-[20px] border border-dashed border-(--tc-border) bg-(--tc-surface) px-4 py-5 text-sm text-(--tc-text-muted)">
                    Nenhum usuario encontrado para &quot;{search.trim()}&quot;.
                  </div>
                ) : (
                  <div className="rounded-[20px] border border-dashed border-(--tc-border) bg-(--tc-surface) px-4 py-5 text-sm text-(--tc-text-muted)">
                    Digite um nome para iniciar uma conversa.
                  </div>
                )}
              </div>
            </section>
          </aside>

          <main className="flex min-w-0 flex-col gap-4">
            <section className="rounded-[28px] border border-(--tc-border) bg-(--tc-surface) p-4 shadow-[0_20px_48px_rgba(15,23,42,0.08)] sm:p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex min-w-0 items-center gap-4">
                  <UserAvatar
                    src={selectedPeerAvatar}
                    name={selectedPeerName}
                    size="lg"
                    className="shrink-0"
                    frameClassName="border border-(--tc-border)"
                  />

                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-(--tc-text-muted)">Conversa atual</p>
                    <h2 className="mt-1 truncate text-2xl font-black tracking-[-0.04em] text-(--tc-text-primary)">
                      {selectedPeerName}
                    </h2>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-(--tc-text-muted)">
                      {selectedPeerHandle ? <span>{selectedPeerHandle}</span> : null}
                      {selectedPeerCompany ? <span>| {selectedPeerCompany}</span> : null}
                      {selectedThreadSummary ? <span>| {selectedThreadSummary.messageCount} mensagens</span> : null}
                    </div>
                    <p className="mt-3 max-w-2xl text-xs leading-5 text-(--tc-text-muted)">
                      {selectedThreadPreview || "Sem mensagens nesta conversa ainda. Envie a primeira mensagem."}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={clearConversation}
                    className="inline-flex items-center gap-2 rounded-full border border-(--tc-border) bg-(--tc-surface-2) px-4 py-2 text-sm font-semibold text-(--tc-text-primary) transition hover:border-[rgba(239,0,1,0.18)] hover:bg-(--tc-surface)"
                  >
                    <FiX size={14} />
                    Trocar usuario
                  </button>
                  <button
                    type="button"
                    onClick={() => void loadMessages(selectedPeerId)}
                    disabled={!selectedPeerId}
                    className="inline-flex items-center gap-2 rounded-full border border-(--tc-border) bg-(--tc-surface-2) px-4 py-2 text-sm font-semibold text-(--tc-text-primary) transition hover:border-[rgba(239,0,1,0.18)] hover:bg-(--tc-surface) disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <FiRefreshCw size={14} className={messagesLoading ? "animate-spin" : ""} />
                    Atualizar conversa
                  </button>
                </div>
              </div>
            </section>

            <section className="flex min-h-[32rem] flex-1 min-h-0 flex-col overflow-hidden rounded-[28px] border border-(--tc-border) bg-(--tc-surface)">
              <div className="flex items-center justify-between gap-3 border-b border-(--tc-border) bg-(--tc-surface-2) px-4 py-4 sm:px-5">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-(--tc-text-muted)">
                  <FiMessageSquare size={14} />
                  Mensagens
                </div>

                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-(--tc-text-muted)">
                  {messagesLoading ? "Carregando..." : `${messages.length} mensagem${messages.length === 1 ? "" : "s"}`}
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5">
                {threadError ? (
                  <div className="mb-4 rounded-[20px] border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                    {threadError}
                  </div>
                ) : null}

                {selectedPeerId ? (
                  <div className="space-y-4">
                    {messagesLoading && messages.length === 0 ? (
                      <div className="space-y-3">
                        {Array.from({ length: 3 }).map((_, index) => (
                          <div
                            key={index}
                            className={`flex items-end gap-3 ${index % 2 === 0 ? "justify-start" : "justify-end"}`}
                          >
                            <div className="h-10 w-10 animate-pulse rounded-full bg-(--tc-surface-2)" />
                            <div className="h-20 w-[min(28rem,70%)] animate-pulse rounded-[26px] bg-(--tc-surface-2)" />
                          </div>
                        ))}
                      </div>
                    ) : messages.length > 0 ? (
                      messages.map((item) => {
                        const isMine = item.senderId === currentUserId;
                        const bubbleAvatar = isMine ? activeIdentity.avatarUrl : selectedPeerAvatar;
                        const bubbleName = isMine ? activeIdentity.displayName : selectedPeerName;

                        return (
                          <MessageBubble
                            key={item.id}
                            message={item}
                            mine={isMine}
                            avatarSrc={bubbleAvatar}
                            avatarName={bubbleName}
                          />
                        );
                      })
                    ) : (
                      <div className="flex min-h-[24rem] flex-col items-center justify-center rounded-[26px] border border-dashed border-(--tc-border) bg-(--tc-surface-2) px-6 text-center">
                        <div className="flex h-16 w-16 items-center justify-center rounded-[24px] border border-(--tc-border) bg-(--tc-surface)">
                          <FiInbox size={24} className="text-(--tc-text-muted)" />
                        </div>
                        <h3 className="mt-4 text-xl font-bold text-(--tc-text-primary)">Abra uma conversa</h3>
                        <p className="mt-2 max-w-md text-sm leading-6 text-(--tc-text-muted)">
                          Busque um usuario na lateral, clique no nome e comece a escrever. A conversa fica organizada por pessoa.
                        </p>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                ) : (
                  <div className="flex min-h-[30rem] flex-1 flex-col items-center justify-center rounded-[26px] border border-dashed border-(--tc-border) bg-(--tc-surface-2) px-6 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-[24px] border border-(--tc-border) bg-(--tc-surface)">
                      <FiUsers size={24} className="text-(--tc-text-muted)" />
                    </div>
                    <h3 className="mt-4 text-2xl font-black tracking-[-0.04em] text-(--tc-text-primary)">
                      Digite o nome de um usuario
                    </h3>
                    <p className="mt-2 max-w-xl text-sm leading-6 text-(--tc-text-muted)">
                      Quando voce escolher um contato, a conversa abre na hora com foto, nome e a identidade da plataforma.
                    </p>
                  </div>
                )}
              </div>
            </section>

            <form
              onSubmit={sendMessage}
              className="rounded-[28px] border border-(--tc-border) bg-(--tc-surface) p-4 shadow-[0_20px_48px_rgba(15,23,42,0.08)] sm:p-5"
            >
              <div className="flex items-start gap-4">
                <UserAvatar
                  src={activeIdentity.avatarUrl}
                  name={activeIdentity.displayName}
                  size="md"
                  className="shrink-0"
                  frameClassName="border border-(--tc-border)"
                />

                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-(--tc-text-primary)">{activeIdentity.displayName}</div>
                      <div className="truncate text-xs text-(--tc-text-muted)">
                        {selectedPeerId ? `Escrevendo para ${selectedPeerName}` : "Selecione um usuario para enviar mensagem"}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void loadMessages(selectedPeerId)}
                      disabled={!selectedPeerId}
                      className="inline-flex items-center gap-2 rounded-full border border-(--tc-border) bg-(--tc-surface-2) px-3 py-2 text-xs font-semibold text-(--tc-text-primary) transition hover:border-[rgba(239,0,1,0.18)] hover:bg-(--tc-surface) disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <FiRefreshCw size={12} className={messagesLoading ? "animate-spin" : ""} />
                      Recarregar
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
                    placeholder={selectedPeerId ? `Escreva para ${selectedPeerName}...` : "Escolha um usuario para começar"}
                    rows={3}
                    disabled={!selectedPeerId || sending}
                    className="w-full resize-none rounded-[24px] border border-(--tc-border) bg-(--tc-input-bg,#eef4ff) px-4 py-4 text-sm leading-6 text-(--tc-text-primary) outline-none transition placeholder:text-(--tc-text-muted) focus:border-(--tc-accent) focus:ring-2 focus:ring-[rgba(239,0,1,0.12)] disabled:cursor-not-allowed disabled:opacity-70"
                  />
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xs leading-5 text-(--tc-text-muted)">
                  Dica: pressione Enter para enviar e Shift+Enter para quebrar linha.
                </div>
                <div className="flex items-center gap-3">
                  {sending ? <span className="text-xs font-semibold uppercase tracking-[0.18em] text-(--tc-text-muted)">Enviando...</span> : null}
                  <button
                    type="submit"
                    disabled={!selectedPeerId || !message.trim() || sending}
                    className="inline-flex items-center gap-2 rounded-full bg-(--tc-accent) px-5 py-3 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <FiSend size={14} />
                    Enviar mensagem
                  </button>
                </div>
              </div>
            </form>
          </main>
        </div>
      </div>
    </div>
  );
}
