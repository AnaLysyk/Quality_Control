"use client";

import { useState } from "react";
import { FiSend } from "react-icons/fi";
import type { BrainChatMessage } from "../_types/brain.types";

type BrainChatDockProps = {
  messages: BrainChatMessage[];
  onCommand: (command: string) => void;
};

export function BrainChatDock({ messages, onCommand }: BrainChatDockProps) {
  const [value, setValue] = useState("");

  function submit() {
    const command = value.trim();
    if (!command) return;
    setValue("");
    onCommand(command);
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.05] text-white shadow-[0_24px_70px_rgba(0,0,0,0.22)] backdrop-blur-xl">
      <div className="border-b border-white/10 px-4 py-3">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200/80">Dock</p>
        <h2 className="mt-1 text-base font-black">Perguntar ao Brain</h2>
      </div>
      <div className="max-h-72 space-y-3 overflow-y-auto px-4 py-3">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`rounded-2xl px-3 py-2 text-xs font-semibold leading-5 ${
              message.from === "user" ? "ml-8 bg-cyan-200 text-[#021026]" : "mr-5 border border-white/10 bg-black/18 text-white/78"
            }`}
          >
            <p className="whitespace-pre-wrap">{message.text}</p>
          </div>
        ))}
      </div>
      <div className="border-t border-white/10 p-3">
        <div className="flex gap-2 rounded-2xl border border-white/10 bg-black/18 p-2">
          <textarea
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submit();
              }
            }}
            placeholder="mostra nos orfaos..."
            className="min-h-11 flex-1 resize-none bg-transparent px-2 py-2 text-xs font-semibold text-white outline-none placeholder:text-white/35"
          />
          <button
            type="button"
            onClick={submit}
            disabled={!value.trim()}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cyan-200 text-[#021026] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-45"
            aria-label="Enviar mensagem"
          >
            <FiSend className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  );
}
