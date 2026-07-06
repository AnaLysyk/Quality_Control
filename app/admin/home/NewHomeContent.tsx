"use client";

import { motion } from 'framer-motion';

export default function NewHomeContent() {
  return (
    <section className="relative flex w-full justify-between gap-10 max-w-[1400px] mx-auto px-8 lg:px-12">
      <motion.div
        className="w-[260px] h-[480px] bg-gradient-to-br from-[#0B1020] to-[#000815] rounded-3xl relative overflow-hidden"
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, ease: 'linear', duration: 60 }}
      >
        <motion.div
          className="absolute inset-0 m-auto w-[220px] h-[220px] rounded-full border border-red-600/40"
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
        />
      </motion.div>
      <div className="flex-1 flex flex-col gap-4">
        <h1 className="text-4xl sm:text-5xl font-extrabold leading-tight">
          Bom dia, <span className="bg-gradient-to-r from-red-500 to-red-400 bg-clip-text text-transparent">Ana</span>.
        </h1>
        <p className="text-sm text-slate-400 max-w-[600px]">
          Esse é o espaço de informação do Brain. Peça atualizações das últimas 24 horas, puxe uma empresa,
          usuário, tela, risco ou qualquer contexto específico.
        </p>
        <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
          {[
            { title: 'Atualizações recentes', msg: 'Analisei as últimas interações...' },
            { title: 'Resumo tratado pelo Brain', msg: '8 ações registradas...' },
            { title: 'Fluxos atualizados', msg: '0 fluxos receberam alterações...' },
            { title: 'Empresas com atividade', msg: '30 empresas disponíveis...' },
            { title: 'Pendências do período', msg: '0 itens pendentes...' },
          ].map(({ title, msg }) => (
            <li key={title} className="bg-[#111827]/70 border border-white/5 rounded-xl p-4 backdrop-blur-sm shadow-[0_0_15px_-4px_rgba(255,255,255,.05)]">
              <span className="text-xs text-rose-400 font-semibold flex items-center gap-1">
                <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" /></svg>
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
