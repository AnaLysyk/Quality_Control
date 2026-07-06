"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { FiMic, FiSend } from "react-icons/fi";
import { useAuthUser } from "@/hooks/useAuthUser";

type BrainSuggestion = {
  label: string;
  prompt: string;
};

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

function normalizeText(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function resolveFirstName(user: unknown) {
  const record = (user ?? {}) as Record<string, unknown>;
  const candidate =
    (typeof record.name === "string" && record.name) ||
    (typeof record.fullName === "string" && record.fullName) ||
    (typeof record.displayName === "string" && record.displayName) ||
    "Ana";

  return candidate.trim().split(" ")[0] || "Ana";
}

function resolveRoleLabel(user: unknown) {
  const record = (user ?? {}) as Record<string, unknown>;
  const role = String(record.permissionRole ?? record.role ?? record.companyRole ?? "usuario");
  const normalizedRole = normalizeText(role);

  if (normalizedRole.includes("leader") || normalizedRole.includes("lider")) return "Líder TC";
  if (normalizedRole.includes("support") || normalizedRole.includes("suporte") || normalizedRole.includes("technical")) return "Suporte Técnico";
  if (normalizedRole.includes("empresa") || normalizedRole.includes("company")) return "Empresa";
  if (normalizedRole.includes("testing") || normalizedRole.includes("qa")) return "QA";
  return "Usuário";
}

function buildSuggestions(roleLabel: string): BrainSuggestion[] {
  if (roleLabel === "Líder TC" || roleLabel === "Suporte Técnico") {
    return [
      { label: "Últimas 24h", prompt: "Resuma as atualizações das últimas 24 horas" },
      { label: "Empresas", prompt: "Quais empresas precisam de atenção agora?" },
      { label: "Riscos", prompt: "Liste riscos, pendências e bloqueios atuais" },
      { label: "Permissões", prompt: "Verifique usuários, perfis e permissões relevantes" },
    ];
  }

  if (roleLabel === "Empresa") {
    return [
      { label: "Meu projeto", prompt: "Resuma a saúde do meu projeto" },
      { label: "Pendências", prompt: "Liste minhas pendências abertas" },
      { label: "Entregas", prompt: "Mostre próximas entregas e riscos" },
    ];
  }

  return [
    { label: "Continuar trabalho", prompt: "Me ajude a continuar meu trabalho" },
    { label: "Runs", prompt: "Mostre meus runs recentes" },
    { label: "Bugs", prompt: "Resuma bugs e riscos atuais" },
  ];
}

function useTypewriter(text: string, speed = 22) {
  const [typedText, setTypedText] = useState("");

  useEffect(() => {
    setTypedText("");
    let index = 0;
    const timer = window.setInterval(() => {
      index += 1;
      setTypedText(text.slice(0, index));
      if (index >= text.length) window.clearInterval(timer);
    }, speed);

    return () => window.clearInterval(timer);
  }, [speed, text]);

  return typedText;
}

function BrainOrb() {
  return (
    <motion.div
      className="relative h-[220px] w-[220px] sm:h-[250px] sm:w-[250px]"
      initial={{ opacity: 0, y: 10, scale: 0.96 }}
      animate={{ opacity: 1, y: [0, -8, 0], scale: [1, 1.015, 1] }}
      transition={{ opacity: { duration: 0.45 }, y: { repeat: Infinity, duration: 4.2, ease: "easeInOut" }, scale: { repeat: Infinity, duration: 5, ease: "easeInOut" } }}
      aria-label="Brain visual"
    >
      <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_64%_22%,rgba(255,255,255,0.52),rgba(255,255,255,0.10)_15%,rgba(6,12,27,0.94)_45%,rgba(3,7,18,1)_72%)] shadow-[inset_-22px_-24px_34px_rgba(0,0,0,0.58),inset_18px_12px_28px_rgba(148,163,184,0.22),0_0_42px_rgba(239,68,68,0.22)]" />
      <motion.span
        className="absolute inset-[-10px] rounded-full border border-red-500/35 shadow-[0_0_24px_rgba(239,68,68,0.28)]"
        animate={{ scale: [0.98, 1.03, 0.98], opacity: [0.65, 1, 0.65] }}
        transition={{ repeat: Infinity, duration: 3.8, ease: "easeInOut" }}
      />
      <motion.span
        className="absolute -right-1 bottom-9 h-2 w-8 rounded-full bg-red-500 shadow-[0_0_16px_rgba(239,68,68,0.9)]"
        animate={{ opacity: [0.45, 1, 0.45], x: [0, 4, 0] }}
        transition={{ repeat: Infinity, duration: 2.8, ease: "easeInOut" }}
      />
      <div className="absolute inset-0 flex items-center justify-center gap-8 text-white">
        <motion.span
          className="block h-3 w-8 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.75)] [clip-path:polygon(0_100%,50%_0,100%_100%,78%_100%,50%_42%,22%_100%)]"
          animate={{ y: [0, -2, 0] }}
          transition={{ repeat: Infinity, duration: 2.4, ease: "easeInOut" }}
        />
        <motion.span
          className="block h-2 w-9 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.75)]"
          animate={{ opacity: [1, 0.55, 1], y: [0, 1, 0] }}
          transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
        />
      </div>
    </motion.div>
  );
}

export default function NewHomeContent() {
  const { user } = useAuthUser();
  const [command, setCommand] = useState("");
  const [lastPrompt, setLastPrompt] = useState("");

  const firstName = resolveFirstName(user);
  const roleLabel = resolveRoleLabel(user);
  const greeting = useMemo(() => resolveGreeting(), []);
  const suggestions = useMemo(() => buildSuggestions(roleLabel), [roleLabel]);
  const brainText = lastPrompt
    ? `Estou preparando a análise para: ${lastPrompt}. Vou cruzar dados, histórico e permissões antes de responder.`
    : `${greeting}, ${firstName}. Eu sou o Brain, conectado ao seu contexto de ${roleLabel}. Por onde você quer começar?`;
  const typedBrainText = useTypewriter(brainText);

  function applyPrompt(prompt: string) {
    setCommand(prompt);
    setLastPrompt(prompt);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const prompt = command.trim();
    if (!prompt) return;
    setLastPrompt(prompt);
    window.dispatchEvent(
      new CustomEvent("assistant:open", {
        detail: {
          source: "admin-home",
          route: "/admin/home",
          panelMode: "side",
          agentMode: "qa",
          focusInput: true,
          initialMessage: prompt,
          context: { module: "home", screenLabel: "Brain Home", metadata: { roleLabel } },
        },
      }),
    );
    setCommand("");
  }

  return (
    <section className="relative min-h-[calc(100vh-7rem)] w-full overflow-hidden bg-transparent px-4 pb-28 pt-8 sm:px-8 lg:px-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_78%_20%,rgba(239,68,68,0.08),transparent_28%),radial-gradient(circle_at_26%_30%,rgba(59,130,246,0.07),transparent_30%)]" />

      <div className="relative z-10 flex min-h-[520px] flex-col gap-10 lg:grid lg:grid-cols-[300px_minmax(0,1fr)] lg:items-center">
        <aside className="flex justify-center lg:justify-start lg:self-start lg:pt-10">
          <BrainOrb />
        </aside>

        <main className="mx-auto flex w-full max-w-3xl flex-col items-center justify-center gap-5 text-center lg:pr-12">
          <p className="min-h-[72px] max-w-2xl text-balance text-base font-semibold leading-relaxed text-white sm:text-xl">
            {typedBrainText}
            <motion.span
              className="ml-1 inline-block h-5 w-[2px] translate-y-1 bg-red-500"
              animate={{ opacity: [0, 1, 0] }}
              transition={{ repeat: Infinity, duration: 0.9 }}
            />
          </p>

          <div className="flex flex-wrap justify-center gap-2">
            {suggestions.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => applyPrompt(item.prompt)}
                className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold text-slate-300 transition hover:border-red-400/50 hover:bg-red-500/10 hover:text-white"
              >
                {item.label}
              </button>
            ))}
          </div>
        </main>
      </div>

      <form
        onSubmit={handleSubmit}
        className="fixed bottom-5 left-[max(1rem,calc(72px+1.25rem))] right-5 z-30 flex items-center gap-3 rounded-full border border-white/10 bg-[#0f172a]/80 px-4 py-3 shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:px-6"
      >
        <input
          value={command}
          onChange={(event) => setCommand(event.target.value)}
          placeholder="Pergunte ao Brain ou escolha uma sugestão..."
          className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
        />
        <button type="button" className="grid h-10 w-10 place-items-center rounded-full text-slate-400 transition hover:bg-white/5 hover:text-white" title="Enviar áudio">
          <FiMic className="h-5 w-5" />
        </button>
        <button type="submit" className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-red-600 px-5 py-2.5 text-sm font-bold text-white shadow-[0_8px_24px_rgba(239,68,68,0.18)] transition hover:scale-[1.02]">
          Enviar
          <FiSend className="h-4 w-4" />
        </button>
      </form>
    </section>
  );
}
