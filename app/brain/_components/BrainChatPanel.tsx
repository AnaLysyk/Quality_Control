"use client";

import { useState } from "react";
import { FiSend } from "react-icons/fi";
import type { BrainChatMessage } from "../_types/brain.types";

type BrainChatPanelProps = {
  messages: BrainChatMessage[];
  onCommand: (command: string) => void;
};

export function BrainChatPanel({ messages, onCommand }: BrainChatPanelProps) {
  const [value, setValue] = useState("");

  function submit() {
    const next = value.trim();
    if (!next) return;
    setValue("");
    onCommand(next);
  }

  return (
    <section className="rounded-[24px] border border-slate-200 bg-white shadow-[0_18px_44px_rgba(15,23,42,0.07)] dark:border-slate-700 dark:bg-slate-900">
      <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#ef0001] dark:text-rose-200">Conversa</p>
        <h2 className="mt-1 text-xl font-black text-slate-950 dark:text-white">Brain</h2>
      </div>
      <div className="max-h-96 space-y-3 overflow-y-auto px-5 py-4">
        {messages.map((message) => (
          <div key={message.id} className={`rounded-2xl px-4 py-3 text-sm leading-6 ${
            message.from === "user"
              ? "ml-8 bg-[#011848] font-semibold text-white"
              : "mr-8 border border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-200"
          }`}>
            <p className="whitespace-pre-wrap">{message.text}</p>
          </div>
        ))}
      </div>
      <div className="border-t border-slate-100 p-4 dark:border-slate-800">
        <div className="flex gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-950/60">
          <textarea
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submit();
              }
            }}
            placeholder="Pergunte sobre nos, logs, conexoes ou solicitacoes..."
            className="min-h-12 flex-1 resize-none bg-transparent px-3 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100"
          />
          <button
            type="button"
            onClick={submit}
            disabled={!value.trim()}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#ef0001] text-white transition hover:bg-[#c90000] disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Enviar mensagem ao Brain"
          >
            <FiSend />
          </button>
        </div>
      </div>
    </section>
  );
}
