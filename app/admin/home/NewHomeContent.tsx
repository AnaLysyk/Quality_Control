"use client";

import { motion } from "framer-motion";
import { FiMic, FiSend } from "react-icons/fi";
import { useState, useMemo } from "react";

function resolveGreeting() {
  const hour = Number(
    new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      hour12: false,
      timeZone: "America/Sao_Paulo",
    }).format(new Date())
  );
  if (hour >= 5 && hour < 12) return "Bom dia";
  if (hour >= 12 && hour < 18) return "Boa tarde";
  return "Boa noite";
}

export default function NewHomeContent() {
  const greeting = useMemo(() => resolveGreeting(), []);
  const [msg, setMsg] = useState("");

  const suggestions = [
    "Buscar pendências",
    "Ver empresas",
    "Analisar fluxo",
  ];

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!msg.trim()) return;
    /* TODO: integrar com assistente */
    console.log("send", msg);
    setMsg("");
  }

  return (
    <div className="relative flex flex-col h-full min-h-[650px] w-full pb-24 px-4 lg:px-12">
      {/* ORB */}
      <div className="absolute right-8 top-6 z-10 select-none pointer-events-none">
        <motion.div
          className="w-[260px] h-[260px] bg-gradient-to-br from-[#0B1020] to-[#000815] rounded-full relative overflow-hidden"
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, ease: "linear", duration: 60 }}
        >
          <motion.div
            className="absolute inset-0 m-auto w-[240px] h-[240px] rounded-full border border-red-600/30"
            animate={{ scale: [1, 1.12, 1] }}
            transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
          />
          <div className="absolute inset-0 flex items-center justify-center text-white text-4xl font-mono">
            ^_-
          </div>
        </motion.div>
      </div>

      {/* Conversation area */}
      <div className="flex-1 flex flex-col items-center justify-center text-center gap-6">
        <h1 className="text-3xl sm:text-4xl font-extrabold">
          {greeting}, <span className="text-red-500">Ana</span>.
        </h1>
        <p className="max-w-xl text-sm text-slate-400">
          Eu sou o Brain. Posso buscar dados, gerar relatórios ou responder dúvidas.
          Como posso ajudar?
        </p>
        {/* suggestion chips */}
        <div className="flex flex-wrap justify-center gap-2 max-w-xl">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => setMsg(s)}
              className="px-4 py-1 rounded-full bg-[#ffffff0d] hover:bg-[#ffffff14] text-xs text-slate-300 border border-white/10 backdrop-blur-sm"
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Chat bar fixed bottom */}
      <form
        onSubmit={handleSubmit}
        className="fixed bottom-8 left-0 right-0 mx-auto w-full max-w-5xl flex items-center gap-4 bg-[#0f172a]/70 border border-white/5 backdrop-blur-sm rounded-full px-6 py-4"
      >
        <input
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          placeholder="Pergunte algo ao Brain…"
          className="flex-1 bg-transparent outline-none text-sm sm:text-base placeholder:text-slate-500"
        />
        <button
          type="button"
          className="p-2 text-slate-400 hover:text-white"
          title="Gravar áudio (em breve)"
        >
          <FiMic className="w-5 h-5" />
        </button>
        <button
          type="submit"
          className="flex items-center gap-1 rounded-full bg-red-600 hover:bg-red-500 transition-colors px-4 py-2 text-sm font-semibold text-white"
        >
          Enviar <FiSend className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
