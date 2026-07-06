"use client";

import { motion } from 'framer-motion';

export default function NewHomeContent() {
  return (
    <section className="relative max-w-[1400px] mx-auto flex flex-col lg:flex-row items-center justify-center gap-12 px-6 lg:px-12">
      {/* Radar */}
      <motion.div
        className="w-[220px] h-[380px] bg-gradient-to-br from-[#0B1020] to-[#000815] rounded-3xl relative overflow-hidden shrink-0"
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, ease: 'linear', duration: 60 }}
      >
        <motion.div
          className="absolute inset-0 m-auto w-[200px] h-[200px] rounded-full border border-red-600/40"
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
        />
      </motion.div>

      {/* Conteúdo */}
      <div className="flex-1 w-full max-w-[800px] flex flex-col items-center text-center gap-6">
        <h1 className="text-4xl sm:text-5xl font-extrabold leading-tight">
          Bom dia, <span className="bg-gradient-to-r from-red-500 to-red-400 bg-clip-text text-transparent">Ana</span>.
        </h1>
        <p className="text-sm text-slate-400 max-w-[520px]">
          Esse é o espaço de informação do Brain. Peça atualizações das últimas&nbsp;24&nbsp;horas, puxe uma empresa,
          usuário, tela, risco ou qualquer contexto específico.
        </p>

        <ul className="grid sm:grid-cols-2 gap-6 w-full">
          {[
            { title: 'Atualizações recentes', msg: 'Analisei as últimas interações...' },
            { title: 'Resumo tratado pelo Brain', msg: '8 ações registradas...' },
            { title: 'Empresas com atividade', msg: '30 empresas disponíveis...' },
            { title: 'Pendências do período', msg: '0 itens pendentes...' },
            { title: 'Fluxos atualizados', msg: '0 fluxos receberam alterações...' },
          ].map(({ title, msg }) => (
            <li
              key={title}
              className="bg-[#111827]/70 border border-white/5 rounded-xl p-4 backdrop-blur-sm shadow-[0_0_15px_-4px_rgba(255,255,255,.05)]"
            >
              <span className="text-xs text-rose-400 font-semibold flex items-center gap-1">
                <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="12" />
                </svg>
                Últimas 24h
              </span>
              <h2 className="mt-1 font-semibold text-sm">{title}</h2>
              <p className="text-xs text-slate-400 truncate">{msg}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
