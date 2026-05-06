"use client";

import { useRef, useState, useEffect } from "react";
import styles from "./AgentView.module.css";

type AgentMode = "qa" | "debug" | "playwright" | "memory";

const AGENTS: Record<AgentMode, { name: string; icon: string; label: string; color: string }> = {
  qa: { name: "QA Analyst", icon: "\uD83D\uDD0D", label: "Analisa riscos e cobertura de testes", color: "#5b92ff" },
  debug: { name: "Debug Agent", icon: "\uD83D\uDC1B", label: "Diagn\u00f3stico de problemas e causa raiz", color: "#f59e0b" },
  playwright: { name: "Playwright Agent", icon: "\uD83C\uDFAD", label: "Gera specs e automa\u00e7\u00f5es Playwright", color: "#10b981" },
  memory: { name: "Memory Agent", icon: "\uD83E\uDDE0", label: "Recupera conhecimento e decis\u00f5es do Brain", color: "#a78bfa" },
};

const AGENT_ACTIVE_CLASSES: Record<AgentMode, string> = {
  qa: "data-[active=true]:border-[#5b92ff] data-[active=true]:bg-[#5b92ff]/13 data-[active=true]:text-[#5b92ff]",
  debug: "data-[active=true]:border-[#f59e0b] data-[active=true]:bg-[#f59e0b]/13 data-[active=true]:text-[#f59e0b]",
  playwright: "data-[active=true]:border-[#10b981] data-[active=true]:bg-[#10b981]/13 data-[active=true]:text-[#10b981]",
  memory: "data-[active=true]:border-[#a78bfa] data-[active=true]:bg-[#a78bfa]/13 data-[active=true]:text-[#a78bfa]",
};

type ToolCallEvent = {
  id: string;
  toolName: string;
  args: Record<string, unknown>;
  result?: unknown;
  status: "running" | "done" | "error";
  startedAt: number;
  endedAt?: number;
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: ToolCallEvent[];
  agentMode?: AgentMode;
};

const TOOL_LABELS: Record<string, { icon: string; label: string }> = {
  search_brain: { icon: "\uD83D\uDD2D", label: "Busca no Brain" },
  get_metrics: { icon: "\uD83D\uDCCA", label: "M\u00e9tricas do grafo" },
  analyze_coverage: { icon: "\uD83D\uDCCB", label: "An\u00e1lise de cobertura" },
  generate_test_spec: { icon: "\uD83D\uDCDD", label: "Gerar spec Playwright" },
  find_patterns: { icon: "\uD83D\uDD0E", label: "Padr\u00f5es e tend\u00eancias" },
};

function ToolCallCard({ call }: { call: ToolCallEvent }) {
  const [expanded, setExpanded] = useState(false);
  const info = TOOL_LABELS[call.toolName] ?? { icon: "\u2699\uFE0F", label: call.toolName };
  const elapsed = call.endedAt
    ? `${((call.endedAt - call.startedAt) / 1000).toFixed(2)}s`
    : null;

  return (
    <div
      data-testid={`tool-call-${call.toolName}`}
      className="mt-1.5 rounded-xl border border-[rgba(91,146,255,0.18)] bg-[rgba(91,146,255,0.06)] px-3 py-2 text-xs"
    >
      <button
        type="button"
        className="flex w-full cursor-pointer items-center gap-2 border-none bg-transparent p-0 text-inherit"
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="text-sm">{info.icon}</span>
        <span className="flex-1 text-left font-semibold text-[#c7d2e8]">
          {info.label}
        </span>
        {call.status === "running" ? (
          <span data-testid="tool-running" className="animate-pulse text-[#5b92ff]">
            \u23f3 executando\u2026
          </span>
        ) : call.status === "error" ? (
          <span className="text-[#ef4444]">\u2717 erro</span>
        ) : (
          <span className="text-[#10b981]">\u2713 {elapsed}</span>
        )}
        <span className="ml-1 text-[#6c7fa4]">{expanded ? "\u25b2" : "\u25bc"}</span>
      </button>

      {expanded && (
        <div className="mt-2">
          <div className="mb-1 text-[#6c7fa4]">Args:</div>
          <pre className="m-0 max-h-30 overflow-auto rounded-lg bg-black/30 px-2.5 py-1.5 text-[11px] text-[#c7d2e8]">
            {JSON.stringify(call.args, null, 2)}
          </pre>
          {call.result !== undefined && (
            <>
              <div className="mb-1 mt-1.5 text-[#6c7fa4]">Resultado:</div>
              <pre className="m-0 max-h-40 overflow-auto rounded-lg bg-black/30 px-2.5 py-1.5 text-[11px] text-[#10b981]">
                {JSON.stringify(call.result, null, 2)}
              </pre>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";
  const agent = msg.agentMode ? AGENTS[msg.agentMode] : null;

  return (
    <div
      data-testid={`agent-message-${msg.role}`}
      className={`mb-3 flex flex-col ${isUser ? "items-end" : "items-start"}`}
    >
      {!isUser && agent && (
        <div
          className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-(--agent-color)"
        >
          <span>{agent.icon}</span>
          <span>{agent.name}</span>
        </div>
      )}
      <div
        className={`max-w-[88%] px-3.5 py-2.5 ${
          isUser
            ? "rounded-tl-2xl rounded-tr-2xl rounded-br-sm rounded-bl-2xl border border-[rgba(91,146,255,0.32)] bg-[rgba(91,146,255,0.18)]"
            : "rounded-tl-sm rounded-tr-2xl rounded-br-2xl rounded-bl-2xl border border-white/8 bg-white/4"
        }`}
      >
        <p className="m-0 whitespace-pre-wrap wrap-break-word text-[13px] leading-[1.6] text-slate-200">
          {msg.content || (
            <span data-testid="agent-thinking" className="italic text-[#6c7fa4]">
              pensando\u2026
            </span>
          )}
        </p>
        {(msg.toolCalls?.length ?? 0) > 0 && (
          <div className="mt-2">
            {msg.toolCalls!.map((tc) => (
              <ToolCallCard key={tc.id} call={tc} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AgentView({
  nodeId,
  darkMode = true,
}: {
  nodeId?: string | null;
  darkMode?: boolean;
}) {
  const [mode, setMode] = useState<AgentMode>("qa");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages]);

  async function sendMessage() {
    if (!input.trim() || loading) return;

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: "user",
      content: input.trim(),
    };
    const assistantId = `a-${Date.now() + 1}`;
    const assistantMsg: Message = {
      id: assistantId,
      role: "assistant",
      content: "",
      toolCalls: [],
      agentMode: mode,
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput("");
    setLoading(true);

    abortRef.current = new AbortController();

    try {
      const allMessages = [...messages, userMsg];
      const res = await fetch("/api/brain/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        signal: abortRef.current.signal,
        body: JSON.stringify({
          messages: allMessages.map((m) => ({ role: m.role, content: m.content })),
          nodeId: nodeId ?? undefined,
          agentMode: mode,
        }),
      });

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const toolCallMap = new Map<string, ToolCallEvent>();

      const updateAssistant = (updater: (prev: Message) => Message) => {
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? updater(m) : m)),
        );
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const part = JSON.parse(line) as Record<string, unknown>;
            const type = part.type as string;

            if (type === "text-delta") {
              const delta = part.text as string;
              updateAssistant((m) => ({ ...m, content: m.content + delta }));
            } else if (type === "tool-input-start") {
              const id = part.id as string;
              const toolName = part.toolName as string;
              const tc: ToolCallEvent = {
                id,
                toolName,
                args: {},
                status: "running",
                startedAt: Date.now(),
              };
              toolCallMap.set(id, tc);
              updateAssistant((m) => ({
                ...m,
                toolCalls: [...(m.toolCalls ?? []), tc],
              }));
            } else if (type === "tool-call") {
              const id = part.toolCallId as string;
              const toolName = part.toolName as string;
              const args = part.input as Record<string, unknown>;
              const existing = toolCallMap.get(id);
              if (existing) {
                existing.args = args;
                toolCallMap.set(id, existing);
              } else {
                const tc: ToolCallEvent = {
                  id,
                  toolName,
                  args,
                  status: "running",
                  startedAt: Date.now(),
                };
                toolCallMap.set(id, tc);
              }
              updateAssistant((m) => ({
                ...m,
                toolCalls: (m.toolCalls ?? []).map((tc) =>
                  tc.id === id
                    ? { ...tc, toolName, args: args ?? tc.args }
                    : tc,
                ),
              }));
            } else if (type === "tool-result") {
              const id = part.toolCallId as string;
              const result = part.output;
              const tc = toolCallMap.get(id);
              if (tc) {
                tc.result = result;
                tc.status = "done";
                tc.endedAt = Date.now();
                toolCallMap.set(id, tc);
              }
              updateAssistant((m) => ({
                ...m,
                toolCalls: (m.toolCalls ?? []).map((tc) =>
                  tc.id === id
                    ? { ...tc, result, status: "done" as const, endedAt: Date.now() }
                    : tc,
                ),
              }));
            } else if (type === "tool-error") {
              const id = part.toolCallId as string;
              updateAssistant((m) => ({
                ...m,
                toolCalls: (m.toolCalls ?? []).map((tc) =>
                  tc.id === id ? { ...tc, status: "error" as const } : tc,
                ),
              }));
            } else if (type === "error") {
              const errMsg = (part.error as string) || "Erro ao processar resposta do agente.";
              updateAssistant((m) => ({
                ...m,
                content: m.content || errMsg,
              }));
            }
          } catch {
            // skip malformed lines
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: "Erro ao contatar o agente." }
            : m,
        ),
      );
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  const agentInfo = AGENTS[mode];

  return (
    <div
      data-testid="agent-view"
      data-dark={String(darkMode)}
      data-mode={mode}
      className={`${styles.root} flex h-full flex-col font-[inherit] ${
        darkMode ? "bg-[rgba(7,19,40,0.98)] text-slate-200" : "bg-slate-50 text-slate-900"
      }`}
    >
      {/* Agent selector */}
      <div className="flex flex-wrap gap-1.5 border-b border-(--border-clr) px-3.5 pb-2 pt-2.5">
        {(Object.entries(AGENTS) as [AgentMode, typeof AGENTS[AgentMode]][]).map(
          ([key, agent]) => (
            <button
              key={key}
              type="button"
              data-testid={`agent-selector-${key}`}
              data-active={mode === key}
              onClick={() => setMode(key)}
              className={`flex cursor-pointer items-center gap-1 rounded-full border border-(--border-clr) bg-transparent px-2.5 py-1 text-[11px] font-normal text-(--muted-clr) transition-all duration-150 data-[active=true]:font-bold ${AGENT_ACTIVE_CLASSES[key]}`}
            >
              <span>{agent.icon}</span>
              <span>{agent.name}</span>
            </button>
          ),
        )}
      </div>

      {/* Active agent info */}
      <div className="flex items-center gap-1.5 border-b border-(--border-clr) px-3.5 py-1.5 text-[11px] text-(--agent-color)">
        <span>{agentInfo.icon}</span>
        <span className="font-semibold">{agentInfo.name}</span>
        <span className="text-(--muted-clr)">
          \u2014 {agentInfo.label}
        </span>
        {loading && (
          <span
            data-testid="agent-loading"
            className="ml-auto text-(--agent-color)"
          >
            \u23f3 processando\u2026
          </span>
        )}
      </div>

      {/* Messages */}
      <div
        ref={containerRef}
        data-testid="agent-messages"
        className="flex flex-1 flex-col overflow-y-auto px-3.5 pb-2 pt-3.5"
      >
        {messages.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
            <span className="text-4xl">{agentInfo.icon}</span>
            <p className="m-0 text-[13px] text-(--muted-clr)">
              {agentInfo.label}
            </p>
            <div className="mt-1 flex flex-wrap justify-center gap-1.5">
              {getQuickPrompts(mode).map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  className="cursor-pointer rounded-2xl border border-(--border-clr) bg-transparent px-3 py-1 text-[11px] text-(--prompt-clr) transition-opacity hover:opacity-80"
                  onClick={() => setInput(prompt)}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => <MessageBubble key={msg.id} msg={msg} />)
        )}
      </div>

      {/* Input */}
      <div className="flex items-end gap-2 border-t border-(--border-clr) px-3.5 py-2.5">
        <textarea
          data-testid="agent-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Perguntar ao ${agentInfo.name}\u2026 (Enter para enviar)`}
          rows={2}
          disabled={loading}
          className="flex-1 resize-none rounded-xl border border-(--border-clr) bg-(--input-bg) px-3 py-2 font-[inherit] text-[13px] text-(--text-clr) outline-none"
        />
        <button
          type="button"
          data-testid="agent-send"
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          className="cursor-pointer rounded-xl border-none bg-(--agent-color) px-4 py-2 text-[13px] font-semibold text-white transition-all duration-150 disabled:cursor-not-allowed disabled:bg-(--border-clr) disabled:text-(--muted-clr)"
        >
          {loading ? "\u2026" : "Enviar"}
        </button>
      </div>
    </div>
  );
}

function getQuickPrompts(mode: AgentMode): string[] {
  const prompts: Record<AgentMode, string[]> = {
    qa: [
      "Qual empresa tem mais defeitos ativos?",
      "Analise a cobertura global de testes",
      "Encontre padr\u00f5es de falha recorrentes",
    ],
    debug: [
      "Quais defeitos t\u00eam mais conex\u00f5es no grafo?",
      "Mostre os n\u00f3s com maior grau de entrada",
      "Identifique anomalias no Brain",
    ],
    playwright: [
      "Gere spec para o fluxo de login",
      "Crie teste para a p\u00e1gina de defeitos",
      "Spec para cria\u00e7\u00e3o de runs",
    ],
    memory: [
      "Quais s\u00e3o os aprendizados mais importantes?",
      "Mostre decis\u00f5es com alta import\u00e2ncia",
      "Recupere padr\u00f5es hist\u00f3ricos de qualidade",
    ],
  };
  return prompts[mode];
}
