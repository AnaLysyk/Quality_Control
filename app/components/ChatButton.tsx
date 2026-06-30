"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { FiChevronRight, FiMaximize2, FiMinimize2, FiSend, FiSidebar, FiTrash2, FiX, FiZap } from "react-icons/fi";
import type { AssistantAction, AssistantConversationTurn, AssistantOpenEventDetail, AssistantPanelMode, AssistantReplyPayload, AssistantScreenContext, AssistantToolAction } from "@/lib/assistant/types";
import { resolveAssistantScreenContext } from "@/lib/assistant/screenContext";
import { fetchApi } from "@/lib/api";
import {
  runAccessRequestsBrainCommand,
  type AccessRequestsBrainPendingAction,
} from "@/admin/access-requests/_assistant";
import { usePermissionAccess } from "@/hooks/usePermissionAccess";
import styles from "./ChatButton.module.css";
import ConfirmDialog from "./ConfirmDialog";
import UserAvatar from "./UserAvatar";

type ChatMessage = {
  id: string;
  from: "user" | "assistant";
  text: string;
  ts: number;
  tool?: string | null;
  actions?: AssistantAction[];
  agentMeta?: {
    agentMode?: string | null;
    agentName?: string | null;
    agentIcon?: string | null;
    agentColor?: string | null;
  } | null;
};

type ConfirmState =
  | { open: false }
  | { open: true; kind: "tool"; action: AssistantToolAction; label: string }
  | { open: true; kind: "clearAll" };

type ChatButtonProps = {
  defaultOpen?: boolean;
  defaultPanelMode?: AssistantPanelMode;
};

type AgentMode = "qa" | "debug" | "playwright" | "memory";

const ASSISTANT_AGENTS: Array<{ mode: AgentMode; icon: string; name: string }> = [
  { mode: "qa", icon: "QA", name: "QA" },
  { mode: "debug", icon: "DBG", name: "Debug" },
  { mode: "playwright", icon: "PW", name: "Playwright" },
  { mode: "memory", icon: "MEM", name: "Memory" },
];

const HISTORY_KEY_PREFIX = "assistant_history_v2";
const PANEL_MODE_KEY = "assistant_panel_mode_v1";
const SIDE_PANEL_WIDTH_KEY = "assistant_side_panel_width_v1";
const DEFAULT_SIDE_PANEL_WIDTH = 460;
const MIN_SIDE_PANEL_WIDTH = 340;
const MAX_SIDE_PANEL_WIDTH = 760;

function sanitizePromptList(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback;
  const next = value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .slice(0, 8);
  return next.length > 0 ? next : fallback;
}

function sanitizeMetadata(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function mergeAssistantContext(base: AssistantScreenContext, incoming?: Partial<AssistantScreenContext> | null): AssistantScreenContext {
  if (!incoming) return base;
  return {
    ...base,
    ...incoming,
    route: typeof incoming.route === "string" && incoming.route.trim() ? incoming.route : base.route,
    screenLabel: typeof incoming.screenLabel === "string" && incoming.screenLabel.trim() ? incoming.screenLabel : base.screenLabel,
    screenSummary: typeof incoming.screenSummary === "string" && incoming.screenSummary.trim() ? incoming.screenSummary : base.screenSummary,
    suggestedPrompts: sanitizePromptList(incoming.suggestedPrompts, base.suggestedPrompts),
    metadata: sanitizeMetadata(incoming.metadata) ?? base.metadata ?? null,
  };
}

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
    case "create_test_case":
      return "Criacao de caso";
    case "explain_permission":
      return "Permiss\u00f5es";
    case "create_ticket":
      return "Rascunho de chamado";
    case "create_comment":
      return "Coment\u00e1rio";
    case "suggest_next_step":
      return "Pr\u00f3ximo passo";
    case "use_brain":
      return "Brain";
    case "system":
      return "Brain";
    default:
      return "Brain";
  }
}

function parseTableLine(line: string) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isTableSeparator(line: string) {
  const compact = line.replace(/\s+/g, "").trim();
  return /^\|?[-:|]+\|?$/.test(compact);
}

function ChatRichText({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: Array<{ type: string; value?: string; items?: string[]; rows?: string[][] }> = [];

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i] ?? "";
    const line = raw.trim();

    if (!line) {
      blocks.push({ type: "space" });
      continue;
    }

    if (line.startsWith("```") ) {
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !(lines[i] ?? "").trim().startsWith("```")) {
        codeLines.push(lines[i] ?? "");
        i += 1;
      }
      blocks.push({ type: "code", value: codeLines.join("\n") });
      continue;
    }

    if (line.startsWith("## ")) {
      blocks.push({ type: "h2", value: line.slice(3).trim() });
      continue;
    }

    if (line.startsWith("### ")) {
      blocks.push({ type: "h3", value: line.slice(4).trim() });
      continue;
    }

    if (line.startsWith("> ")) {
      blocks.push({ type: "quote", value: line.slice(2).trim() });
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const items = [line.replace(/^[-*]\s+/, "")];
      while (i + 1 < lines.length && /^\s*[-*]\s+/.test(lines[i + 1] ?? "")) {
        i += 1;
        items.push((lines[i] ?? "").trim().replace(/^[-*]\s+/, ""));
      }
      blocks.push({ type: "ul", items });
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items = [line.replace(/^\d+\.\s+/, "")];
      while (i + 1 < lines.length && /^\s*\d+\.\s+/.test(lines[i + 1] ?? "")) {
        i += 1;
        items.push((lines[i] ?? "").trim().replace(/^\d+\.\s+/, ""));
      }
      blocks.push({ type: "ol", items });
      continue;
    }

    if (line.startsWith("|") && line.endsWith("|")) {
      const tableLines = [line];
      while (i + 1 < lines.length) {
        const next = (lines[i + 1] ?? "").trim();
        if (!(next.startsWith("|") && next.endsWith("|"))) break;
        i += 1;
        tableLines.push(next);
      }

      const rows = tableLines
        .filter((tableLine) => !isTableSeparator(tableLine))
        .map((tableLine) => parseTableLine(tableLine));

      if (rows.length > 0) {
        blocks.push({ type: "table", rows });
        continue;
      }
    }

    blocks.push({ type: "p", value: line });
  }

  return (
    <div className="space-y-2">
      {blocks.map((block, index) => {
        if (block.type === "space") {
          return <div key={`space-${index}`} className="h-1" />;
        }

        if (block.type === "h2") {
          return (
            <div key={`h2-${index}`} className="rounded-2xl border border-[rgba(239,0,1,0.18)] bg-[linear-gradient(135deg,rgba(1,24,72,0.08)_0%,rgba(239,0,1,0.08)_100%)] px-3 py-2.5 dark:border-[#ff8a8a44] dark:bg-[linear-gradient(135deg,rgba(35,85,196,0.22)_0%,rgba(239,0,1,0.2)_100%)]">
              <p className="text-[0.68rem] font-black uppercase tracking-[0.22em] text-(--tc-accent,#ef0001) dark:text-[#ffb4b4]">Insight</p>
              <p className="mt-1 text-[0.96rem] font-extrabold leading-6 tracking-[-0.015em] text-[#011848] dark:text-[#f2f7ff]">{block.value}</p>
            </div>
          );
        }

        if (block.type === "h3") {
          return (
            <p key={`h3-${index}`} className="mt-2 text-[0.8rem] font-bold uppercase tracking-[0.2em] text-(--tc-primary,#011848) dark:text-[#d7e5ff]">
              {block.value}
            </p>
          );
        }

        if (block.type === "quote") {
          return (
            <div key={`quote-${index}`} className="rounded-xl border-l-4 border-(--tc-accent,#ef0001) bg-[rgba(239,0,1,0.06)] px-3 py-2 text-[0.85rem] text-[#20304f] dark:bg-[rgba(239,0,1,0.14)] dark:text-[#f0f5ff]">
              {block.value}
            </div>
          );
        }

        if (block.type === "ul") {
          return (
            <ul key={`ul-${index}`} className="space-y-1 pl-4 text-[0.9rem] text-[#20304f] dark:text-[#e6efff]">
              {(block.items ?? []).map((item, itemIndex) => (
                <li key={`ul-item-${itemIndex}`} className="list-disc marker:text-(--tc-accent,#ef0001)">{item}</li>
              ))}
            </ul>
          );
        }

        if (block.type === "ol") {
          return (
            <ol key={`ol-${index}`} className="space-y-1 pl-4 text-[0.9rem] text-[#20304f] dark:text-[#e6efff]">
              {(block.items ?? []).map((item, itemIndex) => (
                <li key={`ol-item-${itemIndex}`} className="list-decimal marker:font-semibold marker:text-(--tc-primary,#011848) dark:marker:text-[#c7dcff]">{item}</li>
              ))}
            </ol>
          );
        }

        if (block.type === "table") {
          const rows = block.rows ?? [];
          const [header, ...body] = rows;
          return (
            <div key={`table-${index}`} className="overflow-hidden rounded-2xl border border-(--tc-border,#d7dff1) bg-[#ffffff] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] dark:border-[#36507f] dark:bg-[#0f192d]">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-[0.82rem]">
                  {header ? (
                    <thead className="bg-[linear-gradient(180deg,#f6f9ff_0%,#edf3ff_100%)] dark:bg-[linear-gradient(180deg,#1a2b48_0%,#122038_100%)]">
                      <tr>
                        {header.map((cell, cellIndex) => (
                          <th key={`thead-${cellIndex}`} className="border-b border-(--tc-border,#d7dff1) px-3 py-2 font-bold text-(--tc-primary,#011848) dark:border-[#36507f] dark:text-[#d7e5ff]">
                            {cell}
                          </th>
                        ))}
                      </tr>
                    </thead>
                  ) : null}
                  <tbody>
                    {body.map((row, rowIndex) => (
                      <tr key={`row-${rowIndex}`} className="odd:bg-black/1.5 dark:odd:bg-white/3">
                        {row.map((cell, cellIndex) => (
                          <td key={`cell-${rowIndex}-${cellIndex}`} className="border-b border-(--tc-border,#eef2fb) px-3 py-2 text-[#26334f] last:border-b-0 dark:border-[#263e66] dark:text-[#e6efff]">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        }

        if (block.type === "code") {
          return (
            <pre key={`code-${index}`} className="overflow-x-auto rounded-xl border border-[#1f355e] bg-[#081327] px-3 py-2.5 text-[0.78rem] leading-5 text-[#d5e7ff]">
              <code>{block.value}</code>
            </pre>
          );
        }

        return (
          <p key={`p-${index}`} className="whitespace-pre-wrap text-[0.9rem] leading-6 text-[#20304f] dark:text-[#e6efff]">
            {block.value}
          </p>
        );
      })}
    </div>
  );
}

export default function ChatButton({ defaultOpen = false, defaultPanelMode }: ChatButtonProps) {
  const pathname = usePathname() || "/";
  const screenContext = useMemo(() => resolveAssistantScreenContext(pathname), [pathname]);
  const { user, can, permissions } = usePermissionAccess();
  const conversationStorageKey = useMemo(
    () => `${HISTORY_KEY_PREFIX}:${user?.id ?? "anon"}:${pathname}`,
    [pathname, user?.id],
  );
  const assistantEnabled = process.env.NEXT_PUBLIC_AI_ASSISTANT_ENABLED !== "false";
  const [open, setOpen] = useState(defaultOpen);
  const [panelMode, setPanelMode] = useState<AssistantPanelMode>(defaultPanelMode ?? "compact");
  const [sidePanelWidth, setSidePanelWidth] = useState(DEFAULT_SIDE_PANEL_WIDTH);
  const [resizingSidePanel, setResizingSidePanel] = useState(false);
  const isExpandedMode = panelMode === "expanded";
  const isSideMode = panelMode === "side";
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [assistantContext, setAssistantContext] = useState<AssistantScreenContext>(screenContext);
  const [brainOpenContext, setBrainOpenContext] = useState<AssistantOpenEventDetail | null>(null);
  const [activeAgentMode, setActiveAgentMode] = useState<AgentMode | null>(null);
  const [accessRequestsPendingAction, setAccessRequestsPendingAction] = useState<AccessRequestsBrainPendingAction | null>(null);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [confirmState, setConfirmState] = useState<ConfirmState>({ open: false });
  const boxRef = useRef<HTMLDivElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);


  useEffect(() => {
    if (!open) return undefined;

    function close(e: MouseEvent) {
      if (panelMode !== "compact") return;
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
  }, [open, panelMode]);

  useEffect(() => {
    try {
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    } catch {
      // ignore scroll errors
    }
  }, [messages, open]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(conversationStorageKey);
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
  }, [conversationStorageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(conversationStorageKey, JSON.stringify(messages.slice(-120)));
    } catch {
      // ignore storage errors
    }
  }, [messages, conversationStorageKey]);

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
  }, [pathname]);

  useEffect(() => {
    setAssistantContext(screenContext);

    if (!pathname.startsWith("/brain")) {
      setBrainOpenContext(null);
      setActiveAgentMode(null);
      return;
    }

    if (typeof window !== "undefined") {
      const metadata = (window as unknown as { __QC_BRAIN_CONTEXT__?: unknown }).__QC_BRAIN_CONTEXT__;
      if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
        setBrainOpenContext({
          source: "brain",
          route: pathname,
          agentMode: "qa",
          metadata: metadata as Record<string, unknown>,
        });
        setAssistantContext(
          mergeAssistantContext(screenContext, {
            route: pathname,
            module: "brain",
            screenLabel: "Brain",
            screenSummary: "Brain é o cérebro visual da plataforma Quality Control e fornece contexto vivo para o chat global.",
            suggestedPrompts: [
              "O que estou vendo?",
              "Me explica esse nó",
              "Mostra só pendências",
              "Abre o núcleo de defeitos",
            ],
            metadata: metadata as Record<string, unknown>,
          }),
        );
      }
    }
  }, [screenContext, pathname]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    function handleAssistantContext(e: Event) {
      const detail = (e as CustomEvent<AssistantOpenEventDetail>).detail ?? {};
      const detailRoute = detail.route ?? pathname;
      if (detailRoute !== pathname) return;
      const resolvedContext = resolveAssistantScreenContext(detailRoute);
      setAssistantContext(mergeAssistantContext(resolvedContext, detail.context ?? null));
      if (detail.source === "brain" || detailRoute.startsWith("/brain")) {
        setBrainOpenContext((current) => ({
          ...(current ?? {}),
          ...detail,
          route: detailRoute,
          source: detail.source ?? "brain",
        }));
        if (detail.agentMode && (["qa", "debug", "playwright", "memory"] as string[]).includes(detail.agentMode)) {
          setActiveAgentMode(detail.agentMode as AgentMode);
        }
      }
    }

    window.addEventListener("assistant:context", handleAssistantContext);
    return () => {
      window.removeEventListener("assistant:context", handleAssistantContext);
    };
  }, [pathname]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (defaultPanelMode) {
        setPanelMode(defaultPanelMode);
      } else {
        const stored = window.localStorage.getItem(PANEL_MODE_KEY);
        if (stored === "compact" || stored === "side" || stored === "expanded") {
          setPanelMode(stored);
        }
      }

      const storedWidth = Number(window.localStorage.getItem(SIDE_PANEL_WIDTH_KEY));
      if (Number.isFinite(storedWidth) && storedWidth > 0) {
        const maxWidth = Math.min(MAX_SIDE_PANEL_WIDTH, Math.max(MIN_SIDE_PANEL_WIDTH, window.innerWidth - 420));
        setSidePanelWidth(Math.min(maxWidth, Math.max(MIN_SIDE_PANEL_WIDTH, storedWidth)));
      }
    } catch {
      // ignore storage errors
    }
  }, [defaultPanelMode, pathname]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(PANEL_MODE_KEY, panelMode);
    } catch {
      // ignore storage errors
    }
  }, [panelMode]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 40);
    return () => window.clearTimeout(timer);
  }, [open, panelMode]);

  useEffect(() => {
    if (pathname.startsWith("/brain") && open && panelMode === "compact") {
      setPanelMode("side");
    }
  }, [open, panelMode, pathname]);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const shouldReserveSpace = open && isSideMode;

    document.body.classList.toggle("qc-brain-side-open", shouldReserveSpace);
    document.documentElement.style.setProperty("--qc-brain-side-width", `${sidePanelWidth}px`);

    return () => {
      document.body.classList.remove("qc-brain-side-open");
    };
  }, [open, isSideMode, pathname, sidePanelWidth]);

  // Listen for assistant:open events dispatched by Brain or other screens
  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    function handleAssistantOpen(e: Event) {
      const detail = (e as CustomEvent<AssistantOpenEventDetail>).detail ?? {};
      const nextRoute = detail.route ?? pathname;
      const resolvedContext = resolveAssistantScreenContext(nextRoute);
      setBrainOpenContext(detail);
      if (detail.agentMode && (["qa", "debug", "playwright", "memory"] as string[]).includes(detail.agentMode)) {
        setActiveAgentMode(detail.agentMode as AgentMode);
      }
      setAssistantContext(mergeAssistantContext(resolvedContext, detail.context ?? null));
      setPanelMode(detail.panelMode ?? "compact");
      setOpen(true);
      if (detail.initialMessage) {
        setInput(detail.initialMessage);
      }
      if (detail.focusInput !== false) {
        window.setTimeout(() => {
          inputRef.current?.focus();
        }, 60);
      }
    }

    window.addEventListener("assistant:open", handleAssistantOpen);
    return () => {
      window.removeEventListener("assistant:open", handleAssistantOpen);
    };
  }, [pathname]);

  if (!assistantEnabled) return null;
  if (!user) return null;
  const isGlobalAdmin = user.isGlobalAdmin === true || (user as { is_global_admin?: boolean }).is_global_admin === true;
  if (!isGlobalAdmin && (!can("ai", "view") || !can("ai", "use"))) return null;

  const activeScreenLabel = assistantContext.screenLabel ?? screenContext.screenLabel;
  const hasConversation = messages.length > 0;
  const compactViewport = viewportHeight > 0 && viewportHeight <= 860;
  const denseViewport = viewportHeight > 0 && viewportHeight <= 740;
  const compactConversationChrome = hasConversation || compactViewport;
  const panelControlClass = `inline-flex ${denseViewport ? "h-7 w-7" : "h-8 w-8"} shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/8 text-white/90 transition hover:-translate-y-0.5 hover:bg-white/16`;

  async function pushAssistantResponse(payload: { message?: string; action?: AssistantToolAction | null }, optimisticText?: string) {
    if (sending) return;
    if (!user) return;
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

    // Usa endpoint unificado para garantir memória persistente de todas as conversas.
    const apiRoute = "/api/assistant/ask";
    const shouldSendBrainContext =
      pathname.startsWith("/brain") ||
      Boolean(
        brainOpenContext?.source === "brain" &&
        (brainOpenContext.route ?? pathname).startsWith("/brain"),
      );

    try {
      const response = await fetchApi(apiRoute, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          context: assistantContext,
          brainContext: shouldSendBrainContext
            ? { ...(brainOpenContext ?? {}), ...(activeAgentMode ? { agentMode: activeAgentMode } : {}) }
            : undefined,
          actor: {
            userId: user.id,
            permissionRole: user.permissionRole ?? null,
            role: user.role ?? null,
            companyRole: user.companyRole ?? null,
            companySlug: user.clientSlug ?? null,
            companySlugs: Array.isArray(user.clientSlugs) ? user.clientSlugs : null,
            userOrigin: user.userOrigin ?? user.user_origin ?? null,
            isGlobalAdmin: Boolean(user.isGlobalAdmin ?? user.is_global_admin),
          },
          history: requestHistory,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as AssistantReplyPayload & { error?: string };
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Sua sessão expirou. Faça login novamente para o brain acessar o Brain.");
        }
        throw new Error(data?.error || response.statusText || `Erro ${response.status}`);
      }

      if (data.context) {
        setAssistantContext(data.context);
      }

      if (data.meta?.agentMode && (["qa", "debug", "playwright", "memory"] as string[]).includes(String(data.meta.agentMode))) {
        setActiveAgentMode(data.meta.agentMode as AgentMode);
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
          agentMeta: data.meta ? {
            agentMode: data.meta.agentMode ?? null,
            agentName: data.meta.agentName ?? null,
            agentIcon: data.meta.agentIcon ?? null,
            agentColor: data.meta.agentColor ?? null,
          } : null,
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

  function runLocalNavigationAgentCommand(rawText: string): string | null {
    if (typeof window === "undefined") return null;

    const normalized = rawText
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[!?.,;]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (!normalized) return null;

    const go = (path: string, reply: string) => {
      window.location.assign(path);
      return reply;
    };

    if (/\b(abrir|abre|ir|vai|entrar|entra|mostrar|mostra)\b.*\b(brain|brian)\b/.test(normalized)) {
      return go("/brain", "Pronto, estou abrindo o Brain.");
    }

    if (/\b(abrir|abre|ir|vai|entrar|entra|mostrar|mostra)\b.*\b(solicitacoes|solicitacao|acessos?|acesso)\b/.test(normalized)) {
      return go("/admin/access-requests", "Pronto, estou abrindo Solicitações de acesso.");
    }

    if (/\b(abrir|abre|ir|vai|entrar|entra|mostrar|mostra)\b.*\b(perfil|meu perfil|configuracoes|configuracao)\b/.test(normalized)) {
      return go("/settings/profile", "Pronto, estou abrindo seu perfil.");
    }

    if (/\b(trocar|alterar|mudar|atualizar)\b.*\b(senha)\b/.test(normalized)) {
      return go("/settings/profile", "Pronto, abri seu perfil. Por segurança, a troca de senha precisa confirmar a senha atual e a nova senha na área do perfil.");
    }

    return null;
  }

  function runLocalBrainMapCommand(rawText: string): string | null {
    if (typeof window === "undefined" || !pathname.startsWith("/brain")) return null;

    const normalized = rawText
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[!?.,;]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (!normalized) return null;

    const dispatchBrainCommand = (command: string, value?: string | null) => {
      window.dispatchEvent(new CustomEvent("brain:command", { detail: { command, value: value ?? null } }));
    };

    if (/\b(mostra|mostrar|filtra|filtrar|exibe|exibir)\b.*\b(pendencias|pendentes|falta|faltando)\b/.test(normalized)) {
      dispatchBrainCommand("show_pending");
      return "Pronto. Filtrei o Brain para destacar pendências e lacunas de conhecimento.";
    }

    if (/\b(mostra|mostrar|filtra|filtrar|exibe|exibir)\b.*\b(orfaos|orfao|isolados|isolado)\b/.test(normalized)) {
      dispatchBrainCommand("show_orphans");
      return "Pronto. Estou mostrando os conhecimentos órfãos ou isolados no mapa.";
    }

    if (/\b(volta|voltar|limpa|limpar|principal|geral|raiz|root)\b/.test(normalized)) {
      dispatchBrainCommand("clear_filters");
      return "Voltei para a visão geral do Brain.";
    }

    if (/\b(centraliza|centralizar|recentraliza|foca|focar)\b/.test(normalized)) {
      dispatchBrainCommand("center_graph");
      return "Centralizei o mapa neural.";
    }

    if (/\b(expande|expandir|detalhes|detalhar)\b/.test(normalized)) {
      dispatchBrainCommand("expand_node_details");
      return "Expandi os detalhes do nó selecionado no overlay.";
    }

    const moduleAliases: Array<[RegExp, string]> = [
      [/\b(defeitos|bugs?|qualidade)\b/, "Defeitos"],
      [/\b(logs?|auditoria|eventos?)\b/, "Logs"],
      [/\b(suporte|chamados?)\b/, "Suporte"],
      [/\b(solicitacoes|solicitacao|acessos?|acesso)\b/, "Solicitações"],
      [/\b(documentos?|evidencias?|anexos?)\b/, "Documentos"],
      [/\b(automacao|automacoes|scripts?|execucoes?)\b/, "Automação"],
      [/\b(repositorio|casos? de teste|testes?)\b/, "Repositório de Testes"],
      [/\b(planos? de teste|plano)\b/, "Plano de Teste"],
      [/\b(usuarios?|permissoes?|perfis?)\b/, "Usuários / Permissões"],
    ];

    if (/\b(abre|abrir|mostra|mostrar|foca|focar|expande|expandir|filtra|filtrar)\b/.test(normalized)) {
      const moduleMatch = moduleAliases.find(([pattern]) => pattern.test(normalized));
      if (moduleMatch) {
        dispatchBrainCommand("select_module", moduleMatch[1]);
        return `Abri o núcleo ${moduleMatch[1]} no Brain.`;
      }
    }

    return null;
  }

  async function sendMessage(textOverride?: string) {
    const text = (textOverride ?? input).trim();
    if (!text) return;

    if (pathname.startsWith("/admin/access-requests")) {
      setInput("");
      const now = Date.now();
      const assistantMessageId = makeId("assistant");
      setMessages((current) => [
        ...current,
        { id: makeId("user"), from: "user", text, ts: now },
        {
          id: assistantMessageId,
          from: "assistant",
          text: "Estou olhando o painel de solicitações e interpretando seu pedido...",
          ts: now + 1,
          tool: "use_brain",
        },
      ]);

      const viewer = user ? { ...(user as Record<string, unknown>), permissions } : null;
      const localResult = await runAccessRequestsBrainCommand({
        pathname,
        text,
        user: viewer,
        pendingAction: accessRequestsPendingAction,
      });

      if (localResult.handled) {
        if (localResult.pendingAction !== undefined) {
          setAccessRequestsPendingAction(localResult.pendingAction);
        }
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantMessageId
              ? { ...message, text: localResult.reply ?? "Pronto, cuidei disso na tela.", tool: "use_brain" }
              : message,
          ),
        );
        return;
      }

      setMessages((current) => current.filter((message) => message.id !== assistantMessageId && !(message.from === "user" && message.text === text && message.ts === now)));
    }

    const brainMapCommandResult = runLocalBrainMapCommand(text);
    if (brainMapCommandResult) {
      setInput("");
      setMessages((current) => [
        ...current,
        {
          id: makeId("user"),
          from: "user",
          text,
          ts: Date.now(),
        },
        {
          id: makeId("assistant"),
          from: "assistant",
          text: brainMapCommandResult,
          ts: Date.now(),
          tool: "use_brain",
        },
      ]);
      return;
    }

    const navigationAgentResult = runLocalNavigationAgentCommand(text);
    if (navigationAgentResult) {
      setInput("");
      setMessages((current) => [
        ...current,
        {
          id: makeId("user"),
          from: "user",
          text,
          ts: Date.now(),
        },
        {
          id: makeId("assistant"),
          from: "assistant",
          text: navigationAgentResult,
          ts: Date.now(),
          tool: "system",
        },
      ]);
      return;
    }

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

  function confirmTitle() {
    if (!confirmState.open) return "";
    switch (confirmState.kind) {
      case "tool":
        return confirmState.label;
      case "clearAll":
        return "Limpar conversa";
      default:
        return "";
    }
  }

  function confirmDescription() {
    if (!confirmState.open) return "";
    switch (confirmState.kind) {
      case "tool":
        return "A a\u00e7\u00e3o ser\u00e1 executada dentro do seu perfil atual e respeitando o RBAC da sess\u00e3o.";
      case "clearAll":
        return "Isso remove o hist\u00f3rico local desta conversa para o seu usu\u00e1rio.";
      default:
        return "";
    }
  }

  function startSidePanelResize(event: PointerEvent<HTMLButtonElement>) {
    if (!isSideMode || typeof window === "undefined") return;

    event.preventDefault();
    event.stopPropagation();

    setResizingSidePanel(true);

    const startX = event.clientX;
    const startWidth = sidePanelWidth;

    const getMaxWidth = () => Math.min(MAX_SIDE_PANEL_WIDTH, Math.max(MIN_SIDE_PANEL_WIDTH, window.innerWidth - 420));

    const onPointerMove = (moveEvent: globalThis.PointerEvent) => {
      const delta = startX - moveEvent.clientX;
      const nextWidth = startWidth + delta;
      const maxWidth = getMaxWidth();

      setSidePanelWidth(Math.min(maxWidth, Math.max(MIN_SIDE_PANEL_WIDTH, nextWidth)));
    };

    const onPointerUp = () => {
      setResizingSidePanel(false);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  }

  async function executeConfirm() {
    if (!confirmState.open) return;
    if (confirmState.kind === "clearAll") {
      setMessages([]);
      try {
        const key = `${HISTORY_KEY_PREFIX}:${user?.id ?? "anon"}`;
        localStorage.removeItem(key);
      } catch {
        // ignore storage errors
      }
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
    <div className="relative">
      {open ? (
        <div
          ref={boxRef}
          style={isSideMode ? { width: sidePanelWidth } : undefined}
          className={`fixed z-50 m-0 transition-all duration-300 ease-in-out ${
            isExpandedMode
              ? "left-1/2 top-[5vh] -translate-x-1/2"
              : isSideMode
                ? "inset-y-0 right-0 m-0"
                : "bottom-6 right-6"
          }`}
        >
          {isSideMode ? (
            <button
              type="button"
              aria-label="Redimensionar Brain"
              title="Arraste para ajustar o tamanho do Brain"
              onPointerDown={startSidePanelResize}
              className={`absolute inset-y-0 left-0 z-20 flex w-3 translate-x-0 cursor-ew-resize items-center justify-center bg-transparent text-transparent shadow-none transition ${resizingSidePanel ? "" : ""}`}
            >
              ↔
            </button>
          ) : null}

          <div
            className={`flex flex-col overflow-hidden border border-(--tc-border,#d7dff1) bg-[linear-gradient(180deg,#ffffff_0%,#fff8fb_54%,#f7faff_100%)] shadow-[0_32px_80px_rgba(1,24,72,0.22)] ring-1 ring-[rgba(1,24,72,0.08)] dark:border-[#31476f] dark:bg-[linear-gradient(180deg,#0d1729_0%,#122038_54%,#0b1424_100%)] dark:ring-white/10 transition-[width,height,border-radius] duration-300 ease-in-out ${
              isExpandedMode
                ? "h-[85vh] w-[min(68.75rem,90vw)] rounded-4xl"
                : isSideMode
                  ? "h-screen w-full rounded-none border-y-0 border-r-0"
                  : denseViewport
                    ? "h-[min(74dvh,calc(100dvh-0.75rem))] max-h-[calc(100dvh-0.75rem)] w-[min(27.5rem,calc(100vw-5.5rem))] rounded-4xl"
                    : compactViewport
                      ? "h-[min(76dvh,calc(100dvh-1rem))] max-h-[calc(100dvh-1rem)] w-[min(27.5rem,calc(100vw-5.5rem))] rounded-4xl"
                      : "h-170 max-h-[calc(100dvh-1.5rem)] w-110 max-w-[calc(100vw-5.5rem)] rounded-4xl"
            }`}
          >
              <div
                className={`relative overflow-hidden border-b border-[rgba(15,23,42,0.1)] [background-image:var(--tc-brand-gradient-strong)] text-white ${denseViewport ? "px-4 py-3" : "px-5 py-4"}`}
              >
                <div className="absolute inset-0 [background-image:var(--tc-brand-overlay)]" aria-hidden />
                <div className="absolute inset-x-0 bottom-0 h-px [background-image:var(--tc-brand-divider)]" aria-hidden />
                <div className="relative flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <div className={`flex shrink-0 items-center justify-center ${denseViewport ? "h-10 w-10" : "h-12 w-12"}`}>
                      <TCLogoSpinner size="md" />
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <p className="truncate text-[0.58rem] font-semibold uppercase tracking-[0.34em] text-white/72">Testing Company</p>
                      <div className="min-w-0">
                        <h3 className={`${denseViewport ? "text-[1rem]" : hasConversation ? "text-[1.05rem]" : "text-[1.35rem]"} truncate font-black tracking-[-0.03em] text-white`}>
                          {brainOpenContext?.source === "brain" ? "Brain" : "Brain"}
                        </h3>
                        <p className={`max-w-[20rem] truncate ${compactConversationChrome ? "text-[0.74rem] leading-4.5" : denseViewport ? "text-[0.76rem] leading-5" : "text-sm leading-6"} text-white/82`}>
                          {brainOpenContext?.nodeLabel ? `${brainOpenContext.nodeLabel} — ${brainOpenContext.nodeType ?? "nó"}` : activeScreenLabel}
                        </p>
                      </div>
                      <div className={`pt-1 text-[0.72rem] leading-5 text-white/70 ${compactConversationChrome ? "hidden" : ""}`}>
                        Eu acompanho o que voce esta fazendo, explico o caminho e executo acoes seguras quando a tela permitir.
                      </div>
                      {brainOpenContext?.source === "brain" ? (
                        <div className="flex max-w-full flex-wrap gap-1.5 pt-1.5">
                          {ASSISTANT_AGENTS.map(({ mode, icon, name }) => {
                            const isActive = (activeAgentMode ?? (brainOpenContext?.agentMode as AgentMode | undefined) ?? "qa") === mode;
                            return (
                              <button
                                key={mode}
                                type="button"
                                onClick={() => setActiveAgentMode(mode)}
                                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.6rem] font-semibold transition ${
                                  isActive
                                    ? "border-white/35 bg-white/22 text-white"
                                    : "border-white/12 bg-white/5 text-white/55 hover:bg-white/14 hover:text-white/80"
                                }`}
                                aria-pressed={isActive}
                              >
                                <span>{icon}</span>
                                <span>{name}</span>
                              </button>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {panelMode === "compact" ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setPanelMode("expanded")}
                          className={panelControlClass}
                          aria-label="Expandir Brain"
                          title="Expandir Brain"
                        >
                          <FiMaximize2 size={denseViewport ? 13 : 15} aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={() => setPanelMode("side")}
                          className={panelControlClass}
                          aria-label="Fixar Brain na lateral"
                          title="Fixar na lateral"
                        >
                          <FiSidebar size={denseViewport ? 13 : 15} aria-hidden />
                        </button>
                      </>
                    ) : null}
                    {panelMode === "side" ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setPanelMode("expanded")}
                          className={panelControlClass}
                          aria-label="Expandir Brain"
                          title="Expandir Brain"
                        >
                          <FiMaximize2 size={denseViewport ? 13 : 15} aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={() => setPanelMode("compact")}
                          className={panelControlClass}
                          aria-label="Voltar Brain ao modo normal"
                          title="Modo normal"
                        >
                          <FiMinimize2 size={denseViewport ? 13 : 15} aria-hidden />
                        </button>
                      </>
                    ) : null}
                    {panelMode === "expanded" ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setPanelMode("side")}
                          className={panelControlClass}
                          aria-label="Fixar Brain na lateral"
                          title="Fixar na lateral"
                        >
                          <FiSidebar size={denseViewport ? 13 : 15} aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={() => setPanelMode("compact")}
                          className={panelControlClass}
                          aria-label="Voltar Brain ao modo normal"
                          title="Modo normal"
                        >
                          <FiMinimize2 size={denseViewport ? 13 : 15} aria-hidden />
                        </button>
                      </>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className={panelControlClass}
                      aria-label="Fechar Brain"
                      title="Fechar Brain"
                    >
                      <FiX size={denseViewport ? 13 : 15} aria-hidden />
                    </button>
                  </div>
                </div>
              </div>

              <div className={`min-h-0 flex-1 ${hasConversation ? "overflow-y-auto" : "overflow-y-hidden"} bg-[radial-gradient(circle_at_top_right,rgba(239,0,1,0.04),transparent_26%),linear-gradient(180deg,#f6f9ff_0%,#ffffff_28%,#ffffff_100%)] dark:bg-[radial-gradient(circle_at_top_right,rgba(239,0,1,0.08),transparent_26%),linear-gradient(180deg,#0e182b_0%,#111d33_34%,#0b1424_100%)] ${denseViewport ? "space-y-4 px-4 py-4" : hasConversation ? "space-y-4 px-4 py-4" : "space-y-5 px-5 py-5"}`}>
                {messages.length === 0 ? (
                  <div className={`rounded-[1.6rem] border border-[#dfe6f3] bg-[#ffffff] shadow-[0_18px_40px_rgba(15,23,42,0.06)] dark:border-[#36507f] dark:bg-[#13213a] dark:shadow-[0_18px_40px_rgba(0,0,0,0.28)] ${denseViewport ? "p-4" : "p-5"}`}>
                    {brainOpenContext?.nodeId ? (
                      <>
                        <p className="text-[0.62rem] font-bold uppercase tracking-[0.24em] text-[#ef0001] dark:text-[#ff8a8a]">
                          Contexto do Brain — {brainOpenContext.nodeType ?? "Nó"}
                        </p>
                        <p className="mt-1 text-base font-bold text-[#011848] dark:text-[#f2f7ff]">
                          {brainOpenContext.nodeLabel ?? "Nó selecionado"}
                        </p>
                        <p className="mt-1 text-sm text-[#4a5568] dark:text-[#a0b4d0]">
                          Agente: {activeAgentMode ?? brainOpenContext.agentMode ?? "qa"} | escopo {brainOpenContext.companySlug ?? "global"}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-base font-bold text-[#ef0001] dark:text-[#ff8a8a]">Estou contigo nesta tela.</p>
                        <p className="mt-2 text-base leading-7 text-[#011848] dark:text-[#d7e5ff]">
                          Pode falar do seu jeito. Eu observo o contexto, penso no melhor caminho e, quando a acao existir aqui, eu filtro, busco, abro, explico ou preparo a decisao com voce.
                        </p>
                        <p className="mt-3 text-sm leading-6 text-[#4a5a78] dark:text-[#a9bad8]">
                          Exemplos naturais: procura Ana, abre a primeira, me explica esse fluxo, o que falta para aprovar? ou filtra recusadas.
                        </p>
                      </>
                    )}
                  </div>
                ) : null}
                {messages.map((message, index) => {
                  const isUser = message.from === "user";
                  return (
                    <div
                      key={message.id}
                      className={`${styles.msgEnter} flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}
                      data-delay={Math.min(index, 10)}
                    >
                      {!isUser ? (
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[rgba(1,24,72,0.08)] bg-[linear-gradient(135deg,#ffffff_0%,#eef3ff_62%,#fff6f8_100%)] shadow-[0_10px_24px_rgba(1,24,72,0.1)] dark:border-[#31476f] dark:bg-[linear-gradient(135deg,#13213a_0%,#182742_62%,#221729_100%)] dark:shadow-[0_10px_24px_rgba(0,0,0,0.28)]">
                          <TCLogoSpinner size="sm" />
                        </div>
                      ) : null}

                      <div className={`max-w-[82%] space-y-2 ${isUser ? "items-end" : "items-start"}`}>
                        <div
                          className={`rounded-[1.35rem] border px-4 py-3 text-sm leading-6 shadow-[0_12px_28px_rgba(15,23,42,0.06)] ${
                            isUser
                              ? "border-[rgba(239,0,1,0.16)] bg-[linear-gradient(135deg,var(--tc-accent,#ef0001)_0%,#c90000_100%)] text-white"
                              : "border-(--tc-border,#dfe6f3) bg-[linear-gradient(180deg,#ffffff_0%,#f9fbff_100%)] text-[#011848] dark:border-[#36507f] dark:bg-[linear-gradient(180deg,#13213a_0%,#182742_100%)] dark:text-[#e6efff] [&_p]:text-base"
                          }`}
                        >
                          {!isUser && message.tool ? (
                            <div className="mb-2 inline-flex rounded-full border border-(--tc-border,#d7dff1) bg-[linear-gradient(180deg,#f7faff_0%,#fff7f8_100%)] px-2.5 py-1 text-[0.62rem] font-bold uppercase tracking-[0.24em] text-(--tc-primary,#011848) dark:border-[#36507f] dark:bg-[linear-gradient(180deg,#1a2b48_0%,#241a2d_100%)] dark:text-[#d7e5ff]">
                              {formatToolLabel(message.tool)}
                            </div>
                          ) : null}
                          {isUser ? (
                            <p className="whitespace-pre-wrap">{message.text}</p>
                          ) : (
                            <ChatRichText text={message.text} />
                          )}
                        </div>

                        {message.actions?.length ? (
                          <div className={`flex flex-wrap gap-2 ${isUser ? "justify-end" : "justify-start"}`}>
                            {message.actions.map((action, index) => (
                              <button
                                key={`${message.id}-${index}-${action.label}`}
                                type="button"
                                onClick={() => handleAction(action)}
                                disabled={sending}
                                data-delay={index}
                                className={`${styles.actionEnter} inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold transition active:scale-95 ${
                                  action.kind === "tool"
                                    ? "border border-[rgba(1,24,72,0.12)] bg-[linear-gradient(135deg,var(--tc-primary,#011848)_0%,#173a88_100%)] text-white hover:bg-[linear-gradient(135deg,#132a63_0%,#214ca8_100%)]"
                                    : "border border-(--tc-border,#d7dff1) bg-[#ffffff] text-(--tc-primary,#011848) hover:border-[rgba(239,0,1,0.2)] hover:text-(--tc-accent,#ef0001) dark:border-[#36507f] dark:bg-[#13213a] dark:text-[#d7e5ff] dark:hover:border-[#ff8a8a] dark:hover:text-[#ffb4b4]"
                                } disabled:opacity-60`}
                              >
                                {action.kind === "tool" ? <FiZap size={12} /> : <FiChevronRight size={12} />}
                                {action.label}
                              </button>
                            ))}
                          </div>
                        ) : null}

                        <div className={`flex items-center gap-2 text-[0.68rem] text-[#8a96ad] dark:text-[#94abd6] ${isUser ? "justify-end" : "justify-start"}`}>
                          <span>{formatTime(message.ts)}</span>
                        </div>
                      </div>

                      {isUser ? <UserAvatar src={user.avatarUrl} name={user.name} size="sm" className="h-11 w-11 shrink-0" /> : null}
                    </div>
                  );
                })}

                <div ref={endRef} />
              </div>

              <div className={`border-t border-(--tc-border,#dfe6f3) bg-[linear-gradient(180deg,#ffffff_0%,#f9fbff_100%)] dark:border-[#31476f] dark:bg-[linear-gradient(180deg,#0f192d_0%,#13213a_100%)] ${denseViewport ? "px-4 py-2.5" : hasConversation ? "px-4 py-3" : "px-5 py-4.5"}`}>
                <div className={`rounded-3xl border border-(--tc-border,#dfe6f3) bg-[linear-gradient(180deg,#f8fbff_0%,#fff7fa_100%)] shadow-[0_14px_28px_rgba(15,23,42,0.05)] dark:border-[#36507f] dark:bg-[linear-gradient(180deg,#13213a_0%,#182742_100%)] dark:shadow-[0_14px_28px_rgba(0,0,0,0.24)] ${denseViewport ? "p-2.5" : hasConversation ? "p-2.5" : "p-3.5"}`}>
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        void sendMessage();
                      }
                    }}
                    placeholder={`Escreva o que você precisa em ${assistantContext.screenLabel.toLowerCase()}...`}
                    className={`w-full resize-none rounded-[1.1rem] border border-(--tc-border,#d7dff1) bg-[#ffffff] px-4 text-sm leading-6 text-[#20304f] outline-none placeholder:text-[#8b98b1] focus:border-(--tc-accent,#ef0001) dark:border-[#36507f] dark:bg-[#0f192d] dark:text-[#e6efff] dark:placeholder:text-[#94abd6] dark:focus:border-[#ff8a8a] ${denseViewport ? "min-h-[2.7rem] py-1.5" : hasConversation ? "min-h-[2.85rem] py-1.5" : "min-h-[5.6rem] py-3"}`}
                  />
                  <div className={`flex items-center justify-between gap-3 ${denseViewport ? "mt-1.5" : hasConversation ? "mt-2" : "mt-3"}`}>
                    <button
                      type="button"
                      onClick={() => setConfirmState({ open: true, kind: "clearAll" })}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-(--tc-border,#dfe6f3) bg-white text-[#8b98b1] transition hover:border-[rgba(239,0,1,0.24)] hover:text-(--tc-accent,#ef0001) dark:border-[#36507f] dark:bg-[#0f192d] dark:text-[#94abd6] dark:hover:text-[#ff8a8a]"
                      aria-label="Limpar conversa"
                      title="Limpar conversa"
                    >
                      <FiTrash2 size={15} aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => void sendMessage()}
                      disabled={sending || !input.trim()}
                      className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--tc-primary,#011848)_0%,#1f4aa3_100%)] text-white shadow-[0_14px_28px_rgba(11,26,60,0.2)] transition hover:-translate-y-px hover:bg-[linear-gradient(135deg,var(--tc-accent,#ef0001)_0%,#c70000_100%)] disabled:cursor-not-allowed disabled:opacity-60 ${sending ? "animate-pulse" : ""}`}
                      aria-label={sending ? "Enviando mensagem" : "Enviar mensagem"}
                      aria-busy={sending}
                      title={sending ? "Enviando" : "Enviar"}
                    >
                      <FiSend size={16} aria-hidden />
                    </button>
                  </div>
                </div>
              </div>
          </div>
        </div>
      ) : null}

      <div className={`qc-brain-launcher fixed bottom-6 right-6 z-50 ${open ? "hidden" : ""}`}>
          <button
            type="button"
            onClick={() => {
              if (open) {
                setOpen(false);
                return;
              }
              setPanelMode("compact");
              setOpen(true);
            }}
            aria-label="Abrir brain da plataforma"
            title="Brain Testing Company — clique para abrir"
            className="group relative flex h-14 w-14 items-center justify-center rounded-full shadow-[0_18px_35px_rgba(1,24,72,0.22)] transition hover:scale-105"
          >
            {/* spinning logo with gradient background */}
            <div className="absolute inset-0 rounded-full bg-[linear-gradient(135deg,#011848_0%,#6b0000_55%,#ef0001_100%)] shadow-[0_8px_24px_rgba(1,24,72,0.4)]" />
            <div className="absolute inset-0.75 rounded-full overflow-hidden flex items-center justify-center">
              <div className="relative w-full h-full">
                <Image
                  src="/images/tc.png"
                  alt="Brain Testing Company"
                  fill
                  sizes="56px"
                  className="select-none pointer-events-none object-contain animate-spin-slower"
                />
              </div>
              {/* tooltip */}
              <span className="pointer-events-none absolute bottom-[calc(100%+0.5rem)] right-0 whitespace-nowrap rounded-xl bg-[#011848] px-3 py-1.5 text-xs font-semibold text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                Brain Testing Company
                <span className="absolute -bottom-1.25 right-5 h-2.5 w-2.5 rotate-45 bg-[#011848]" />
              </span>
            </div>
          </button>
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
