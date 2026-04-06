"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { FiChevronRight, FiSend, FiX, FiZap } from "react-icons/fi";
import type { AssistantAction, AssistantConversationTurn, AssistantReplyPayload, AssistantToolAction } from "@/lib/assistant/types";
import { resolveAssistantScreenContext } from "@/lib/assistant/screenContext";
import { fetchApi } from "@/lib/api";
import { usePermissionAccess } from "@/hooks/usePermissionAccess";
import ConfirmDialog from "./ConfirmDialog";
import UserAvatar from "./UserAvatar";

type ChatMessage = {
  id: string;
  from: "user" | "assistant";
  text: string;
  ts: number;
  tool?: string | null;
  actions?: AssistantAction[];
};

type ConfirmState =
  | { open: false }
  | { open: true; kind: "clear" | "clearAll" }
  | { open: true; kind: "tool"; action: AssistantToolAction; label: string };

type ChatButtonProps = {
  defaultOpen?: boolean;
};

const HISTORY_KEY_PREFIX = "assistant_history_v2";

function formatTime(ts: number) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(ts));
}

function makeId(prefix: string) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function TCLogoSpinner({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const dims = size === "sm" ? "h-7 w-7" : size === "lg" ? "h-12 w-12" : "h-9 w-9";
  return (
    <div className={`relative shrink-0 ${dims}`}>
      <div className="absolute inset-0 rounded-full bg-[linear-gradient(135deg,#011848_0%,#ef0001_100%)] shadow-md" />
      <div className="absolute inset-0.5 rounded-full bg-transparent flex items-center justify-center overflow-hidden">
        <div className="relative w-[88%] h-[88%]">
          <Image
            src="/images/tc.png"
            alt="Testing Company"
            fill
            sizes="48px"
            className="select-none pointer-events-none object-contain animate-spin-slower"
          />
        </div>
      </div>
    </div>
  );
}

function formatToolLabel(tool?: string | null) {
  switch (tool) {
    case "get_screen_context":
      return "Contexto da tela";
    case "list_available_actions":
      return "A\u00e7\u00f5es dispon\u00edveis";
    case "search_internal_records":
      return "Busca interna";
    case "summarize_entity":
      return "Resumo";
    case "draft_test_case":
      return "Caso de teste";
    case "explain_permission":
      return "Permiss\u00f5es";
    case "create_ticket":
      return "Rascunho de chamado";
    case "create_comment":
      return "Coment\u00e1rio";
    case "suggest_next_step":
      return "Pr\u00f3ximo passo";
    case "system":
      return "Assistente";
    default:
      return "Assistente";
  }
}

export default function ChatButton({ defaultOpen = false }: ChatButtonProps) {
  const pathname = usePathname() || "/";
  const screenContext = useMemo(() => resolveAssistantScreenContext(pathname), [pathname]);
  const { user, can } = usePermissionAccess();
  const assistantEnabled = process.env.NEXT_PUBLIC_AI_ASSISTANT_ENABLED !== "false";
  const [open, setOpen] = useState(defaultOpen);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [confirmState, setConfirmState] = useState<ConfirmState>({ open: false });
  const [hintVisible, setHintVisible] = useState(false);
  const [hintIndex, setHintIndex] = useState(0);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  const HINTS = [
    "Posso resumir esta tela para voc\u00ea!",
    "Precisa de ajuda? \u00c9 s\u00f3 me chamar.",
    "Posso buscar chamados ou criar rascunhos.",
    "Pergunte algo sobre o que voc\u00ea est\u00e1 vendo.",
    "Posso explicar suas permiss\u00f5es de acesso.",
  ];

  useEffect(() => {
    if (open) return;
    const id = setInterval(() => {
      setHintIndex((i) => (i + 1) % HINTS.length);
      setHintVisible(true);
      setTimeout(() => setHintVisible(false), 5000);
    }, 60_000);
    return () => clearInterval(id);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return undefined;

    function close(e: MouseEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function esc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  useEffect(() => {
    try {
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    } catch {
      // ignore scroll errors
    }
  }, [messages, open]);

  useEffect(() => {
    try {
      const key = `${HISTORY_KEY_PREFIX}:${user?.id ?? "anon"}`;
      const raw = sessionStorage.getItem(key);
      if (!raw) {
        setMessages([]);
        return;
      }
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setMessages(parsed.slice(-120));
      }
    } catch {
      setMessages([]);
    }
  }, [user?.id]);

  useEffect(() => {
    try {
      const key = `${HISTORY_KEY_PREFIX}:${user?.id ?? "anon"}`;
      sessionStorage.setItem(key, JSON.stringify(messages.slice(-120)));
    } catch {
      // ignore storage errors
    }
  }, [messages, user?.id]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const updateViewportHeight = () => {
      setViewportHeight(Math.round(window.visualViewport?.height ?? window.innerHeight ?? 0));
    };

    updateViewportHeight();
    window.addEventListener("resize", updateViewportHeight);
    window.visualViewport?.addEventListener("resize", updateViewportHeight);

    return () => {
      window.removeEventListener("resize", updateViewportHeight);
      window.visualViewport?.removeEventListener("resize", updateViewportHeight);
    };
  }, []);

  if (!assistantEnabled) return null;
  if (!user) return null;
  if (!can("ai", "view") || !can("ai", "use")) return null;

  const roleLabel = user.permissionRole ?? user.role ?? user.companyRole ?? "usu\u00e1rio";
  const hasConversation = messages.length > 0;
  const compactViewport = viewportHeight > 0 && viewportHeight <= 860;
  const denseViewport = viewportHeight > 0 && viewportHeight <= 740;
  const ultraDenseViewport = viewportHeight > 0 && viewportHeight <= 680;
  const showQuickPrompts = !hasConversation;
  const visiblePrompts = hasConversation
    ? ultraDenseViewport
      ? 1
      : compactViewport
        ? 1
        : 2
    : ultraDenseViewport
      ? 2
      : compactViewport
        ? 3
        : 4;
  const compactConversationChrome = hasConversation || compactViewport;
  const summaryText = denseViewport
    ? `Assistente contextual de ${screenContext.screenLabel.toLowerCase()}.`
    : compactViewport && hasConversation
      ? `Contexto: ${screenContext.screenLabel}.`
      : screenContext.screenSummary;

  async function pushAssistantResponse(payload: { message?: string; action?: AssistantToolAction | null }, optimisticText?: string) {
    if (sending) return;
    const trimmedOptimistic = optimisticText?.trim() ?? "";
    if (!payload.action && !trimmedOptimistic) return;

    const requestHistory: AssistantConversationTurn[] = messages.slice(-12).map((message) => ({
      from: message.from,
      text: message.text,
      tool: (message.tool ?? null) as AssistantConversationTurn["tool"],
      ts: message.ts,
      actionLabels: message.actions?.map((action) => action.label) ?? [],
    }));

    setSending(true);

    if (trimmedOptimistic) {
      setMessages((current) => [
        ...current,
        { id: makeId("user"), from: "user", text: trimmedOptimistic, ts: Date.now() },
      ]);
    }

    if (payload.message) setInput("");

    try {
      const response = await fetchApi("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          context: { route: screenContext.route },
          history: requestHistory,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as AssistantReplyPayload & { error?: string };
      if (!response.ok) {
        throw new Error(data?.error || response.statusText || `Erro ${response.status}`);
      }

      setMessages((current) => [
        ...current,
        {
          id: makeId("assistant"),
          from: "assistant",
          text: String(data.reply ?? "Sem resposta"),
          ts: Date.now(),
          tool: data.tool ?? null,
          actions: Array.isArray(data.actions) ? data.actions : undefined,
        },
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao processar o agente";
      setMessages((current) => [
        ...current,
        {
          id: makeId("assistant"),
          from: "assistant",
          text: `Erro: ${message}`,
          ts: Date.now(),
          tool: "system",
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  async function sendMessage(textOverride?: string) {
    const text = (textOverride ?? input).trim();
    if (!text) return;

    const numericChoice = Number(text);
    if (Number.isInteger(numericChoice) && numericChoice >= 1) {
      const lastAssistantWithActions = [...messages]
        .reverse()
        .find((message) => message.from === "assistant" && Array.isArray(message.actions) && message.actions.length > 0);

      const selectedAction = lastAssistantWithActions?.actions?.[numericChoice - 1];
      if (selectedAction) {
        setInput("");
        handleAction(selectedAction);
        return;
      }
    }

    await pushAssistantResponse({ message: text }, text);
  }

  function queueAction(action: AssistantToolAction, label: string) {
    setConfirmState({ open: true, kind: "tool", action, label });
  }

  function handleAction(action: AssistantAction) {
    if (action.kind === "prompt") {
      void sendMessage(action.prompt);
      return;
    }
    queueAction(action, action.label);
  }

  function clearLocalHistory(kind: "clear" | "clearAll") {
    try {
      if (kind === "clear") {
        const key = `${HISTORY_KEY_PREFIX}:${user?.id ?? "anon"}`;
        sessionStorage.removeItem(key);
        setMessages([]);
        return;
      }
      const prefix = `${HISTORY_KEY_PREFIX}:`;
      for (let i = 0; i < sessionStorage.length; i += 1) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith(prefix)) {
          sessionStorage.removeItem(key);
          i = -1;
        }
      }
      setMessages([]);
    } catch {
      // ignore cleanup errors
    }
  }

  function confirmTitle() {
    if (!confirmState.open) return "";
    switch (confirmState.kind) {
      case "clear":
        return "Limpar hist\u00f3rico deste usu\u00e1rio";
      case "clearAll":
        return "Limpar todos os hist\u00f3ricos locais";
      case "tool":
        return confirmState.label;
      default:
        return "";
    }
  }

  function confirmDescription() {
    if (!confirmState.open) return "";
    switch (confirmState.kind) {
      case "clear":
        return "Essa limpeza afeta apenas o hist\u00f3rico salvo neste navegador para o usu\u00e1rio atual.";
      case "clearAll":
        return "Essa limpeza remove todos os hist\u00f3ricos do assistente salvos neste navegador.";
      case "tool":
        return "A a\u00e7\u00e3o ser\u00e1 executada dentro do seu perfil atual e respeitando o RBAC da sess\u00e3o.";
      default:
        return "";
    }
  }

  async function executeConfirm() {
    if (!confirmState.open) return;
    if (confirmState.kind === "clear" || confirmState.kind === "clearAll") {
      clearLocalHistory(confirmState.kind);
      setConfirmState({ open: false });
      return;
    }

    if (confirmState.kind !== "tool") {
      setConfirmState({ open: false });
      return;
    }

    const { action, label } = confirmState;
    setConfirmState({ open: false });
    await pushAssistantResponse({ action }, `Executar: ${label}`);
  }

  return (
    <div className="relative" ref={boxRef}>
      <div className="fixed bottom-6 right-6 z-50">
        <div className="flex items-end">
          {/* periodic hint bubble */}
          {!open && hintVisible ? (
            <div className="mr-3 mb-1 max-w-56 animate-[fadeSlideUp_0.3s_ease] rounded-2xl rounded-br-sm bg-white px-3.5 py-2.5 text-sm font-semibold text-[#011848] shadow-[0_8px_24px_rgba(1,24,72,0.16)] ring-1 ring-[rgba(1,24,72,0.08)]">
              {HINTS[hintIndex]}
            </div>
          ) : null}
          {open ? (
            <div
              className={`mr-3 flex w-[min(36rem,calc(100vw-1rem))] flex-col overflow-hidden rounded-4xl border border-(--tc-border,#d7dff1) bg-[linear-gradient(180deg,#ffffff_0%,#fff8fb_54%,#f7faff_100%)] shadow-[0_32px_80px_rgba(1,24,72,0.22)] ring-1 ring-[rgba(1,24,72,0.08)] ${
                denseViewport
                  ? "h-[min(74dvh,calc(100dvh-0.75rem))] max-h-[calc(100dvh-0.75rem)]"
                  : compactViewport
                    ? "h-[min(76dvh,calc(100dvh-1rem))] max-h-[calc(100dvh-1rem)]"
                    : "h-[min(78dvh,calc(100dvh-1.25rem))] max-h-[calc(100dvh-1.25rem)]"
              }`}
            >
              <div
                className={`relative overflow-hidden border-b border-[rgba(15,23,42,0.1)] [background-image:var(--tc-brand-gradient-strong)] text-white ${denseViewport ? "px-4 py-3" : hasConversation ? "px-5 py-4" : "px-5 py-6"}`}
              >
                <div className="absolute inset-0 [background-image:var(--tc-brand-overlay)]" aria-hidden />
                <div className="absolute inset-x-0 bottom-0 h-px [background-image:var(--tc-brand-divider)]" aria-hidden />
                <div className="relative flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className={`flex items-center justify-center ${denseViewport ? "h-10 w-10" : hasConversation ? "h-12 w-12" : "h-14 w-14"}`}>
                      <TCLogoSpinner size={denseViewport ? "md" : hasConversation ? "md" : "lg"} />
                    </div>
                    <div className="space-y-1">
                      <p className={`font-semibold uppercase tracking-[0.34em] text-white/72 ${compactConversationChrome ? "text-[0.58rem]" : denseViewport ? "text-[0.62rem]" : "text-[0.68rem]"}`}>Testing Company</p>
                      <div>
                        <h3 className={`${denseViewport ? "text-[1rem]" : hasConversation ? "text-[1.05rem]" : "text-[1.35rem]"} font-black tracking-[-0.03em] text-white`}>Assistente</h3>
                        <p className={`max-w-[20rem] ${compactConversationChrome ? "text-[0.74rem] leading-4.5" : denseViewport ? "text-[0.76rem] leading-5" : "text-sm leading-6"} text-white/82`}>{screenContext.screenLabel}</p>
                      </div>
                      <div className={`flex flex-wrap gap-2 pt-1 text-[0.68rem] uppercase tracking-[0.26em] text-white/72 ${compactConversationChrome ? "hidden" : ""}`}>
                        <span className="rounded-full border border-white/18 bg-white/10 px-2.5 py-1">{roleLabel}</span>
                        <span className="rounded-full border border-white/18 bg-white/10 px-2.5 py-1">{screenContext.module}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className={`rounded-full border border-white/15 bg-white/8 text-white/85 transition hover:bg-white/16 ${denseViewport ? "p-1.5" : "p-2"}`}
                      aria-label="Fechar assistente"
                      title="Fechar assistente"
                    >
                      <FiX size={denseViewport ? 13 : 15} />
                    </button>
                  </div>
                </div>
              </div>

              {showQuickPrompts ? (
                <div className={`border-b border-(--tc-border,#dfe6f3) bg-[linear-gradient(180deg,#f7faff_0%,#fff9fb_100%)] ${denseViewport ? "px-4 py-2.5" : "px-5 py-4"}`}>
                  <p className={`${denseViewport ? "text-[0.9rem] leading-5" : "text-base leading-6"} font-semibold text-[#011848]`}>{summaryText}</p>
                  <div className={`${compactViewport ? "mt-3 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" : "mt-3 flex flex-wrap gap-2"}`}>
                  {screenContext.suggestedPrompts.slice(0, visiblePrompts).map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => void sendMessage(prompt)}
                      className={`inline-flex items-center gap-2 rounded-full border border-(--tc-border,#d7dff1) bg-white/95 font-semibold text-(--tc-primary,#011848) shadow-[0_8px_18px_rgba(1,24,72,0.06)] transition hover:border-[rgba(239,0,1,0.24)] hover:text-(--tc-accent,#ef0001) ${compactViewport ? "shrink-0 px-3 py-1.5 text-[0.68rem]" : "px-3 py-2 text-xs"}`}
                    >
                      <FiZap size={12} />
                      {prompt}
                    </button>
                  ))}
                  </div>
                </div>
              ) : null}

              <div className={`min-h-0 flex-1 ${hasConversation ? "overflow-y-auto" : "overflow-y-hidden"} bg-[radial-gradient(circle_at_top_right,rgba(239,0,1,0.04),transparent_26%),linear-gradient(180deg,#f6f9ff_0%,#ffffff_28%,#ffffff_100%)] ${denseViewport ? "space-y-4 px-4 py-4" : hasConversation ? "space-y-4 px-4 py-4" : "space-y-5 px-5 py-5"}`}>
                {messages.length === 0 ? (
                  <div className={`rounded-[1.6rem] border border-[#dfe6f3] bg-white shadow-[0_18px_40px_rgba(15,23,42,0.06)] ${denseViewport ? "p-4" : "p-5"}`}>
                    <p className="text-base font-bold text-[#ef0001]">Pronto para atuar dentro do seu perfil.</p>
                    <p className="mt-2 text-base leading-7 text-[#011848]">
                      Eu uso a sess?o atual, enxergo apenas o que seu perfil pode ver e executo a??es somente dentro do seu RBAC.
                    </p>
                  </div>
                ) : null}

                {messages.map((message) => {
                  const isUser = message.from === "user";
                  return (
                    <div key={message.id} className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
                      {!isUser ? (
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[rgba(1,24,72,0.08)] bg-[linear-gradient(135deg,#ffffff_0%,#eef3ff_62%,#fff6f8_100%)] shadow-[0_10px_24px_rgba(1,24,72,0.1)]">
                          <TCLogoSpinner size="sm" />
                        </div>
                      ) : null}

                      <div className={`max-w-[82%] space-y-2 ${isUser ? "items-end" : "items-start"}`}>
                        <div
                          className={`rounded-[1.35rem] border px-4 py-3 text-sm leading-6 shadow-[0_12px_28px_rgba(15,23,42,0.06)] ${
                            isUser
                              ? "border-[rgba(239,0,1,0.16)] bg-[linear-gradient(135deg,var(--tc-accent,#ef0001)_0%,#c90000_100%)] text-white"
                              : "border-(--tc-border,#dfe6f3) bg-[linear-gradient(180deg,#ffffff_0%,#f9fbff_100%)] text-[#011848] [&_p]:text-base"
                          }`}
                        >
                          {!isUser && message.tool ? (
                            <div className="mb-2 inline-flex rounded-full border border-(--tc-border,#d7dff1) bg-[linear-gradient(180deg,#f7faff_0%,#fff7f8_100%)] px-2.5 py-1 text-[0.62rem] font-bold uppercase tracking-[0.24em] text-(--tc-primary,#011848)">
                              {formatToolLabel(message.tool)}
                            </div>
                          ) : null}
                          <p className="whitespace-pre-wrap">{message.text}</p>
                        </div>

                        {message.actions?.length ? (
                          <div className={`flex flex-wrap gap-2 ${isUser ? "justify-end" : "justify-start"}`}>
                            {message.actions.map((action, index) => (
                              <button
                                key={`${message.id}-${index}-${action.label}`}
                                type="button"
                                onClick={() => handleAction(action)}
                                disabled={sending}
                                className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold transition ${
                                  action.kind === "tool"
                                    ? "border border-[rgba(1,24,72,0.12)] bg-[linear-gradient(135deg,var(--tc-primary,#011848)_0%,#173a88_100%)] text-white hover:bg-[linear-gradient(135deg,#132a63_0%,#214ca8_100%)]"
                                    : "border border-(--tc-border,#d7dff1) bg-white text-(--tc-primary,#011848) hover:border-[rgba(239,0,1,0.2)] hover:text-(--tc-accent,#ef0001)"
                                } disabled:opacity-60`}
                              >
                                {action.kind === "tool" ? <FiZap size={12} /> : <FiChevronRight size={12} />}
                                {action.label}
                              </button>
                            ))}
                          </div>
                        ) : null}

                        <div className={`flex items-center gap-2 text-[0.68rem] text-[#8a96ad] ${isUser ? "justify-end" : "justify-start"}`}>
                          <span>{formatTime(message.ts)}</span>
                        </div>
                      </div>

                      {isUser ? <UserAvatar src={user.avatarUrl} name={user.name} size="sm" className="h-11 w-11 shrink-0" /> : null}
                    </div>
                  );
                })}

                <div ref={endRef} />
              </div>

              <div className={`border-t border-(--tc-border,#dfe6f3) bg-[linear-gradient(180deg,#ffffff_0%,#f9fbff_100%)] ${denseViewport ? "px-4 py-2.5" : hasConversation ? "px-4 py-3" : "px-5 py-4.5"}`}>
                <div className={`rounded-3xl border border-(--tc-border,#dfe6f3) bg-[linear-gradient(180deg,#f8fbff_0%,#fff7fa_100%)] shadow-[0_14px_28px_rgba(15,23,42,0.05)] ${denseViewport ? "p-2.5" : hasConversation ? "p-2.5" : "p-3.5"}`}>
                  <textarea
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        void sendMessage();
                      }
                    }}
                    placeholder={`Escreva o que voc? precisa em ${screenContext.screenLabel.toLowerCase()}...`}
                    className={`w-full resize-none rounded-[1.1rem] border border-(--tc-border,#d7dff1) bg-white px-4 text-sm leading-6 text-[#20304f] outline-none placeholder:text-[#8b98b1] focus:border-(--tc-accent,#ef0001) ${denseViewport ? "min-h-[2.7rem] py-1.5" : hasConversation ? "min-h-[2.85rem] py-1.5" : "min-h-[5.6rem] py-3"}`}
                  />
                  <div className={`flex items-center justify-between gap-3 ${denseViewport ? "mt-1.5" : hasConversation ? "mt-2" : "mt-3"}`}>
                    <button
                      type="button"
                      onClick={() => setConfirmState({ open: true, kind: "clearAll" })}
                      className={`font-semibold uppercase tracking-[0.24em] text-[#8b98b1] transition hover:text-(--tc-accent,#ef0001) ${hasConversation ? "text-[0.65rem]" : "text-xs"}`}
                    >
                      Limpar tudo
                    </button>
                    <button
                      type="button"
                      onClick={() => void sendMessage()}
                      disabled={sending || !input.trim()}
                      className={`inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,var(--tc-primary,#011848)_0%,#1f4aa3_100%)] font-semibold text-white shadow-[0_14px_28px_rgba(11,26,60,0.2)] transition hover:-translate-y-px hover:bg-[linear-gradient(135deg,var(--tc-accent,#ef0001)_0%,#c70000_100%)] disabled:cursor-not-allowed disabled:opacity-60 ${hasConversation ? "px-3.5 py-2 text-[0.85rem]" : "px-4 py-2.5 text-sm"}`}
                    >
                      <FiSend size={15} />
                      {sending ? "Processando..." : "Enviar"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-label="Abrir assistente da plataforma"
            title="Assistente Testing Company — clique para abrir"
            className="group relative flex h-14 w-14 items-center justify-center rounded-full shadow-[0_18px_35px_rgba(1,24,72,0.22)] transition hover:scale-105"
            onMouseEnter={() => setHintVisible(false)}
          >
            {/* spinning logo with gradient background */}
            <div className="absolute inset-0 rounded-full bg-[linear-gradient(135deg,#011848_0%,#6b0000_55%,#ef0001_100%)] shadow-[0_8px_24px_rgba(1,24,72,0.4)]" />
            <div className="absolute inset-0.75 rounded-full overflow-hidden flex items-center justify-center">
              <div className="relative w-full h-full">
                <Image
                  src="/images/tc.png"
                  alt="Assistente Testing Company"
                  fill
                  sizes="56px"
                  className="select-none pointer-events-none object-contain animate-spin-slower"
                />
              </div>
            </div>
            {/* tooltip */}
            <span className="pointer-events-none absolute bottom-[calc(100%+0.5rem)] right-0 whitespace-nowrap rounded-xl bg-[#011848] px-3 py-1.5 text-xs font-semibold text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
              Assistente Testing Company
              <span className="absolute -bottom-1.25 right-5 h-2.5 w-2.5 rotate-45 bg-[#011848]" />
            </span>
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmState.open}
        title={confirmTitle()}
        description={confirmDescription()}
        onCancel={() => setConfirmState({ open: false })}
        onConfirm={() => {
          void executeConfirm();
        }}
        confirmLabel={confirmState.open && confirmState.kind === "tool" ? "Executar" : "Confirmar"}
        cancelLabel="Cancelar"
      />
    </div>
  );
}
