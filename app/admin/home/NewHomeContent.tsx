"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { FiMic, FiMessageCircle, FiSend } from "react-icons/fi";
import { useAuthUser } from "@/hooks/useAuthUser";

type BrainSuggestion = {
  label: string;
  prompt: string;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal?: boolean;
      [index: number]: { transcript: string };
    };
  };
};

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
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
      { label: "Solicitações", prompt: "Abra e priorize as solicitações que precisam da minha atenção" },
      { label: "Agenda", prompt: "Mostre minha agenda e compromissos relevantes" },
      { label: "Logs", prompt: "Verifique logs e eventos críticos das últimas 24 horas" },
      { label: "Permissões", prompt: "Analise usuários, perfis e permissões disponíveis" },
      { label: "Empresas", prompt: "Mostre empresas com atividade ou risco recente" },
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
    { label: "Continuar", prompt: "Me ajude a continuar meu trabalho" },
    { label: "Runs", prompt: "Mostre meus runs recentes" },
    { label: "Bugs", prompt: "Resuma bugs e riscos atuais" },
  ];
}

function resolveSpeechRecognition() {
  if (typeof window === "undefined") return null;
  const speechWindow = window as Window & {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

function useTypewriter(text: string, speed = 42) {
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

function BrainOrb({ listening }: { listening: boolean }) {
  return (
    <motion.div
      className="relative h-[230px] w-[230px] sm:h-[260px] sm:w-[260px]"
      initial={{ opacity: 0, y: 10, scale: 0.96 }}
      animate={{ opacity: 1, y: [0, -7, 0], scale: listening ? [1, 1.025, 1] : [1, 1.01, 1] }}
      transition={{ opacity: { duration: 0.45 }, y: { repeat: Infinity, duration: 4.6, ease: "easeInOut" }, scale: { repeat: Infinity, duration: 3.8, ease: "easeInOut" } }}
      aria-label="Brain visual"
    >
      <div className="absolute inset-[18px] rounded-full bg-[radial-gradient(circle_at_65%_20%,rgba(255,255,255,0.62),rgba(255,255,255,0.13)_14%,rgba(16,24,41,0.97)_42%,rgba(2,6,16,1)_74%)] shadow-[inset_-22px_-24px_36px_rgba(0,0,0,0.62),inset_18px_12px_28px_rgba(148,163,184,0.22),-18px_18px_30px_rgba(239,68,68,0.20),0_0_45px_rgba(15,23,42,0.9)]" />

      <motion.span
        className="absolute inset-[8px] rounded-full border border-transparent bg-[conic-gradient(from_210deg,transparent_0deg,rgba(239,68,68,0.0)_32deg,rgba(239,68,68,0.95)_64deg,rgba(255,255,255,0.28)_108deg,transparent_150deg,transparent_238deg,rgba(239,68,68,0.55)_264deg,transparent_300deg)] opacity-80 blur-[0.2px]"
        style={{ WebkitMask: "radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 1px))", mask: "radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 1px))" }}
        animate={{ opacity: listening ? [0.7, 1, 0.7] : [0.45, 0.75, 0.45], scale: [0.99, 1.02, 0.99] }}
        transition={{ repeat: Infinity, duration: 3.4, ease: "easeInOut" }}
      />

      <div className="absolute inset-0 flex items-center justify-center gap-8 text-white">
        <motion.span
          className="block h-5 w-8 rounded-sm bg-white shadow-[0_0_11px_rgba(255,255,255,0.85)] [clip-path:polygon(0_100%,50%_0,100%_100%,78%_100%,50%_45%,22%_100%)]"
          animate={{ scaleY: [1, 0.18, 1], y: [0, -1, 0] }}
          transition={{ repeat: Infinity, repeatDelay: 4.2, duration: 0.22, ease: "easeInOut" }}
        />
        <motion.span
          className="block h-2.5 w-10 rounded-full bg-white shadow-[0_0_11px_rgba(255,255,255,0.85)]"
          animate={{ opacity: [1, 0.45, 1], scaleX: [1, 0.72, 1] }}
          transition={{ repeat: Infinity, repeatDelay: 3.8, duration: 0.3, ease: "easeInOut" }}
        />
      </div>
    </motion.div>
  );
}

export default function NewHomeContent() {
  const { user } = useAuthUser();
  const [command, setCommand] = useState("");
  const [lastPrompt, setLastPrompt] = useState("");
  const [listening, setListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);

  const firstName = resolveFirstName(user);
  const roleLabel = resolveRoleLabel(user);
  const greeting = useMemo(() => resolveGreeting(), []);
  const suggestions = useMemo(() => buildSuggestions(roleLabel), [roleLabel]);
  const brainText = lastPrompt
    ? `Certo. Vou trabalhar em: ${lastPrompt}. Posso consultar solicitações, agenda, chat, logs, gestão, empresas e permissões conforme o seu perfil permitir.`
    : `${greeting}, ${firstName}. Eu sou o Brain, conectado ao seu perfil de ${roleLabel}. Selecione uma opção, digite uma mensagem ou fale comigo por áudio para começar.`;
  const typedBrainText = useTypewriter(brainText, 44);

  function applyPrompt(prompt: string) {
    setCommand(prompt);
    setLastPrompt(prompt);
  }

  function openAssistant(prompt: string) {
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
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const prompt = command.trim();
    if (!prompt) return;
    setLastPrompt(prompt);
    openAssistant(prompt);
    setCommand("");
  }

  function handleVoiceInput() {
    const SpeechRecognition = resolveSpeechRecognition();
    if (!SpeechRecognition) {
      setSpeechSupported(false);
      setLastPrompt("Seu navegador não liberou reconhecimento de voz agora. Digite a mensagem ou use o chat lateral.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "pt-BR";
    recognition.interimResults = true;
    recognition.continuous = false;
    setListening(true);
    setLastPrompt("Estou ouvindo. Pode falar comigo.");

    recognition.onresult = (event) => {
      let transcript = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        transcript += event.results[index][0].transcript;
      }
      setCommand(transcript.trim());
    };
    recognition.onerror = () => {
      setListening(false);
      setLastPrompt("Não consegui captar o áudio. Tente novamente ou digite sua mensagem.");
    };
    recognition.onend = () => setListening(false);
    recognition.start();
  }

  return (
    <section className="admin-brain-home relative min-h-[calc(100vh-7rem)] w-full overflow-hidden bg-transparent px-4 pb-28 pt-5 sm:px-8 lg:px-10">
      <div className="relative z-10 flex min-h-[500px] flex-col gap-10 lg:grid lg:grid-cols-[330px_minmax(0,1fr)] lg:items-start">
        <aside className="flex justify-center pt-2 lg:justify-start lg:pl-2">
          <BrainOrb listening={listening} />
        </aside>

        <main className="admin-brain-copy mx-auto flex w-full max-w-4xl flex-col items-center justify-start gap-5 pt-12 text-center lg:pt-16 lg:pr-12">
          <h1 className="text-3xl font-black tracking-tight text-white sm:text-5xl">
            {greeting}, <span className="bg-gradient-to-r from-red-400 to-red-600 bg-clip-text text-transparent">{firstName}</span>.
          </h1>

          <p className="min-h-[92px] max-w-3xl text-balance text-sm font-semibold leading-relaxed text-white/90 sm:text-lg">
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
                className="rounded-full border border-white/10 bg-white/[0.035] px-4 py-2 text-xs font-semibold text-slate-300 transition hover:border-red-400/50 hover:bg-red-500/10 hover:text-white"
              >
                {item.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => openAssistant(command || "Quero conversar com o Brain")}
              className="rounded-full border border-blue-400/20 bg-blue-500/10 px-4 py-2 text-xs font-semibold text-blue-100 transition hover:border-blue-300/50 hover:bg-blue-500/20"
            >
              Abrir conversa
            </button>
          </div>

          {!speechSupported ? <p className="text-xs text-amber-200">Reconhecimento de voz indisponível neste navegador.</p> : null}
        </main>
      </div>

      <form
        onSubmit={handleSubmit}
        className="admin-brain-command fixed bottom-4 left-[13.25rem] right-4 z-30 flex items-center gap-3 rounded-full border border-white/10 bg-[#0f172a]/80 px-4 py-3 shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl max-md:left-4 sm:px-6"
      >
        <input
          value={command}
          onChange={(event) => setCommand(event.target.value)}
          placeholder="Pergunte ao Brain ou escolha uma sugestão..."
          className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
        />
        <button
          type="button"
          onClick={handleVoiceInput}
          className={`grid h-10 w-10 place-items-center rounded-full transition ${listening ? "bg-red-500/20 text-red-200" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}
          title="Falar com o Brain"
        >
          <FiMic className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => openAssistant(command || "Quero conversar com o Brain")}
          className="grid h-10 w-10 place-items-center rounded-full text-slate-400 transition hover:bg-white/5 hover:text-white"
          title="Abrir conversa"
        >
          <FiMessageCircle className="h-5 w-5" />
        </button>
        <button type="submit" className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-red-600 px-5 py-2.5 text-sm font-bold text-white shadow-[0_8px_24px_rgba(239,68,68,0.18)] transition hover:scale-[1.02]">
          Enviar
          <FiSend className="h-4 w-4" />
        </button>
      </form>
    </section>
  );
}
