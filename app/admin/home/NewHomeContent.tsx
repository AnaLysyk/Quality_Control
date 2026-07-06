"use client";

import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { FiClock, FiMessageCircle, FiMic, FiPlus, FiSend, FiVolume2, FiVolumeX } from "react-icons/fi";
import { useAuthUser } from "@/hooks/useAuthUser";
import { useNavigationItems } from "@/hooks/navigation/useNavigationItems";
import { buildBrainHomeActions, type BrainHomeAction } from "./brainHomeActions";

type BrainSuggestion = { label: string; prompt: string; description: string };
type BrainMessage = { id: string; role: "assistant" | "user"; text: string };
type BrainSession = { id: string; title: string; createdAt: string; updatedAt: string; messages: BrainMessage[] };
type SpeechRecognitionEventLike = { resultIndex: number; results: { length: number; [index: number]: { isFinal?: boolean; [index: number]: { transcript: string } } } };
type SpeechRecognitionLike = { lang: string; interimResults: boolean; continuous: boolean; start: () => void; stop: () => void; abort: () => void; onresult: ((event: SpeechRecognitionEventLike) => void) | null; onend: (() => void) | null; onerror: (() => void) | null };

const STORAGE_KEY = "admin-home-brain-conversations";
const DAILY_KEY = "admin-home-brain-current-day";
function todayBR() { return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date()); }
function resolveGreeting() { const hour = Number(new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", hour12: false, timeZone: "America/Sao_Paulo" }).format(new Date())); if (hour >= 5 && hour < 12) return "Bom dia"; if (hour >= 12 && hour < 18) return "Boa tarde"; return "Boa noite"; }
function normalizeText(value: string) { return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
function resolveFirstName(user: unknown) { const record = (user ?? {}) as Record<string, unknown>; const candidate = (typeof record.name === "string" && record.name) || (typeof record.fullName === "string" && record.fullName) || (typeof record.displayName === "string" && record.displayName) || "Ana"; return candidate.trim().split(" ")[0] || "Ana"; }
function resolveRoleLabel(user: unknown) { const record = (user ?? {}) as Record<string, unknown>; const role = normalizeText(String(record.permissionRole ?? record.role ?? record.companyRole ?? "usuario")); if (role.includes("leader") || role.includes("lider")) return "Líder TC"; if (role.includes("support") || role.includes("suporte") || role.includes("technical")) return "Suporte Técnico"; if (role.includes("empresa") || role.includes("company")) return "Empresa"; if (role.includes("testing") || role.includes("qa")) return "QA"; return "Usuário"; }
function buildSuggestions(roleLabel: string): BrainSuggestion[] { if (roleLabel === "Líder TC" || roleLabel === "Suporte Técnico") return [{ label: "Solicitações", prompt: "Abra e priorize as solicitações que precisam da minha atenção", description: "aprovar, rejeitar ou pedir ajuste" }, { label: "Agenda", prompt: "Mostre minha agenda e compromissos relevantes", description: "horários e próximos eventos" }, { label: "Logs", prompt: "Verifique logs e eventos críticos das últimas 24 horas", description: "risco técnico" }, { label: "Permissões", prompt: "Analise usuários, perfis e permissões disponíveis", description: "acessos do perfil" }, { label: "Empresas", prompt: "Mostre empresas com atividade ou risco recente", description: "empresa e contexto" }, { label: "Chamados", prompt: "Liste chamados que precisam de resposta", description: "triagem e acompanhamento" }]; if (roleLabel === "Empresa") return [{ label: "Projeto", prompt: "Resuma a saúde do meu projeto", description: "qualidade e riscos" }, { label: "Pendências", prompt: "Liste minhas pendências abertas", description: "itens aguardando ação" }, { label: "Entregas", prompt: "Mostre próximas entregas e riscos", description: "agenda e previsão" }]; return [{ label: "Continuar", prompt: "Me ajude a continuar meu trabalho", description: "retomar contexto" }, { label: "Runs", prompt: "Mostre meus runs recentes", description: "execuções" }, { label: "Bugs", prompt: "Resuma bugs e riscos atuais", description: "prioridade" }]; }
function resolveSpeechRecognition() { if (typeof window === "undefined") return null; const speechWindow = window as Window & { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike }; return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null; }
function resolveVoice(voices: SpeechSynthesisVoice[], selectedName: string) { return voices.find((voice) => voice.name === selectedName) ?? voices.find((voice) => voice.lang === "pt-BR" && /female|maria|luciana|francisca|google/i.test(voice.name)) ?? voices.find((voice) => voice.lang === "pt-BR") ?? voices.find((voice) => voice.lang.startsWith("pt")) ?? null; }
function useTypewriter(text: string, speed = 44) { const [typedText, setTypedText] = useState(""); useEffect(() => { setTypedText(""); let index = 0; const timer = window.setInterval(() => { index += 1; setTypedText(text.slice(0, index)); if (index >= text.length) window.clearInterval(timer); }, speed); return () => window.clearInterval(timer); }, [speed, text]); return typedText; }
function BrainOrb({ listening, speaking }: { listening: boolean; speaking: boolean }) { return <motion.div className="relative h-[230px] w-[230px] sm:h-[260px] sm:w-[260px]" initial={{ opacity: 0, y: 10, scale: 0.96 }} animate={{ opacity: 1, y: [0, -7, 0], scale: listening || speaking ? [1, 1.035, 1] : [1, 1.01, 1] }} transition={{ opacity: { duration: 0.45 }, y: { repeat: Infinity, duration: speaking ? 2.6 : 4.6, ease: "easeInOut" }, scale: { repeat: Infinity, duration: speaking ? 1.8 : 3.8, ease: "easeInOut" } }} aria-label="Brain visual"><div className="absolute inset-[18px] rounded-full" /></motion.div>; }
function buildAssistantReply(prompt: string, roleLabel: string) { return `Entendi. Vou seguir pelo contexto: ${prompt}. Para ${roleLabel}, eu posso abrir a área certa, consultar dados disponíveis, filtrar pelo seu perfil e manter o histórico desta conversa para continuar daqui.`; }
function buildInitialMessage(greeting: string, firstName: string, roleLabel: string) { return `${greeting}, ${firstName}. Vamos iniciar por onde hoje? Eu posso trabalhar com o que está disponível para seu perfil de ${roleLabel}. Escolha uma opção, digite uma mensagem ou fale comigo por áudio.`; }
function createSession(initialText: string): BrainSession { const now = new Date().toISOString(); return { id: `brain-session-${Date.now()}`, title: "Nova conversa", createdAt: now, updatedAt: now, messages: [{ id: `assistant-${Date.now()}`, role: "assistant", text: initialText }] }; }
function titleFromMessages(messages: BrainMessage[]) { const firstUserMessage = messages.find((message) => message.role === "user")?.text; return firstUserMessage ? firstUserMessage.slice(0, 48) : "Conversa do Brain"; }

export default function NewHomeContent() {
  const { user } = useAuthUser();
  const { modules, effectiveRole } = useNavigationItems();
  const [command, setCommand] = useState("");
  const [listening, setListening] = useState(false);
  const [directVoiceMode, setDirectVoiceMode] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [volume, setVolume] = useState(0.85);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [sessions, setSessions] = useState<BrainSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const firstName = resolveFirstName(user);
  const roleLabel = effectiveRole ? resolveRoleLabel({ role: effectiveRole }) : resolveRoleLabel(user);
  const greeting = useMemo(() => resolveGreeting(), []);
  const navActions = useMemo(() => buildBrainHomeActions(modules).slice(0, 8), [modules]);
  const suggestions = useMemo<(BrainSuggestion | BrainHomeAction)[]>(() => navActions.length ? navActions : buildSuggestions(roleLabel), [navActions, roleLabel]);
  const initialAssistantText = useMemo(() => buildInitialMessage(greeting, firstName, roleLabel), [firstName, greeting, roleLabel]);
  const currentSession = sessions.find((session) => session.id === currentSessionId);
  const messages = currentSession?.messages ?? [];
  const latestAssistantIndex = messages.findLastIndex((message) => message.role === "assistant");
  const latestAssistantMessage = latestAssistantIndex >= 0 ? messages[latestAssistantIndex].text : "";
  const typedAssistantText = useTypewriter(latestAssistantMessage, 46);
  const isTyping = typedAssistantText.length < latestAssistantMessage.length;

  useEffect(() => { const today = todayBR(); const storedDay = window.localStorage.getItem(DAILY_KEY); const stored = window.localStorage.getItem(STORAGE_KEY); const parsed = stored ? (JSON.parse(stored) as BrainSession[]) : []; const shouldStartFresh = storedDay !== today || parsed.length === 0; const nextSessions = shouldStartFresh ? [createSession(initialAssistantText), ...parsed] : parsed; window.localStorage.setItem(DAILY_KEY, today); setSessions(nextSessions); setCurrentSessionId(nextSessions[0]?.id ?? ""); }, [initialAssistantText]);
  useEffect(() => { if (sessions.length) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions.slice(0, 30))); }, [sessions]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages, typedAssistantText]);
  useEffect(() => { if (typeof window === "undefined" || !window.speechSynthesis) return; const loadVoices = () => setAvailableVoices(window.speechSynthesis.getVoices().filter((voice) => voice.lang.startsWith("pt"))); loadVoices(); window.speechSynthesis.onvoiceschanged = loadVoices; return () => { window.speechSynthesis.onvoiceschanged = null; window.speechSynthesis.cancel(); }; }, []);
  useEffect(() => { if (voiceEnabled) speakBrain(latestAssistantMessage); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [latestAssistantMessage, voiceEnabled, selectedVoice, volume]);

  function updateCurrentSession(updater: (session: BrainSession) => BrainSession) { setSessions((current) => current.map((session) => (session.id === currentSessionId ? updater(session) : session))); }
  function speakBrain(text: string) { if (typeof window === "undefined" || !window.speechSynthesis || !text.trim()) return; window.speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(text); utterance.lang = "pt-BR"; utterance.rate = 0.92; utterance.pitch = 1.02; utterance.volume = volume; const voice = resolveVoice(window.speechSynthesis.getVoices(), selectedVoice); if (voice) utterance.voice = voice; utterance.onstart = () => setSpeaking(true); utterance.onend = () => setSpeaking(false); utterance.onerror = () => setSpeaking(false); window.speechSynthesis.speak(utterance); }
  function openAssistant(prompt: string, action?: BrainHomeAction | null) { window.dispatchEvent(new CustomEvent("assistant:open", { detail: { source: "admin-home", route: "/admin/home", panelMode: "side", agentMode: "qa", focusInput: true, initialMessage: prompt, context: { module: "home", screenLabel: "Brain Home", metadata: { roleLabel, action, availableActions: suggestions.map((item) => item.label) } } } })); }
  function sendPrompt(prompt: string, action?: BrainHomeAction | null) { const cleanPrompt = prompt.trim(); if (!cleanPrompt || !currentSessionId) return; const now = Date.now(); const assistantText = buildAssistantReply(cleanPrompt, roleLabel); updateCurrentSession((session) => ({ ...session, title: titleFromMessages([...session.messages, { id: `user-${now}`, role: "user", text: cleanPrompt }]), updatedAt: new Date().toISOString(), messages: [...session.messages, { id: `user-${now}`, role: "user", text: cleanPrompt }, { id: `assistant-${now}`, role: "assistant", text: assistantText }] })); openAssistant(cleanPrompt, action); setCommand(""); }
  function handleSubmit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); sendPrompt(command); }
  function handleSuggestion(item: BrainSuggestion | BrainHomeAction) { setVoiceEnabled(true); sendPrompt(item.prompt, "id" in item ? item as BrainHomeAction : null); }
  function startNewConversation() { const next = createSession(initialAssistantText); setSessions((current) => [next, ...current]); setCurrentSessionId(next.id); setHistoryOpen(false); setCommand(""); }
  function openSession(sessionId: string) { setCurrentSessionId(sessionId); setHistoryOpen(false); setCommand(""); }
  function handleVoiceInput(sendDirectly: boolean) { const SpeechRecognition = resolveSpeechRecognition(); if (!SpeechRecognition) { setSpeechSupported(false); updateCurrentSession((session) => ({ ...session, messages: [...session.messages, { id: `assistant-speech-${Date.now()}`, role: "assistant", text: "Seu navegador não liberou reconhecimento de voz agora. Digite a mensagem ou use o chat lateral." }] })); return; } const recognition = new SpeechRecognition(); let finalTranscript = ""; recognition.lang = "pt-BR"; recognition.interimResults = true; recognition.continuous = false; setListening(true); setDirectVoiceMode(sendDirectly); if (sendDirectly) setVoiceEnabled(true); recognition.onresult = (event) => { let transcript = ""; for (let index = event.resultIndex; index < event.results.length; index += 1) { transcript += event.results[index][0].transcript; if (event.results[index].isFinal) finalTranscript = transcript.trim(); } setCommand(transcript.trim()); }; recognition.onerror = () => { setListening(false); setDirectVoiceMode(false); updateCurrentSession((session) => ({ ...session, messages: [...session.messages, { id: `assistant-error-${Date.now()}`, role: "assistant", text: "Não consegui captar o áudio. Tente novamente ou digite sua mensagem." }] })); }; recognition.onend = () => { setListening(false); setDirectVoiceMode(false); if (sendDirectly && finalTranscript) sendPrompt(finalTranscript); }; recognition.start(); }

  return (
    <section className="admin-brain-home relative min-h-[calc(100vh-7rem)] w-full overflow-hidden bg-transparent px-4 pb-28 pt-5 sm:px-8 lg:px-10">
      <div className="admin-brain-session-controls fixed right-8 top-24 z-30 flex items-center gap-2 max-md:right-4 max-md:top-20">
        <button type="button" onClick={() => setHistoryOpen((current) => !current)} className="admin-brain-icon-action" title="Histórico de conversas" aria-label="Histórico de conversas"><FiClock className="h-4 w-4" /></button>
        <button type="button" onClick={startNewConversation} className="admin-brain-icon-action" title="Nova conversa" aria-label="Nova conversa"><FiPlus className="h-4 w-4" /></button>
      </div>
      <div className="relative z-10 grid min-h-[500px] grid-cols-1 gap-6 lg:grid-cols-[330px_minmax(0,1fr)] lg:items-start">
        <aside className="flex justify-center pt-2 lg:justify-start lg:pl-2"><BrainOrb listening={listening} speaking={speaking || isTyping} /></aside>
        <main className="admin-brain-copy mx-auto flex h-[calc(100vh-15rem)] w-full max-w-6xl flex-col justify-start gap-4 overflow-hidden pt-8 text-left lg:pt-12 lg:pr-12">
          <div className="admin-brain-chat-list space-y-3 overflow-y-auto pr-2">
            {messages.map((message, index) => { const isLatestAssistant = message.role === "assistant" && index === latestAssistantIndex; const displayText = isLatestAssistant ? typedAssistantText : message.text; return <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}><div className={`admin-brain-message max-w-[82%] rounded-3xl px-5 py-4 ${message.role === "user" ? "admin-brain-message-user text-right" : "admin-brain-message-assistant"}`}><p className="whitespace-pre-wrap text-base font-semibold leading-relaxed sm:text-xl">{displayText}{isLatestAssistant ? <motion.span className="ml-1 inline-block h-5 w-[2px] translate-y-1 bg-red-500" animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 0.9 }} /> : null}</p></div></div>; })}
            <div ref={messagesEndRef} />
          </div>
        </main>
      </div>
      <div className="admin-brain-actions fixed bottom-[5.6rem] left-[13.25rem] right-[6.25rem] z-30 flex flex-wrap items-stretch gap-2 max-md:left-4 max-md:right-[5.75rem]">
        {suggestions.map((item) => <button key={item.label} type="button" onClick={() => handleSuggestion(item)} className="admin-brain-action rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-2 text-left transition hover:border-red-400/50 hover:bg-red-500/10"><span className="block text-xs font-bold text-white">{item.label}</span><span className="mt-0.5 block truncate text-[10px] text-slate-400">{item.description}</span></button>)}
      </div>
      {historyOpen ? <div className="admin-brain-history fixed right-8 top-36 z-40 w-[min(360px,calc(100vw-2rem))] rounded-3xl border border-white/10 bg-slate-950/90 p-3 shadow-2xl backdrop-blur-xl max-md:right-4 max-md:top-32"><p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Histórico</p><div className="max-h-64 space-y-2 overflow-y-auto pr-1">{sessions.map((session) => <button key={session.id} type="button" onClick={() => openSession(session.id)} className={`w-full rounded-2xl border px-3 py-2 text-left transition ${session.id === currentSessionId ? "border-red-400/40 bg-red-500/10" : "border-white/10 bg-white/[0.035] hover:border-white/25"}`}><span className="block truncate text-xs font-semibold text-white">{session.title}</span><span className="mt-0.5 block text-[10px] text-slate-400">{new Date(session.updatedAt).toLocaleString("pt-BR")}</span></button>)}</div></div> : null}
      <form onSubmit={handleSubmit} className="admin-brain-command fixed bottom-4 left-[13.25rem] right-4 z-30 flex items-center gap-3 rounded-full border border-white/10 bg-[#0f172a]/80 px-4 py-3 shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl max-md:left-4 sm:px-6">
        <input value={command} onChange={(event) => setCommand(event.target.value)} placeholder={listening ? "Estou transcrevendo sua voz..." : "Digite, fale para preencher, ou use o modo conversa por áudio..."} className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-500" />
        <button type="button" onClick={() => handleVoiceInput(false)} className={`grid h-10 w-10 place-items-center rounded-full transition ${listening && !directVoiceMode ? "bg-red-500/20 text-red-200" : "text-slate-400 hover:bg-white/5 hover:text-white"}`} title="Transcrever áudio na barra"><FiMic className="h-5 w-5" /></button>
        <button type="button" onClick={() => handleVoiceInput(true)} className={`grid h-10 w-10 place-items-center rounded-full transition ${listening && directVoiceMode ? "bg-red-500/20 text-red-200" : "text-slate-400 hover:bg-white/5 hover:text-white"}`} title="Conversar por áudio direto"><FiMessageCircle className="h-5 w-5" /></button>
        <button type="button" onClick={() => setVoiceEnabled((current) => !current)} className={`grid h-10 w-10 place-items-center rounded-full transition ${voiceEnabled ? "bg-blue-500/20 text-blue-100" : "text-slate-400 hover:bg-white/5 hover:text-white"}`} title="Ativar ou pausar voz do Brain">{voiceEnabled ? <FiVolume2 className="h-5 w-5" /> : <FiVolumeX className="h-5 w-5" />}</button>
        <input aria-label="Volume do Brain" title="Volume do Brain" type="range" min="0" max="1" step="0.05" value={volume} onChange={(event) => setVolume(Number(event.target.value))} className="hidden w-20 accent-red-500 lg:block" />
        {availableVoices.length ? <select aria-label="Voz do Brain" value={selectedVoice} onChange={(event) => setSelectedVoice(event.target.value)} className="hidden max-w-36 rounded-full border border-white/10 bg-transparent px-2 py-2 text-xs text-slate-300 outline-none xl:block"><option value="">Voz padrão</option>{availableVoices.map((voice) => <option key={voice.name} value={voice.name}>{voice.name}</option>)}</select> : null}
        <button type="submit" className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-red-600 px-5 py-2.5 text-sm font-bold text-white shadow-[0_8px_24px_rgba(239,68,68,0.18)] transition hover:scale-[1.02]">Enviar<FiSend className="h-4 w-4" /></button>
      </form>
      {!speechSupported ? <p className="fixed bottom-[9.5rem] left-[13.25rem] z-30 text-xs text-amber-200 max-md:left-4">Reconhecimento de voz indisponível neste navegador.</p> : null}
    </section>
  );
}
