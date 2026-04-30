"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import {
  FiClock,
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

function ContactCard({
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
          ? "border-white/20 bg-white/14 text-white shadow-[0_14px_30px_rgba(1,24,72,0.26)]"
          : "border-white/10 bg-white/6 text-white/82 hover:border-white/18 hover:bg-white/10 hover:text-white"
      }`}
    >
      <UserAvatar
        src={contact.avatar_url}
        name={contact.name}
        size="sm"
        className="shrink-0"
        frameClassName={active ? "border border-white/18" : "border border-white/10"}
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold leading-5">{contact.name}</div>
            <div className="truncate text-xs leading-5 text-white/62">{getContactSubtitle(contact)}</div>
          </div>
          {recent ? (
            <span className="inline-flex rounded-full border border-white/12 bg-white/8 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/72">
              Recente
            </span>
          ) : null}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="inline-flex rounded-full border border-white/10 bg-white/8 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/72">
            {getContactRoleLabel(contact)}
          </span>
          {getCompanySummary(contact) ? (
            <span className="inline-flex max-w-full rounded-full border border-white/10 bg-white/8 px-2.5 py-1 text-[10px] font-semibold text-white/72">
              <span className="truncate">{getCompanySummary(contact)}</span>
            </span>
          ) : null}
        </div>
      </div>

      <FiMessageSquare className="shrink-0 text-white/40 group-hover:text-white" size={16} />
    </button>
  );
}

function ThreadPreview({
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
      className={`group flex w-full items-center gap-3 rounded-[22px] border px-3 py-3 text-left transition ${
        active
          ? "border-white/20 bg-white/14 text-white shadow-[0_14px_30px_rgba(1,24,72,0.26)]"
          : "border-white/10 bg-white/6 text-white/82 hover:border-white/18 hover:bg-white/10 hover:text-white"
      }`}
    >
      <UserAvatar
        src={contact?.avatar_url ?? summary.peerAvatarUrl}
        name={contact?.name ?? summary.peerName}
        size="sm"
        className="shrink-0"
        frameClassName={active ? "border border-white/18" : "border border-white/10"}
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold leading-5">{contact?.name ?? summary.peerName}</div>
            <div className="truncate text-xs leading-5 text-white/62">
              {summary.messageCount} mensagem{summary.messageCount === 1 ? "" : "s"}
            </div>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full border border-white/12 bg-white/8 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/72">
            <FiClock size={10} />
            {formatRelative(summary.lastMessageAt)}
          </span>
        </div>
        <div className="mt-2 truncate text-xs leading-5 text-white/72">
          <span className="font-semibold text-white/88">{label}:</span> {summary.lastMessage}
        </div>
      </div>

      <FiChevronRight className="shrink-0 text-white/40 group-hover:text-white" size={16} />
    </button>
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

  const quickMatches = useMemo(() => filteredContacts.slice(0, 5), [filteredContacts]);

  const recentContactIds = useMemo(() => new Set(threads.map((thread) => thread.peerId)), [threads]);
  const recentThreads = useMemo(() => threads.slice(0, 6), [threads]);
  const currentUserId = user?.id ?? "";

  const openConversation = useCallback(
    (peerId: string) => {
      setSelectedPeerId(peerId);
      setMessage("");
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

  const activePeerAvatar =
    selectedContact?.avatar_url ?? selectedThreadSummary?.peerAvatarUrl ?? null;
  const activePeerName =
    selectedContact?.name ?? selectedThreadSummary?.peerName ?? "Selecione um usuario";
  const activePeerHandle = selectedContact?.user ? `@${selectedContact.user}` : selectedThreadSummary?.peerHandle ? `@${selectedThreadSummary.peerHandle}` : null;
  const activePeerCompany = selectedContact ? getCompanySummary(selectedContact) : null;
  const selectedThreadPreview = selectedThreadSummary
    ? `${selectedThreadSummary.lastSenderId === currentUserId ? "Você" : selectedThreadSummary.lastSenderName}: ${selectedThreadSummary.lastMessage}`
    : "";

  if (loading && !user) {
    return (
      <div className="min-h-screen bg-[#07101d] px-4 py-8 text-white">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-[32px] border border-white/10 bg-white/8 p-6">
            <div className="h-8 w-40 animate-pulse rounded-full bg-white/10" />
            <div className="mt-4 h-12 w-72 animate-pulse rounded-2xl bg-white/10" />
            <div className="mt-3 h-4 w-full max-w-2xl animate-pulse rounded-full bg-white/10" />
          </div>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(239,0,1,0.16),transparent_28%),radial-gradient(circle_at_top_right,rgba(10,31,82,0.35),transparent_30%),linear-gradient(180deg,#07111f_0%,#081325_42%,#040b16_100%)] px-4 py-5 text-white sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <section className="overflow-hidden rounded-[34px] border border-white/10 bg-[linear-gradient(135deg,#011848_0%,#082457_34%,#4b0f2f_70%,#ef0001_100%)] px-5 py-5 shadow-[0_28px_80px_rgba(1,24,72,0.35)] sm:px-7 sm:py-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-[24px] border border-white/12 bg-white/10 shadow-[0_16px_30px_rgba(0,0,0,0.18)]">
                <Image src="/images/tc.png" alt="Quality Control" width={56} height={56} className="h-12 w-12 object-contain" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-white/72">Chatcode</p>
                <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">Conversas por usuario</h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-white/80">
                  Busque uma pessoa pelo nome, abra a conversa certa e acompanhe o fluxo com fotos, identidade da plataforma e respostas por usuario.
                </p>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[28rem]">
              <div className="rounded-2xl border border-white/12 bg-white/10 px-4 py-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/58">Contatos</div>
                <div className="mt-1 text-xl font-bold">{contacts.length}</div>
              </div>
              <div className="rounded-2xl border border-white/12 bg-white/10 px-4 py-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/58">Conversas</div>
                <div className="mt-1 text-xl font-bold">{threads.length}</div>
              </div>
              <div className="rounded-2xl border border-white/12 bg-white/10 px-4 py-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/58">Status</div>
                <div className="mt-1 text-xl font-bold">{selectedPeerId ? "Em conversa" : "Escolha um usuario"}</div>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-5 lg:grid-cols-[21rem_minmax(0,1fr)]">
          <aside className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(7,16,29,0.94)_0%,rgba(10,22,41,0.98)_100%)] p-4 shadow-[0_24px_70px_rgba(1,24,72,0.3)] backdrop-blur-2xl">
            <div className="border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <UserAvatar
                  src={activeIdentity.avatarUrl}
                  name={activeIdentity.displayName}
                  size="sm"
                  className="shrink-0"
                  frameClassName="border border-white/12"
                />
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-white">{activeIdentity.displayName}</div>
                  <div className="truncate text-xs text-white/64">
                    {activeIdentity.kind === "company" ? "Conta institucional" : activeIdentity.companyTagLabel ?? "Conta autenticada"}
                  </div>
                </div>
              </div>

              <label className="mt-4 flex items-center gap-3 rounded-[22px] border border-white/10 bg-white/6 px-4 py-3 text-sm text-white/76">
                <FiSearch className="shrink-0 text-white/48" />
                <input
                  ref={searchInputRef}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Digite o nome do usuario"
                  className="w-full bg-transparent outline-none placeholder:text-white/42"
                />
              </label>
              <p className="mt-3 text-xs leading-5 text-white/52">
                Digite um nome e pressione Enter para abrir a conversa mais relevante.
              </p>

              {error ? (
                <div className="mt-3 rounded-[22px] border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
                  {error}
                </div>
              ) : null}

              {search.trim() ? (
                <div className="mt-3 rounded-[24px] border border-white/10 bg-white/6 p-3">
                  <div className="flex items-center justify-between gap-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/52">
                    <span>Atalhos da busca</span>
                    <span>Enter abre o primeiro</span>
                  </div>
                  <div className="mt-3 space-y-2">
                    {quickMatches.length > 0 ? (
                      quickMatches.map((contact) => (
                        <button
                          key={contact.id}
                          type="button"
                          onClick={() => openConversation(contact.id)}
                          className="flex w-full items-center gap-3 rounded-[20px] border border-white/10 bg-white/6 px-3 py-2.5 text-left transition hover:border-white/18 hover:bg-white/10"
                        >
                          <UserAvatar
                            src={contact.avatar_url}
                            name={contact.name}
                            size="sm"
                            className="shrink-0"
                            frameClassName="border border-white/10"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-semibold text-white">{contact.name}</div>
                            <div className="truncate text-xs text-white/58">
                              {contact.user ? `@${contact.user}` : contact.email}
                            </div>
                          </div>
                          <FiChevronRight size={14} className="shrink-0 text-white/38" />
                        </button>
                      ))
                    ) : (
                      <div className="rounded-[20px] border border-dashed border-white/12 bg-white/5 px-4 py-4 text-sm text-white/58">
                        Nenhum resultado direto. Tente outro nome.
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="mt-4 space-y-4">
              <section>
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/54">
                    <FiInbox size={14} />
                    Recentes
                  </div>
                  <button
                    type="button"
                    onClick={() => void loadThreads()}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/72 transition hover:border-white/18 hover:bg-white/10 hover:text-white"
                  >
                    <FiRefreshCw size={12} />
                    Atualizar
                  </button>
                </div>

                <div className="space-y-2">
                  {threadsLoading ? (
                    <div className="rounded-[22px] border border-dashed border-white/12 bg-white/6 px-4 py-5 text-sm text-white/58">
                      Carregando conversas...
                    </div>
                  ) : recentThreads.length > 0 ? (
                    recentThreads.map((summary) => {
                      const contact = contactsById.get(summary.peerId) ?? null;
                      return (
                        <ThreadPreview
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
                    <div className="rounded-[22px] border border-dashed border-white/12 bg-white/6 px-4 py-5 text-sm text-white/58">
                      Ainda nao ha conversas recentes.
                    </div>
                  )}
                </div>
              </section>

              <section>
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/54">
                    <FiUsers size={14} />
                    Pessoas da plataforma
                  </div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/46">
                    {filteredContacts.length} visiveis
                  </div>
                </div>

                <div className="space-y-2">
                  {contactsLoading ? (
                    <div className="rounded-[22px] border border-dashed border-white/12 bg-white/6 px-4 py-5 text-sm text-white/58">
                      Carregando contatos...
                    </div>
                  ) : filteredContacts.length > 0 ? (
                    filteredContacts.map((contact) => (
                      <ContactCard
                        key={contact.id}
                        contact={contact}
                        active={contact.id === selectedPeerId}
                        recent={recentContactIds.has(contact.id)}
                        onSelect={openConversation}
                      />
                    ))
                  ) : search.trim() ? (
                    <div className="rounded-[22px] border border-dashed border-white/12 bg-white/6 px-4 py-5 text-sm text-white/58">
                      Nenhum usuario encontrado para {'"'}
                      {search.trim()}
                      {'"'}.
                    </div>
                  ) : (
                    <div className="rounded-[22px] border border-dashed border-white/12 bg-white/6 px-4 py-5 text-sm text-white/58">
                      Digite um nome para iniciar uma conversa.
                    </div>
                  )}
                </div>
              </section>
            </div>
          </aside>

          <main className="flex min-w-0 flex-col gap-4 rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(6,12,24,0.96)_0%,rgba(9,19,37,0.98)_100%)] p-4 shadow-[0_24px_70px_rgba(1,24,72,0.32)] backdrop-blur-2xl">
            <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,rgba(1,24,72,0.94)_0%,rgba(8,36,87,0.88)_48%,rgba(75,15,47,0.96)_100%)] px-5 py-5 text-white shadow-[0_18px_44px_rgba(1,24,72,0.28)]">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex min-w-0 items-center gap-4">
                  <UserAvatar
                    src={activePeerAvatar}
                    name={activePeerName}
                    size="lg"
                    className="shrink-0"
                    frameClassName="border border-white/14"
                  />
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/58">Conversa atual</p>
                    <h2 className="mt-1 truncate text-2xl font-extrabold tracking-tight">{activePeerName}</h2>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-white/76">
                      {activePeerHandle ? <span>{activePeerHandle}</span> : null}
                      {activePeerCompany ? <span>| {activePeerCompany}</span> : null}
                      {selectedThreadSummary ? <span>| {selectedThreadSummary.messageCount} mensagens</span> : null}
                    </div>
                    <p className="mt-3 max-w-2xl text-xs leading-5 text-white/66">
                      {selectedThreadPreview || "Sem mensagens nesta conversa ainda. Envie a primeira mensagem."}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={clearConversation}
                    className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:border-white/20 hover:bg-white/14"
                  >
                    <FiX size={14} />
                    Trocar usuario
                  </button>
                  <button
                    type="button"
                    onClick={() => void loadMessages(selectedPeerId)}
                    className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:border-white/20 hover:bg-white/14"
                    disabled={!selectedPeerId}
                  >
                    <FiRefreshCw size={14} />
                    Atualizar conversa
                  </button>
                </div>
              </div>
            </section>

            <section className="flex min-h-[32rem] flex-1 flex-col rounded-[28px] border border-white/10 bg-white/5 p-4">
              {threadError ? (
                <div className="rounded-[22px] border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                  {threadError}
                </div>
              ) : null}

              {selectedPeerId ? (
                <div className="mt-2 flex-1 overflow-hidden">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/54">
                      <FiMessageSquare size={14} />
                      Mensagens
                    </div>
                    {messagesLoading ? (
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/44">Carregando...</div>
                    ) : (
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/44">
                        {messages.length} mensagem{messages.length === 1 ? "" : "s"}
                      </div>
                    )}
                  </div>

                  <div className="max-h-[30rem] space-y-4 overflow-y-auto pr-1">
                    {messagesLoading && messages.length === 0 ? (
                      <div className="space-y-3">
                        {Array.from({ length: 3 }).map((_, index) => (
                          <div
                            key={index}
                            className={`flex items-end gap-3 ${index % 2 === 0 ? "justify-start" : "justify-end"}`}
                          >
                            <div className="h-10 w-10 animate-pulse rounded-full bg-white/10" />
                            <div className="h-20 w-[min(28rem,70%)] animate-pulse rounded-[26px] bg-white/10" />
                          </div>
                        ))}
                      </div>
                    ) : messages.length > 0 ? (
                      messages.map((item) => {
                        const isMine = item.senderId === currentUserId;
                        const bubbleAvatar = isMine ? activeIdentity.avatarUrl : activePeerAvatar;
                        const bubbleName = isMine ? activeIdentity.displayName : activePeerName;
                        return (
                          <div key={item.id} className={`flex items-end gap-3 ${isMine ? "justify-end" : "justify-start"}`}>
                            {!isMine ? (
                              <UserAvatar
                                src={bubbleAvatar}
                                name={bubbleName}
                                size="sm"
                                className="shrink-0"
                                frameClassName="border border-white/12"
                              />
                            ) : null}

                            <div
                              className={`max-w-[min(38rem,82%)] rounded-[26px] border px-4 py-3 shadow-[0_16px_32px_rgba(1,24,72,0.16)] ${
                                isMine
                                  ? "border-white/14 bg-[linear-gradient(135deg,rgba(255,255,255,0.14),rgba(255,255,255,0.08))] text-white"
                                  : "border-white/10 bg-white text-slate-900"
                              }`}
                            >
                              <div className={`flex items-center justify-between gap-3 text-xs font-semibold ${isMine ? "text-white/72" : "text-slate-600"}`}>
                                <span className="truncate">{isMine ? "Voce" : item.senderName}</span>
                                <span className="shrink-0">{formatClock(item.createdAt)}</span>
                              </div>
                              <p className={`mt-2 whitespace-pre-wrap text-sm leading-6 ${isMine ? "text-white" : "text-slate-900"}`}>
                                {item.text}
                              </p>
                            </div>

                            {isMine ? (
                              <UserAvatar
                                src={bubbleAvatar}
                                name={bubbleName}
                                size="sm"
                                className="shrink-0"
                                frameClassName="border border-white/12"
                              />
                            ) : null}
                          </div>
                        );
                      })
                    ) : (
                      <div className="flex min-h-[24rem] flex-col items-center justify-center rounded-[26px] border border-dashed border-white/12 bg-white/5 px-6 text-center">
                        <div className="flex h-16 w-16 items-center justify-center rounded-[24px] border border-white/10 bg-white/8">
                          <FiInbox size={24} className="text-white/72" />
                        </div>
                        <h3 className="mt-4 text-xl font-bold text-white">Abra uma conversa</h3>
                        <p className="mt-2 max-w-md text-sm leading-6 text-white/68">
                          Busque um usuario na lateral, clique no nome e comece a escrever. A conversa fica organizada por pessoa.
                        </p>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                </div>
              ) : (
                <div className="flex min-h-[30rem] flex-1 flex-col items-center justify-center rounded-[26px] border border-dashed border-white/12 bg-white/5 px-6 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-[24px] border border-white/10 bg-white/8">
                    <FiUsers size={24} className="text-white/72" />
                  </div>
                  <h3 className="mt-4 text-2xl font-extrabold text-white">Digite o nome de um usuario</h3>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-white/68">
                    Quando voce escolher um contato, a conversa abre na hora com foto, nome e a identidade da plataforma.
                  </p>
                  {filteredContacts.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => openConversation(filteredContacts[0].id)}
                      className="mt-5 inline-flex items-center gap-2 rounded-full bg-(--tc-accent,#ef0001) px-5 py-3 text-sm font-semibold text-white transition hover:opacity-95"
                    >
                      <FiSend size={14} />
                      Abrir {filteredContacts[0].name}
                    </button>
                  ) : null}
                </div>
              )}
            </section>

            <form
              onSubmit={sendMessage}
              className="rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.04))] p-4"
            >
              <div className="flex items-start gap-4">
                <UserAvatar
                  src={activeIdentity.avatarUrl}
                  name={activeIdentity.displayName}
                  size="md"
                  className="shrink-0"
                  frameClassName="border border-white/12"
                />

                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-white">{activeIdentity.displayName}</div>
                      <div className="truncate text-xs text-white/56">
                        {selectedPeerId ? `Escrevendo para ${activePeerName}` : "Selecione um usuario para enviar mensagem"}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void loadMessages(selectedPeerId)}
                      className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-3 py-2 text-xs font-semibold text-white/76 transition hover:border-white/18 hover:bg-white/12"
                      disabled={!selectedPeerId}
                    >
                      <FiRefreshCw size={12} />
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
                    placeholder={selectedPeerId ? `Escreva para ${activePeerName}...` : "Escolha um usuario para começar"}
                    rows={3}
                    disabled={!selectedPeerId || sending}
                    className="w-full resize-none rounded-[24px] border border-white/10 bg-white/6 px-4 py-4 text-sm leading-6 text-white outline-none placeholder:text-white/38 focus:border-white/20 focus:bg-white/8 disabled:cursor-not-allowed disabled:opacity-70"
                  />
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xs leading-5 text-white/56">
                  Dica: pressione Enter para enviar e Shift+Enter para quebrar linha.
                </div>
                <div className="flex items-center gap-3">
                  {sending ? <span className="text-xs font-semibold uppercase tracking-[0.18em] text-white/50">Enviando...</span> : null}
                  <button
                    type="submit"
                    disabled={!selectedPeerId || !message.trim() || sending}
                    className="inline-flex items-center gap-2 rounded-full bg-(--tc-accent,#ef0001) px-5 py-3 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
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
