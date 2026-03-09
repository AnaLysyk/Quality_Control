"use client";

import { useEffect, useRef, useState } from "react";
import { FiZap, FiX, FiSend } from "react-icons/fi";
import { usePermissionAccess } from "@/hooks/usePermissionAccess";
import ConfirmDialog from "./ConfirmDialog";

type Msg = { id: string; from: "user" | "assistant"; text: string; ts: number };

export default function ChatButton() {
  const { user, can } = usePermissionAccess();
  const assistantEnabled = process.env.NEXT_PUBLIC_AI_ASSISTANT_ENABLED !== "false";
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const HISTORY_KEY_PREFIX = "chat_history_v1";
  const [confirmState, setConfirmState] = useState<
    | { action: "clear" | "clearAll"; open: true }
    | { open: false }
  >({ open: false });

  useEffect(() => {
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
  }, []);

  useEffect(() => {
    // Auto-scroll to the end when messages change
    try {
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    } catch {
      /* ignore scrolling errors */
    }
  }, [messages]);

  useEffect(() => {
    // Load history from localStorage for this user
    try {
      const key = `${HISTORY_KEY_PREFIX}:${user?.id ?? "anon"}`;
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          // keep only last 200 messages to avoid runaway storage
          setMessages(parsed.slice(-200));
        }
      }
    } catch {
      /* ignore parse errors */
    }
    // only run on mount or when user id changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    // Persist messages to localStorage when they change
    try {
      const key = `${HISTORY_KEY_PREFIX}:${user?.id ?? "anon"}`;
      localStorage.setItem(key, JSON.stringify(messages.slice(-200)));
    } catch {
      /* ignore storage errors */
    }
  }, [messages, user?.id]);

  if (!assistantEnabled) return null;
  if (!user) return null;
  if (!can("ai", "view") || !can("ai", "use")) return null;

  async function sendMessage() {
    if (sending) return; // prevent duplicate sends
    const text = input.trim();
    if (!text) return;
    setSending(true);
    const userMsg: Msg = { id: crypto?.randomUUID ? crypto.randomUUID() : `u-${Date.now()}`, from: "user", text, ts: Date.now() };
    setMessages((s) => [...s, userMsg]);
    setInput("");
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message: text }),
      });
      if (!res.ok) {
        const bodyText = await res.text().catch(() => "");
        const errMsg = bodyText || res.statusText || `Erro ${res.status}`;
        const botMsg: Msg = { id: crypto?.randomUUID ? crypto.randomUUID() : `a-${Date.now()}`, from: "assistant", text: `Erro: ${errMsg}`, ts: Date.now() };
        setMessages((s) => [...s, botMsg]);
        return;
      }
      const json = await res.json().catch(() => ({}));
      const reply = json?.reply ?? json?.error ?? "Sem resposta";
      const botMsg: Msg = { id: crypto?.randomUUID ? crypto.randomUUID() : `a-${Date.now()}`, from: "assistant", text: String(reply), ts: Date.now() };
      setMessages((s) => [...s, botMsg]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao enviar mensagem";
      const botMsg: Msg = { id: crypto?.randomUUID ? crypto.randomUUID() : `a-${Date.now()}`, from: "assistant", text: `Erro: ${msg}`, ts: Date.now() };
      setMessages((s) => [...s, botMsg]);
    } finally {
      setSending(false);
    }
  }

  function confirmCancel() {
    setConfirmState({ open: false });
  }

  function confirmExecute() {
    if (confirmState.open) {
      try {
        if ((confirmState as any).action === "clear") {
          const key = `${HISTORY_KEY_PREFIX}:${user?.id ?? "anon"}`;
          localStorage.removeItem(key);
          setMessages([]);
        } else if ((confirmState as any).action === "clearAll") {
          const prefix = `${HISTORY_KEY_PREFIX}:`;
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith(prefix)) {
              localStorage.removeItem(k);
              i = -1;
            }
          }
          setMessages([]);
        }
      } catch {
        /* ignore */
      }
    }
    setConfirmState({ open: false });
  }

  return (
    <div className="relative" ref={boxRef}>
      <div className="fixed bottom-6 right-6 z-50">
        <div className="flex items-end">
          {open && (
            <div className="mr-3 w-88 max-w-[calc(100vw-2rem)] rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#ffffff) shadow-[0_20px_45px_rgba(15,23,42,0.2)]">
              <div className="flex items-center justify-between gap-3 border-b border-(--tc-border,#e5e7eb) px-4 py-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-(--tc-text-muted,#6b7280)">Assistente</p>
                  <p className="text-sm font-semibold text-(--tc-text-primary,#0b1a3c)">Chat de IA</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmState({ action: "clear", open: true })}
                    aria-label="Limpar histórico"
                    title="Limpar histórico"
                    className="rounded-md px-2 py-1 text-xs text-(--tc-text-muted,#6b7280) hover:underline"
                  >
                    Limpar
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmState({ action: "clearAll", open: true })}
                    aria-label="Limpar tudo"
                    title="Limpar tudo"
                    className="rounded-md px-2 py-1 text-xs text-(--tc-text-muted,#6b7280) hover:underline"
                  >
                    Limpar tudo
                  </button>
                  {/* Logout moved to ProfileButton; Chat only offers clear actions */}
                  <button type="button" onClick={() => setOpen(false)} aria-label="Fechar chat" title="Fechar chat" className="rounded-full p-1">
                    <FiX />
                  </button>
                </div>
              </div>

              <div className="max-h-[45vh] overflow-auto px-3 py-3 space-y-3">
                {messages.length === 0 && <p className="text-sm text-(--tc-text-muted,#6b7280)">Diga olá ao assistente.</p>}
                {messages.map((m) => (
                  <div key={m.id} className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${m.from === "user" ? "bg-(--tc-accent,#ef0001) text-white" : "bg-slate-100 text-slate-800"}`}>
                      {m.text}
                    </div>
                  </div>
                ))}
                <div ref={endRef} />
              </div>

              <ConfirmDialog
                open={confirmState.open === true}
                title={confirmState.open && (confirmState as any).action === "clear" ? "Confirmar limpeza" : "Confirmar limpeza de todos os históricos"}
                description={confirmState.open && (confirmState as any).action === "clear" ? "Remover histórico local deste usuário?" : "Remover todos os históricos locais no navegador?"}
                onCancel={confirmCancel}
                onConfirm={confirmExecute}
                confirmLabel="Confirmar"
                cancelLabel="Cancelar"
              />

              <div className="border-t border-(--tc-border,#e5e7eb) px-3 py-2">
                <div className="flex gap-2">
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                    placeholder="Escreva uma mensagem..."
                    className="flex-1 rounded-lg border border-(--tc-border,#e5e7eb) bg-white/80 px-3 py-2 text-sm focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={sendMessage}
                    disabled={sending || !input.trim()}
                    aria-label="Enviar mensagem"
                    title="Enviar mensagem"
                    className="inline-flex items-center gap-2 rounded-lg bg-(--tc-accent,#ef0001) px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white disabled:opacity-60"
                  >
                    <FiSend />
                  </button>
                </div>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label="Abrir assistente IA"
            className="flex h-14 w-14 items-center justify-center rounded-full border border-(--tc-border,#e5e7eb)/80 bg-(--tc-surface,#ffffff) text-(--tc-text,#0f172a) shadow-[0_8px_20px_rgba(15,23,42,0.12)] transition hover:border-(--tc-accent,#ef0001)/60 hover:text-(--tc-accent,#ef0001)"
          >
            <FiZap size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
