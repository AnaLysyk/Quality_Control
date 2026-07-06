"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { FiMic, FiSend } from "react-icons/fi";

function resolveGreeting() {
  const hour = Number(
    new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      hour12: false,
      timeZone: "America/Sao_Paulo",
    }).format(new Date()),
  );
  if (hour >= 5 && hour < 12) return "Bom dia";
  if (hour >= 12 && hour < 18) return "Boa tarde";
  return "Boa noite";
}

function Typing({ text }: { text: string }) {
  const [shown, setShown] = useState("");
  useEffect(() => {
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setShown(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, 40);
    return () => clearInterval(id);
  }, [text]);
  return <span>{shown}</span>;
}

export default function NewHomeContent() {
  /* chat input */
  const [msg, setMsg] = useState("");
  const greeting = `${resolveGreeting()}, Ana.`;
  const intro = "Eu sou o Brain. Posso buscar dados, gerar relatórios ou responder dúvidas. Como posso ajudar?";
  const suggestions = ["Buscar pendências", "Ver empresas", "Analisar fluxo"];

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!msg.trim()) return;
    // TODO: integrate with Brain API
    console.log("send", msg);
    setMsg("");
  }

  return (
    <>
      {/* Orb */}
      <motion.div
        className="fixed top-24 left-[calc(72px+1.5rem)] z-20"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6 }}
      >
        <motion.div
          className="relative w-[260px] h-[260px] rounded-full bg-gradient-to-br from-[#0B1020] to-[#000815] overflow-hidden shadow-[0_0_40px_-10px_rgba(239,0,1,0.6)]"
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, ease: "linear", duration: 40 }}
        >
          {/* orbit ring */}
          <motion.div
            className="absolute inset-0 m-auto w-full h-full rounded-full border border-red-600/40"
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}
          />
          {/* face */}
          <div className="absolute inset-0 flex items-center justify-center text-white text-4xl font-mono select-none pointer-events-none">
            ^_-
          </div>
        </motion.div>
      </motion.div>

      {/* Center content */}
      <div className="flex flex-col items-center justify-center text-center pt-32 space-y-6 select-none">
        <h1 className="text-4xl sm:text-5xl font-extrabold">
          <Typing text={greeting} />
        </h1>
        <p className="text-sm text-slate-400 w-full max-w-xl">
          <Typing text={intro} />
        </p>
        {/* suggestion chips */}
        <div className="flex gap-3 flex-wrap justify-center">
          {suggestions.map((s) => (
            <button
              key={s}
              className="rounded-full bg-white/5 hover:bg-white/10 text-xs px-4 py-1 border border-white/10 backdrop-blur-sm transition-colors"
              onClick={() => setMsg(s)}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Chat bar */}
      <form
        onSubmit={handleSubmit}
        className="fixed inset-x-0 bottom-8 mx-auto w-[min(90vw,1440px)] flex items-center gap-4 bg-[#0f172a]/60 border border-white/5 backdrop-blur-sm rounded-full px-6 py-4"
        style={{ left: "50%", transform: "translateX(-50%)" }}
      >
        <input
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          placeholder="Pergunte algo ao Brain…"
          className="flex-1 bg-transparent outline-none text-sm sm:text-base placeholder:text-slate-500"
        />
        <button type="button" className="p-2" title="Gravar áudio (em breve)">
          <FiMic className="w-5 h-5 text-slate-400" />
        </button>
        <button
          type="submit"
          className="flex items-center gap-1 rounded-full bg-red-600 hover:bg-red-500 transition-colors px-4 py-2 text-sm font-semibold text-white"
        >
          Enviar <FiSend className="w-4 h-4" />
        </button>
      </form>
    </>
  );
}
