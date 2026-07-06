"use client";

import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { FiMic, FiMessageCircle, FiSend, FiVolume2, FiVolumeX } from "react-icons/fi";
import { useAuthUser } from "@/hooks/useAuthUser";

type BrainSuggestion = {
  label: string;
  prompt: string;
  description: string;
};

type BrainMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
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
      { label: "Solicitações", prompt: "Abra e priorize as solicitações que precisam da minha atenção", description: "aprovar, rejeitar ou pedir ajuste" },
      { label: "Agenda", prompt: "Mostre minha agenda e compromissos relevantes", description: "horários e próximos eventos" },
      { label: "Logs", prompt: "Verifique logs e eventos críticos das últimas 24 horas", description: "risco técnico" },
      { label: "Permissões", prompt: "Analise usuários, perfis e permissões disponíveis", description: "acessos do perfil" },
      { label: "Empresas", prompt: "Mostre empresas com atividade ou risco recente", description: "empresa e contexto" },
      { label: "Chamados", prompt: "Liste chamados que precisam de resposta", description: "triagem e acompanhamento" },
    ];
  }

  if (roleLabel === "Empresa") {
    return [
      { label: "Projeto", prompt: "Resuma a saúde do meu projeto", description: "qualidade e riscos" },
      { label: "Pendências", prompt: "Liste minhas pendências abertas", description: "itens aguardando ação" },
      { label: "Entregas", prompt: "Mostre próximas entregas e riscos", description: "agenda e previsão" },
    ];
  }

  return [
    { label: "Continuar", prompt: "Me ajude a continuar meu trabalho", description: "retomar contexto" },
    { label: "Runs", prompt: "Mostre meus runs recentes", description: "execuções" },
    { label: "Bugs", prompt: "Resuma bugs e riscos atuais", description: "prioridade" },
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

function resolveVoice(voices: SpeechSynthesisVoice[], selectedName: string) {
  return (
    voices.find((voice) => voice.name === selectedName) ??
    voices.find((voice) => voice.lang === "pt-BR" && /female|maria|luciana|francisca|google/i.test(voice.name)) ??
    voices.find((voice) => voice.lang === "pt-BR") ??
    voices.find((voice) => voice.lang.startsWith("pt")) ??
    null
  );
}

function useTypewriter(text: string, speed = 44) {
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

function BrainOrb({ listening, speaking }: { listening: boolean; speaking: boolean }) {
  return (
    <motion.div
      className="relative h-[230px] w-[230px] sm:h-[260px] sm:w-[260px]"
      initial={{ opacity: 0, y: 10, scale: 0.96 }}
      animate={{ opacity: 1, y: [0, -7, 0], scale: listening || speaking ? [1, 1.035, 1] : [1, 1.01, 1] }}
      transition={{ opacity: { duration: 0.45 }, y: { repeat: Infinity, duration: speaking ? 2.6 : 4.6, ease: "easeInOut" }, scale: { repeat: Infinity, duration: speaking ? 1.8 : 3.8, ease: "easeInOut" } }}
      aria-label="Brain visual"
    >
      <div className="absolute inset-[18px] rounded-full" />
    </motion.div>
  );
}

function buildAssistantReply(prompt: string, roleLabel: string) {
  return `Entendi. Vou seguir pelo contexto: ${prompt}. Para ${roleLabel}, eu posso abrir a área certa, consultar dados disponíveis, filtrar pelo seu perfil e manter o histórico desta conversa aqui enquanto você continua comigo.`;
}

export default function NewHomeContent() {
  const { user } = useAuthUser();
  const [command, setCommand] = useState("");
  const [listening, setListening] = useState(false);
  const [directVoiceMode, setDirectVoiceMode] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [volume, setVolume] = useState(0.85);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const firstName = resolveFirstName(user);
  const roleLabel = resolveRoleLabel(user);
  const greeting = useMemo(() => resolveGreeting(), []);
  const suggestions = useMemo(() => buildSuggestions(roleLabel), [roleLabel]);
  const initialAssistantText = `${greeting}, ${firstName}. Eu sou o Brain. Posso trabalhar com o que está disponível para seu perfil de ${roleLabel}. Escolha uma opção abaixo, digite uma mensagem ou fale comigo por áudio.`;
  const [messages, setMessages] = useState<BrainMessage[]>(() => [
    { id: "assistant-initial", role: "assistant", text: initialAssistantText },
  ]);
  const latestAssistantMessage = [...messages].reverse().find((message) => message.role === "assistant")?.text ?? "";
  const typedAssistantText = useTypewriter(latestAssistantMessage, 46);
  const isTyping = typedAssistantText.length < latestAssistantMessage.length;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, typedAssistantText]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const loadVoices = () => setAvailableVoices(window.speechSynthesis.getVoices().filter((voice) => voice.lang.startsWith("pt")));
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
      window.speechSynthesis.cancel();
    };
  }, []);

  useEffect(() => {
    if (!voiceEnabled) return;
    speakBrain(latestAssistantMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestAssistantMessage, voiceEnabled, selectedVoice, volume]);

  function speakBrain(text: string) {
    if (typeof window === "undefined" || !window.speechSynthesis || !text.trim()) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "pt-BR";
    utterance.rate = 0.92;
    utterance.pitch = 1.02;
    utterance.volume = volume;
    const voice = resolveVoice(window.speechSynthesis.getVoices(), selectedVoice);
    if (voice) utterance.voice = voice;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
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

  function sendPrompt(prompt: string) {
    const cleanPrompt = prompt.trim();
    if (!cleanPrompt) return;
    const userMessage: BrainMessage = { id: `user-${Date.now()}`, role: "user", text: cleanPrompt };
    const assistantMessage: BrainMessage = {
      id: `assistant-${Date.now()}`,
      role: "assistant",
      text: buildAssistantReply(cleanPrompt, roleLabel),
    };
    setMessages((current) => [...current, userMessage, assistantMessage]);
    openAssistant(cleanPrompt);
    setCommand("");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    sendPrompt(command);
  }

  function handleSuggestion(item: BrainSuggestion) {
    setVoiceEnabled(true);
    sendPrompt(item.prompt);
  }

  function handleVoiceInput(sendDirectly: boolean) {
    const SpeechRecognition = resolveSpeechRecognition();
    if (!SpeechRecognition) {
      setSpeechSupported(false);
      setMessages((current) => [
        ...current,
        { id: `assistant-speech-${Date.now()}`, role: "assistant", text: "Seu navegador não liberou reconhecimento de voz agora. Digite a mensagem ou use o chat lateral." },
      ]);
      return;
    }

    const recognition = new SpeechRecognition();
    let finalTranscript = "";
    recognition.lang = "pt-BR";
    recognition.interimResults = true;
    recognition.continuous = false;
    setListening(true);
    setDirectVoiceMode(sendDirectly);
    if (sendDirectly) setVoiceEnabled(true);
    recognition.onresult = (event) => {
      let transcript = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        transcript += event.results[index][0].transcript;
        if (event.results[index].isFinal) finalTranscript = transcript.trim();
      }
      setCommand(transcript.trim());
    };
    recognition.onerror = () => {
      setListening(false);
      setDirectVoiceMode(false);
      setMessages((current) => [
        ...current,
        { id: `assistant-error-${Date.now()}`, role: "assistant", text: "Não consegui captar o áudio. Tente novamente ou digite sua mensagem." },
      ]);
    };
    recognition.onend = () => {
      setListening(false);
      setDirectVoiceMode(false);
      if (sendDirectly && finalTranscript) sendPrompt(finalTranscript);
    };
    recognition.start();
  }

  return (
    <section className="admin-brain-home relative min-h-[calc(100vh-7rem)] w-full overflow-hidden bg-transparent px-4 pb-28 pt-5 sm:px-8 lg:px-10">
      <div className="relative z-10 grid min-h-[500px] grid-cols-1 gap-6 lg:grid-cols-[330px_minmax(0,1fr)] lg:items-start">
        <aside className="flex justify-center pt-2 lg:justify-start lg:pl-2">
          <BrainOrb listening={listening} speaking={speaking || isTyping} />
        </aside>

        <main className="admin-brain-copy mx-auto flex h-[calc(100vh-15rem)] w-full max-w-6xl flex-col justify-start gap-4 overflow-hidden pt-8 text-left lg:pt-12 lg:pr-12">
          <div className="space-y-3 overflow-y-auto pr-2">
            {messages.map((message, index) => {
              const isLatestAssistant = message.role === "assistant" && index === messages.findLastIndex((item) => item.role === "assistant");
              const displayText = isLatestAssistant ? typedAssistantText : message.text;
              return (
                <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[82%] rounded-3xl px-5 py-4 ${message.role === "user" ? "bg-red-500/12 text-right text-white" : "bg-transparent text-white"}`}>
                    <p className="whitespace-pre-wrap text-base font-semibold leading-relaxed sm:text-xl">
                      {displayText}
                      {isLatestAssistant ? <motion.span className="ml-1 inline-block h-5 w-[2px] translate-y-1 bg-red-500" animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 0.9 }} /> : null}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        </main>
      </div>

      <div className="admin-brain-actions fixed bottom-[5.6rem] left-[13.25rem] right-[6.25rem] z-30 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6 max-md:left-4 max-md:right-[5.75rem]">
        {suggestions.map((item) => (
          <button key={item.label} type="button" onClick={() => handleSuggestion(item)} className="rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-2 text-left transition hover:border-red-400/50 hover:bg-red-500/10">
            <span className="block text-xs font-bold text-white">{item.label}</span>
            <span className="mt-0.5 block truncate text-[10px] text-slate-400">{item.description}</span>
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="admin-brain-command fixed bottom-4 left-[13.25rem] right-4 z-30 flex items-center gap-3 rounded-full border border-white/10 bg-[#0f172a]/80 px-4 py-3 shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl max-md:left-4 sm:px-6">
        <input value={command} onChange={(event) => setCommand(event.target.value)} placeholder={listening ? "Estou transcrevendo sua voz..." : "Digite, fale para preencher, ou use o modo conversa por áudio..."} className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-500" />
        <button type="button" onClick={() => handleVoiceInput(false)} className={`grid h-10 w-10 place-items-center rounded-full transition ${listening && !directVoiceMode ? "bg-red-500/20 text-red-200" : "text-slate-400 hover:bg-white/5 hover:text-white"}`} title="Transcrever áudio na barra"><FiMic className="h-5 w-5" /></button>
        <button type="button" onClick={() => handleVoiceInput(true)} className={`grid h-10 w-10 place-items-center rounded-full transition ${listening && directVoiceMode ? "bg-red-500/20 text-red-200" : "text-slate-400 hover:bg-white/5 hover:text-white"}`} title="Conversar por áudio direto"><FiMessageCircle className="h-5 w-5" /></button>
        <button type="button" onClick={() => setVoiceEnabled((current) => !current)} className={`grid h-10 w-10 place-items-center rounded-full transition ${voiceEnabled ? "bg-blue-500/20 text-blue-100" : "text-slate-400 hover:bg-white/5 hover:text-white"}`} title="Ativar ou pausar voz do Brain">{voiceEnabled ? <FiVolume2 className="h-5 w-5" /> : <FiVolumeX className="h-5 w-5" />}</button>
        <input aria-label="Volume do Brain" title="Volume do Brain" type="range" min="0" max="1" step="0.05" value={volume} onChange={(event) => setVolume(Number(event.target.value))} className="hidden w-20 accent-red-500 lg:block" />
        {availableVoices.length ? (
          <select aria-label="Voz do Brain" value={selectedVoice} onChange={(event) => setSelectedVoice(event.target.value)} className="hidden max-w-36 rounded-full border border-white/10 bg-transparent px-2 py-2 text-xs text-slate-300 outline-none xl:block">
            <option value="">Voz padrão</option>
            {availableVoices.map((voice) => <option key={voice.name} value={voice.name}>{voice.name}</option>)}
          </select>
        ) : null}
        <button type="submit" className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-red-600 px-5 py-2.5 text-sm font-bold text-white shadow-[0_8px_24px_rgba(239,68,68,0.18)] transition hover:scale-[1.02]">Enviar<FiSend className="h-4 w-4" /></button>
      </form>
      {!speechSupported ? <p className="fixed bottom-[9.5rem] left-[13.25rem] z-30 text-xs text-amber-200 max-md:left-4">Reconhecimento de voz indisponível neste navegador.</p> : null}
    </section>
  );
}
