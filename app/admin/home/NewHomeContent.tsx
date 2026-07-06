"use client";

import { motion } from 'framer-motion';
import { FiMic, FiSend } from 'react-icons/fi';
import { useState } from 'react';

export default function NewHomeContent() {
  const [msg, setMsg] = useState("");
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!msg.trim()) return;
    // placeholder: send message handler
    console.log("send", msg);
    setMsg("");
  }

  return (
    <section className="relative mx-auto flex flex-col items-center justify-center gap-12 max-w-screen-xl px-6 py-16">
      {/* Chat bar full width */}
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-4xl flex items-center gap-4 bg-[#0f172a]/60 border border-white/5 backdrop-blur-sm rounded-full px-6 py-4"
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
        <button type="submit" className="flex items-center gap-1 rounded-full bg-red-600 hover:bg-red-500 transition-colors px-4 py-2 text-sm font-semibold text-white">
          Enviar <FiSend className="w-4 h-4" />
        </button>
      </form>

      {/* Sphere on the right side for lg+, center for mobile */}
      <div className="flex w-full max-w-4xl justify-center lg:justify-end">
        <motion.div
          className="w-[240px] h-[240px] bg-gradient-to-br from-[#0B1020] to-[#000815] rounded-full relative overflow-hidden"
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, ease: 'linear', duration: 60 }}
        >
          <motion.div
            className="absolute inset-0 m-auto w-[220px] h-[220px] rounded-full border border-red-600/30"
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
          />
          {/* Minimal face */}
          <div className="absolute inset-0 flex items-center justify-center text-white text-3xl font-mono select-none pointer-events-none">
            ^_-
          </div>
        </motion.div>
      </div>
    </section>
  );
}
