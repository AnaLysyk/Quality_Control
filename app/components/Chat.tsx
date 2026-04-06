"use client";

import React, { useState, useRef, useEffect } from "react";
import { useSWRChat } from "./useSWRChat";

type LegacyChatMessage = {
  id: string;
  user: string;
  text: string;
  timestamp: string | number;
};

export default function Chat() {
  const { messages, error, mutate, isLoading } = useSWRChat();
  const [input, setInput] = useState("");
  const [user, setUser] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !user.trim()) return;
    const res = await fetch("/api/chat/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user, text: input }),
    });
    if (res.ok) {
      await mutate();
      setInput("");
    }
  };

  return (
    <div className="max-w-md mx-auto border rounded p-4 bg-white shadow">
      <h2 className="text-lg font-bold mb-2">Chat</h2>
      <div className="mb-2">
        <input
          className="border px-2 py-1 rounded w-full mb-2"
          placeholder="Seu nome"
          value={user}
          onChange={(e) => setUser(e.target.value)}
        />
      </div>
      <div className="h-64 overflow-y-auto border p-2 mb-2 bg-gray-50 rounded">
        {isLoading && <div>Carregando mensagens...</div>}
        {error && <div className="text-red-600">Erro ao carregar mensagens</div>}
        {(messages as LegacyChatMessage[]).map((msg) => (
          <div key={msg.id} className="mb-1">
            <span className="font-semibold">{msg.user}:</span> {msg.text}
            <span className="text-xs text-gray-400 ml-2">{new Date(msg.timestamp).toLocaleTimeString()}</span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <div className="mb-2 flex justify-end">
        <button
          type="button"
          onClick={() => void mutate()}
          className="rounded border px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
        >
          Atualizar
        </button>
      </div>
      <form onSubmit={sendMessage} className="flex gap-2">
        <input
          className="border px-2 py-1 rounded flex-1"
          placeholder="Digite sua mensagem..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button type="submit" className="bg-blue-600 text-white px-4 py-1 rounded">Enviar</button>
      </form>
    </div>
  );
}
