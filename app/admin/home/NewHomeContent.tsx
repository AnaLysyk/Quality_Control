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
type BrainWeatherContext = { place?: string; temperature?: number | null; apparentTemperature?: number | null; humidity?: number | null; precipitation?: number | null; windSpeed?: number | null; label?: string; comment?: string; source?: string };
type BrainAskPayload = { reply?: string; webSearch?: { enabled?: boolean; provider?: string; results?: Array<{ title?: string; url?: string; content?: string }> } | null };
type SpeechRecognitionEventLike = { resultIndex: number; results: { length: number; [index: number]: { isFinal?: boolean; [index: number]: { transcript: string } } } };
type SpeechRecognitionLike = { lang: string; interimResults: boolean; continuous: boolean; maxAlternatives?: number; start: () => void; stop: () => void; abort: () => void; onstart: (() => void) | null; onresult: ((event: SpeechRecognitionEventLike) => void) | null; onend: (() => void) | null; onerror: ((event?: unknown) => void) | null };
type VoiceToast = { id: number; text: string; actionLabel?: string; actionMode?: boolean; duration?: number };

const STORAGE_KEY = "admin-home-brain-conversations";
const DAILY_KEY = "admin-home-brain-current-day";
const WEATHER_DAILY_KEY = "admin-home-brain-weather-comment-day";
const LOADING_TEXT = "Consultando o Brain...";
const VOICE_UNSUPPORTED_TEXT = "Reconhecimento de voz indisponível neste navegador. Use Chrome/Edge e permita o microfone.";

function todayBR() { return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date()); }
export function resolveGreeting() { const hour = Number(new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", hour12: false, timeZone: "America/Sao_Paulo" }).format(new Date())); if (hour >= 5 && hour < 12) return "Bom dia"; if (hour >= 12 && hour < 18) return "Boa tarde"; return "Boa noite"; }
function normalizeText(value: string) { return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
export function resolveFirstName(user: unknown) { const record = (user ?? {}) as Record<string, unknown>; const candidate = (typeof record.name === "string" && record.name) || (typeof record.fullName === "string" && record.fullName) || (typeof record.displayName === "string" && record.displayName) || "Ana"; return candidate.trim().split(" ")[0] || "Ana"; }
function resolveRoleLabel(user: unknown) { const record = (user ?? {}) as Record<string, unknown>; const role = normalizeText(String(record.permissionRole ?? record.role ?? record.companyRole ?? "usuario")); if (role.includes("leader") || role.includes("lider")) return "Líder TC"; if (role.includes("support") || role.includes("suporte") || role.includes("technical")) return "Administrador"; if (role.includes("empresa") || role.includes("company")) return "Empresa"; if (role.includes("testing") || role.includes("qa")) return "QA"; return "Usuário"; }
function buildSuggestions(roleLabel: string): BrainSuggestion[] { if (roleLabel === "Líder TC" || roleLabel === "Administrador") return [{ label: "Solicitações", prompt: "Abra e priorize as solicitações que precisam da minha atenção", description: "aprovar, rejeitar ou pedir ajuste" }, { label: "Agenda", prompt: "Mostre minha agenda e compromissos relevantes", description: "horários e próximos eventos" }, { label: "Logs", prompt: "Verifique logs e eventos críticos das últimas 24 horas", description: "risco técnico" }, { label: "Permissões", prompt: "Analise usuários, perfis e permissões disponíveis", description: "acessos do perfil" }, { label: "Empresas", prompt: "Mostre empresas com atividade ou risco recente", description: "empresa e contexto" }, { label: "Chamados", prompt: "Liste chamados que precisam de resposta", description: "triagem e acompanhamento" }]; if (roleLabel === "Empresa") return [{ label: "Projeto", prompt: "Resuma a saúde do meu projeto", description: "qualidade e riscos" }, { label: "Pendências", prompt: "Liste minhas pendências abertas", description: "itens aguardando ação" }, { label: "Entregas", prompt: "Mostre próximas entregas e riscos", description: "agenda e previsão" }]; return [{ label: "Continuar", prompt: "Me ajude a continuar meu trabalho", description: "retomar contexto" }, { label: "Runs", prompt: "Mostre meus runs recentes", description: "execuções" }, { label: "Bugs", prompt: "Resuma bugs e riscos atuais", description: "prioridade" }]; }
function resolveSpeechRecognition() { if (typeof window === "undefined") return null; const speechWindow = window as Window & { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike }; return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null; }
function resolveVoice(voices: SpeechSynthesisVoice[], selectedName: string) { return voices.find((voice) => voice.name === selectedName) ?? voices.find((voice) => voice.lang === "pt-BR" && /female|maria|luciana|francisca|google/i.test(voice.name)) ?? voices.find((voice) => voice.lang === "pt-BR") ?? voices.find((voice) => voice.lang.startsWith("pt")) ?? null; }
function useTypewriter(text: string, speed = 44) { const [typedText, setTypedText] = useState(""); useEffect(() => { setTypedText(""); let index = 0; const timer = window.setInterval(() => { index += 1; setTypedText(text.slice(0, index)); if (index >= text.length) window.clearInterval(timer); }, speed); return () => window.clearInterval(timer); }, [speed, text]); return typedText; }
function BrainOrb({ listening, speaking }: { listening: boolean; speaking: boolean }) { return <motion.div className="relative h-[170px] w-[170px] sm:h-[220px] sm:w-[220px] lg:h-[260px] lg:w-[260px]" initial={{ opacity: 0, y: 10, scale: 0.96 }} animate={{ opacity: 1, y: [0, -7, 0], scale: listening || speaking ? [1, 1.035, 1] : [1, 1.01, 1] }} transition={{ opacity: { duration: 0.45 }, y: { repeat: Infinity, duration: speaking ? 2.6 : 4.6, ease: "easeInOut" }, scale: { repeat: Infinity, duration: speaking ? 1.8 : 3.8, ease: "easeInOut" } }} aria-label="Brain visual"><div className="absolute inset-[18px] rounded-full" /></motion.div>; }
function buildInitialMessage(greeting: string, firstName: string, roleLabel: string) { return `${greeting}, ${firstName}. Vamos iniciar por onde hoje? Eu posso trabalhar com o que está disponível para seu perfil de ${roleLabel}. Se você permitir localização, eu também comento o tempo da sua região antes de começarmos.`; }
function createSession(initialText: string): BrainSession { const now = new Date().toISOString(); return { id: `brain-session-${Date.now()}`, title: "Nova conversa", createdAt: now, updatedAt: now, messages: [{ id: `assistant-${Date.now()}`, role: "assistant", text: initialText }] }; }
function titleFromMessages(messages: BrainMessage[]) { const firstUserMessage = messages.find((message) => message.role === "user")?.text; return firstUserMessage ? firstUserMessage.slice(0, 48) : "Conversa do Brain"; }
function formatHomeReply(prompt: string, fallbackRole: string, payload: BrainAskPayload | null) { if (payload?.reply) return payload.reply; return `Certo. Vou trabalhar com este contexto: ${prompt}.\n\nO que vou considerar:\n- permissões reais do seu perfil de ${fallbackRole};\n- módulos visíveis na Home;\n- nós do Brain/RAG disponíveis;\n- APIs internas liberadas para sua conta.\n\nMe diga a empresa, projeto ou item que quer executar.`; }
function voiceErrorMessage(error: unknown) { const name = typeof error === "object" && error && "error" in error ? String((error as { error?: unknown }).error) : ""; if (name === "not-allowed" || name === "service-not-allowed") return "O navegador bloqueou o microfone. Quer tentar permitir novamente?"; if (name === "no-speech") return "Não ouvi nenhuma fala. Clique no botão de áudio e fale quando ele ficar vermelho."; if (name === "audio-capture") return "Não encontrei microfone ativo neste dispositivo."; return "Não consegui captar o áudio. Tente pelo Chrome/Edge, permita o microfone ou use o microfone do teclado para ditar no campo."; }
function isHomeSmallTalk(prompt: string) { const text = normalizeText(prompt).replace(/[!.?,;:]+/g, " ").replace(/\s+/g, " ").trim(); return /^(oi|ola|e ai|bom dia|boa tarde|boa noite|tudo bem|como vai|esta me ouvindo|esta me escutando|voce esta ai|você esta ai)( brian| brain)?$/.test(text); }
function wantsHomeWeather(prompt: string) { return /\b(clima|tempo|temperatura|previsao|chuva|frio|calor|daqui hoje)\b/i.test(normalizeText(prompt)); }
function wantsHomeJoke(prompt: string) { return /\b(piada|brincadeira|rir|engracad)\b/i.test(normalizeText(prompt)); }
function localHomeReply(prompt: string, roleLabel: string, action: BrainHomeAction | null | undefined, weatherContext: BrainWeatherContext | null) { const actionLabel = action?.label ?? action?.moduleLabel ?? ""; const normalizedAction = normalizeText(actionLabel); if (normalizedAction.includes("agenda")) return `Contexto: Agenda\n\nPerfeito, Ana. Estou na Agenda. Posso te ajudar a ver compromissos, organizar horários, filtrar por empresa/usuário ou preparar um novo agendamento.`; if (wantsHomeJoke(prompt)) return "Claro 😄 Por que o bug foi ao psicólogo? Porque ele vivia se reproduzindo em produção e ninguém entendia o motivo.\n\nAgora me diz: seguimos para Agenda, permissões ou investigação?"; if (wantsHomeWeather(prompt)) return weatherContext?.comment ?? "Ainda não tenho sua localização liberada nesta sessão. Permita a localização no navegador ou me diga sua cidade/UF que eu te respondo o clima sem travar a Home."; if (isHomeSmallTalk(prompt)) return `Oi, Ana! Estou te ouvindo e pronto para ajudar como ${roleLabel}.\n\nPode digitar ou falar o que você quer fazer: Agenda, solicitações, permissões, logs, bug, caso de teste ou investigação.`; return null; }

export default function NewHomeContent() {
  const { user } = useAuthUser();
  const { modules, effectiveRole } = useNavigationItems();
  const [isHydrated, setIsHydrated] = useState(false);
  const [command, setCommand] = useState("");
  const [listening, setListening] = useState(false);
  const [directVoiceMode, setDirectVoiceMode] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState("");
  const [voiceToast, setVoiceToast] = useState<VoiceToast | null>(null);
  const [volume, setVolume] = useState(0.85);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [sessions, setSessions] = useState<BrainSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState("");
  const [weatherContext, setWeatherContext] = useState<BrainWeatherContext | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const firstName = isHydrated ? resolveFirstName(user) : "Ana";
  const roleLabel = isHydrated ? (effectiveRole ? resolveRoleLabel({ role: effectiveRole }) : resolveRoleLabel(user)) : "Usuário";
  const greeting = useMemo(() => (isHydrated ? resolveGreeting() : "Boa tarde"), [isHydrated]);
  const navActions = useMemo(() => (isHydrated ? buildBrainHomeActions(modules).slice(0, 8) : []), [isHydrated, modules]);
  const suggestions = useMemo<(BrainSuggestion | BrainHomeAction)[]>(() => { if (!isHydrated) return []; return navActions.length ? navActions : buildSuggestions(roleLabel); }, [isHydrated, navActions, roleLabel]);
  const initialAssistantText = useMemo(() => buildInitialMessage(greeting, firstName, roleLabel), [firstName, greeting, roleLabel]);
  const currentSession = sessions.find((session) => session.id === currentSessionId);
  const messages = currentSession?.messages ?? [];
  const latestAssistantIndex = messages.findLastIndex((message) => message.role === "assistant");
  const latestAssistantMessage = latestAssistantIndex >= 0 ? messages[latestAssistantIndex].text : "";
  const typedAssistantText = useTypewriter(latestAssistantMessage, 46);
  const isTyping = typedAssistantText.length < latestAssistantMessage.length;

  useEffect(() => { setIsHydrated(true); }, []);
  useEffect(() => { if (!isHydrated) return; const today = todayBR(); const storedDay = window.localStorage.getItem(DAILY_KEY); const stored = window.localStorage.getItem(STORAGE_KEY); const parsed = stored ? (JSON.parse(stored) as BrainSession[]) : []; const shouldStartFresh = storedDay !== today || parsed.length === 0; const nextSessions = shouldStartFresh ? [createSession(initialAssistantText), ...parsed] : parsed; window.localStorage.setItem(DAILY_KEY, today); setSessions(nextSessions); setCurrentSessionId(nextSessions[0]?.id ?? ""); }, [initialAssistantText, isHydrated]);
  useEffect(() => { if (sessions.length) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions.slice(0, 30))); }, [sessions]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages, typedAssistantText]);
  useEffect(() => { if (typeof window === "undefined" || !window.speechSynthesis) return; const loadVoices = () => setAvailableVoices(window.speechSynthesis.getVoices().filter((voice) => voice.lang.startsWith("pt"))); loadVoices(); window.speechSynthesis.onvoiceschanged = loadVoices; return () => { window.speechSynthesis.onvoiceschanged = null; window.speechSynthesis.cancel(); recognitionRef.current?.abort(); }; }, []);
  useEffect(() => { if (voiceEnabled && latestAssistantMessage && latestAssistantMessage !== LOADING_TEXT) speakBrain(latestAssistantMessage); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [latestAssistantMessage, voiceEnabled, selectedVoice, volume]);
  useEffect(() => { if (!voiceToast) return; const timer = window.setTimeout(() => setVoiceToast((current) => (current?.id === voiceToast.id ? null : current)), voiceToast.duration ?? 5200); return () => window.clearTimeout(timer); }, [voiceToast]);
  useEffect(() => { if (!isHydrated || typeof navigator === "undefined" || !navigator.geolocation) return; let cancelled = false; navigator.geolocation.getCurrentPosition(async (position) => { try { const { latitude, longitude } = position.coords; const response = await fetch(`/api/brain/weather?lat=${encodeURIComponent(String(latitude))}&lon=${encodeURIComponent(String(longitude))}`, { credentials: "include" }); const payload = (await response.json().catch(() => null)) as BrainWeatherContext | null; if (!cancelled && payload?.comment) setWeatherContext(payload); } catch { if (!cancelled) setWeatherContext(null); } }, () => setWeatherContext(null), { enableHighAccuracy: false, maximumAge: 20 * 60 * 1000, timeout: 8000 }); return () => { cancelled = true; }; }, [isHydrated]);
  useEffect(() => { if (!isHydrated || !currentSessionId || !weatherContext?.comment || typeof window === "undefined") return; const today = todayBR(); if (window.localStorage.getItem(WEATHER_DAILY_KEY) === today) return; updateCurrentSession((session) => ({ ...session, updatedAt: new Date().toISOString(), messages: [...session.messages, { id: `assistant-weather-${Date.now()}`, role: "assistant", text: weatherContext.comment ?? "" }] })); window.localStorage.setItem(WEATHER_DAILY_KEY, today); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [currentSessionId, isHydrated, weatherContext?.comment]);

  function updateCurrentSession(updater: (session: BrainSession) => BrainSession) { setSessions((current) => current.map((session) => (session.id === currentSessionId ? updater(session) : session))); }
  function showVoiceToast(text: string, options: Omit<VoiceToast, "id" | "text"> = {}) { setVoiceStatus(text); setVoiceToast({ id: Date.now(), text, ...options }); }
  function speakBrain(text: string) { if (typeof window === "undefined" || !window.speechSynthesis || !text.trim()) return; window.speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(text); utterance.lang = "pt-BR"; utterance.rate = 0.92; utterance.pitch = 1.02; utterance.volume = volume; const voice = resolveVoice(window.speechSynthesis.getVoices(), selectedVoice); if (voice) utterance.voice = voice; utterance.onstart = () => setSpeaking(true); utterance.onend = () => setSpeaking(false); utterance.onerror = () => setSpeaking(false); window.speechSynthesis.speak(utterance); }
  function openAssistant(prompt: string, action?: BrainHomeAction | null) { window.dispatchEvent(new CustomEvent("assistant:open", { detail: { source: "admin-home", route: "/admin/home", panelMode: "side", agentMode: "qa", focusInput: true, initialMessage: prompt, context: { module: "home", screenLabel: "Brain Home", metadata: { roleLabel, action, weather: weatherContext, availableActions: suggestions.map((item) => item.label) } } } })); }
  async function askBrain(prompt: string, action?: BrainHomeAction | null) {
    const localReply = localHomeReply(prompt, roleLabel, action, weatherContext);
    if (localReply) return localReply;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 45000);
    try {
      const response = await fetch("/api/brain/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        signal: controller.signal,
        body: JSON.stringify({
          messages: [{ role: "user", content: prompt }],
          agentMode: "qa",
          route: "/admin/home",
          screenLabel: "Brain Home",
        }),
      });
      if (!response.ok || !response.body) return formatHomeReply(prompt, roleLabel, null);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let reply = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const part = JSON.parse(line) as { type?: string; text?: string; error?: string };
            if (part.type === "text-delta" && typeof part.text === "string") reply += part.text;
          } catch {
            // ignore malformed NDJSON lines
          }
        }
      }
      return formatHomeReply(prompt, roleLabel, reply ? { reply } : null);
    } catch {
      return "Não consegui concluir a consulta agora, mas a Home continua ativa. Me diga o módulo, empresa, usuário, ticket ou erro que eu tento pelo caminho seguro.";
    } finally {
      window.clearTimeout(timeout);
    }
  }
  async function sendPrompt(prompt: string, action?: BrainHomeAction | null) { const cleanPrompt = prompt.trim(); if (!cleanPrompt || !currentSessionId) return; const now = Date.now(); const assistantId = `assistant-${now}`; updateCurrentSession((session) => ({ ...session, title: titleFromMessages([...session.messages, { id: `user-${now}`, role: "user", text: cleanPrompt }]), updatedAt: new Date().toISOString(), messages: [...session.messages, { id: `user-${now}`, role: "user", text: cleanPrompt }, { id: assistantId, role: "assistant", text: LOADING_TEXT }] })); openAssistant(cleanPrompt, action); setCommand(""); setVoiceStatus(""); setVoiceToast(null); const assistantText = await askBrain(cleanPrompt, action); updateCurrentSession((session) => ({ ...session, updatedAt: new Date().toISOString(), messages: session.messages.map((message) => message.id === assistantId ? { ...message, text: assistantText } : message) })); }
  function handleSubmit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void sendPrompt(command); }
  function handleSuggestion(item: BrainSuggestion | BrainHomeAction) { void sendPrompt(item.prompt, "id" in item ? item as BrainHomeAction : null); }
  function startNewConversation() { const next = createSession(initialAssistantText); setSessions((current) => [next, ...current]); setCurrentSessionId(next.id); setHistoryOpen(false); setCommand(""); setVoiceStatus(""); setVoiceToast(null); }
  function openSession(sessionId: string) { setCurrentSessionId(sessionId); setHistoryOpen(false); setCommand(""); setVoiceStatus(""); setVoiceToast(null); }
  async function requestMicrophonePermission() { if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) return true; const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); stream.getTracks().forEach((track) => track.stop()); return true; }
  async function handleVoiceInput(sendDirectly: boolean) {
    if (listening) { recognitionRef.current?.stop(); showVoiceToast("Processando o que eu ouvi..."); return; }
    const SpeechRecognition = resolveSpeechRecognition();
    if (!SpeechRecognition) { setSpeechSupported(false); showVoiceToast(VOICE_UNSUPPORTED_TEXT, { duration: 6500 }); return; }
    if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
    try { await requestMicrophonePermission(); } catch { showVoiceToast("Microfone bloqueado. Quer reenviar o aceite para permitir?", { actionLabel: "Permitir novamente", actionMode: sendDirectly, duration: 9000 }); return; }
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    let latestTranscript = "";
    let finalTranscript = "";
    recognition.lang = "pt-BR";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;
    setSpeechSupported(true);
    setDirectVoiceMode(sendDirectly);
    showVoiceToast("Preparando microfone...");
    if (sendDirectly) setVoiceEnabled(true);
    recognition.onstart = () => { setListening(true); showVoiceToast("Estou ouvindo... fale agora."); };
    recognition.onresult = (event) => { let fullTranscript = ""; for (let index = 0; index < event.results.length; index += 1) { const part = event.results[index]?.[0]?.transcript ?? ""; fullTranscript += part; if (event.results[index]?.isFinal) finalTranscript += part; } latestTranscript = fullTranscript.trim(); setCommand(latestTranscript); if (latestTranscript) showVoiceToast(sendDirectly ? "Entendi. Vou enviar quando você parar de falar." : "Transcrevendo na barra. Revise e envie."); };
    recognition.onerror = (event) => { const message = voiceErrorMessage(event); const canRetry = message.includes("bloqueou") || message.includes("permitir"); setListening(false); setDirectVoiceMode(false); recognitionRef.current = null; showVoiceToast(message, canRetry ? { actionLabel: "Permitir novamente", actionMode: sendDirectly, duration: 9000 } : { duration: 6500 }); };
    recognition.onend = () => { setListening(false); setDirectVoiceMode(false); recognitionRef.current = null; const transcript = (finalTranscript || latestTranscript).trim(); if (sendDirectly && transcript) { showVoiceToast("Enviando sua fala para o Brian..."); void sendPrompt(transcript); return; } if (!sendDirectly && transcript) { showVoiceToast("Texto capturado. Clique em Enviar para o Brian responder."); return; } showVoiceToast("Não ouvi nenhuma frase. Tente novamente falando depois que o microfone ficar vermelho."); };
    try { recognition.start(); } catch { setListening(false); setDirectVoiceMode(false); recognitionRef.current = null; showVoiceToast("O microfone não iniciou. Quer tentar permitir novamente?", { actionLabel: "Tentar novamente", actionMode: sendDirectly, duration: 9000 }); }
  }

  return (
    <section className="admin-brain-home relative min-h-[calc(100vh-7rem)] w-full overflow-y-auto overflow-x-hidden bg-transparent px-3 pb-44 pt-4 sm:px-6 sm:pb-36 lg:px-10">
      <div className="admin-brain-session-controls fixed right-4 top-20 z-30 flex items-center gap-2 sm:right-8 sm:top-24"><button type="button" onClick={() => setHistoryOpen((current) => !current)} className="admin-brain-icon-action" title="Histórico de conversas" aria-label="Histórico de conversas"><FiClock className="h-4 w-4" /></button><button type="button" onClick={startNewConversation} className="admin-brain-icon-action" title="Nova conversa" aria-label="Nova conversa"><FiPlus className="h-4 w-4" /></button></div>
      <div className="relative z-10 grid min-h-[420px] grid-cols-1 gap-3 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-6 lg:items-start"><aside className="flex justify-center pt-1 lg:justify-start lg:pl-2"><BrainOrb listening={listening} speaking={speaking || isTyping} /></aside><main className="admin-brain-copy mx-auto flex h-[calc(100vh-19rem)] min-h-[260px] w-full max-w-6xl flex-col justify-start gap-4 overflow-hidden pt-2 text-left sm:h-[calc(100vh-17rem)] lg:h-[calc(100vh-15rem)] lg:pt-12 lg:pr-12"><div className="admin-brain-chat-list space-y-3 overflow-y-auto overflow-x-hidden pr-1 sm:pr-2">{messages.map((message, index) => { const isLatestAssistant = message.role === "assistant" && index === latestAssistantIndex; const displayText = isLatestAssistant ? typedAssistantText : message.text; return <div key={message.id} className={`flex min-w-0 ${message.role === "user" ? "justify-end" : "justify-start"}`}><div className={`admin-brain-message max-w-[92%] overflow-hidden rounded-3xl px-4 py-3 sm:max-w-[82%] sm:px-5 sm:py-4 ${message.role === "user" ? "admin-brain-message-user text-right" : "admin-brain-message-assistant"}`}><p className="min-w-0 whitespace-pre-wrap break-words text-sm font-semibold leading-relaxed sm:text-xl">{displayText}{isLatestAssistant ? <motion.span className="ml-1 inline-block h-5 w-[2px] translate-y-1 bg-red-500" animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 0.9 }} /> : null}</p></div></div>; })}<div ref={messagesEndRef} /></div></main></div>
      <div className="admin-brain-actions fixed bottom-[7.1rem] left-3 right-3 z-30 flex max-h-24 flex-wrap items-stretch gap-2 overflow-y-auto overflow-x-hidden sm:left-6 sm:right-6 lg:left-[13.25rem] lg:right-[6.25rem]">{suggestions.map((item) => <button key={item.label} type="button" onClick={() => handleSuggestion(item)} className="admin-brain-action min-w-[7.5rem] flex-1 rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-2 text-left transition hover:border-red-400/50 hover:bg-red-500/10 sm:flex-none"><span className="block text-xs font-bold text-white">{item.label}</span><span className="mt-0.5 block truncate text-[10px] text-slate-400">{item.description}</span></button>)}</div>
      {historyOpen ? <div className="admin-brain-history fixed right-4 top-32 z-40 w-[min(360px,calc(100vw-2rem))] rounded-3xl border border-white/10 bg-slate-950/90 p-3 shadow-2xl backdrop-blur-xl sm:right-8 sm:top-36"><p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Histórico</p><div className="max-h-64 space-y-2 overflow-y-auto pr-1">{sessions.map((session) => <button key={session.id} type="button" onClick={() => openSession(session.id)} className={`w-full rounded-2xl border px-3 py-2 text-left transition ${session.id === currentSessionId ? "border-red-400/40 bg-red-500/10" : "border-white/10 bg-white/[0.035] hover:border-white/25"}`}><span className="block truncate text-xs font-semibold text-white">{session.title}</span><span className="mt-0.5 block text-[10px] text-slate-400">{new Date(session.updatedAt).toLocaleString("pt-BR")}</span></button>)}</div></div> : null}
      <form onSubmit={handleSubmit} className="admin-brain-command fixed bottom-3 left-3 right-3 z-30 flex items-center gap-2 rounded-3xl border border-white/10 bg-[#0f172a]/90 px-3 py-3 shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:left-6 sm:right-6 sm:rounded-full sm:px-5 lg:left-[13.25rem] lg:right-4"><input value={command} onChange={(event) => setCommand(event.target.value)} placeholder={listening ? "Estou ouvindo... fale agora" : "Digite ou fale com o Brian..."} className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-500" /><button type="button" onClick={() => { void handleVoiceInput(false); }} className={`grid h-10 w-10 shrink-0 place-items-center rounded-full transition ${listening && !directVoiceMode ? "bg-red-500/20 text-red-200" : "text-slate-400 hover:bg-white/5 hover:text-white"}`} title="Transcrever áudio na barra"><FiMic className="h-5 w-5" /></button><button type="button" onClick={() => { void handleVoiceInput(true); }} className={`grid h-10 w-10 shrink-0 place-items-center rounded-full transition ${listening && directVoiceMode ? "bg-red-500/20 text-red-200" : "text-slate-400 hover:bg-white/5 hover:text-white"}`} title="Conversar por áudio direto"><FiMessageCircle className="h-5 w-5" /></button><button type="button" onClick={() => setVoiceEnabled((current) => !current)} className={`grid h-10 w-10 shrink-0 place-items-center rounded-full transition ${voiceEnabled ? "bg-blue-500/20 text-blue-100" : "text-slate-400 hover:bg-white/5 hover:text-white"}`} title="Ativar ou pausar voz do Brain">{voiceEnabled ? <FiVolume2 className="h-5 w-5" /> : <FiVolumeX className="h-5 w-5" />}</button><input aria-label="Volume do Brain" title="Volume do Brain" type="range" min="0" max="1" step="0.05" value={volume} onChange={(event) => setVolume(Number(event.target.value))} className="hidden w-20 accent-red-500 xl:block" />{availableVoices.length ? <select aria-label="Voz do Brain" value={selectedVoice} onChange={(event) => setSelectedVoice(event.target.value)} className="hidden max-w-36 rounded-full border border-white/10 bg-transparent px-2 py-2 text-xs text-slate-300 outline-none 2xl:block"><option value="">Voz padrão</option>{availableVoices.map((voice) => <option key={voice.name} value={voice.name}>{voice.name}</option>)}</select> : null}<button type="submit" className="inline-flex shrink-0 items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-red-600 px-4 py-2.5 text-sm font-bold text-white shadow-[0_8px_24px_rgba(239,68,68,0.18)] transition hover:scale-[1.02] sm:px-5"><span className="hidden sm:inline">Enviar</span><FiSend className="h-4 w-4" /></button></form>
      {voiceToast ? <motion.div key={voiceToast.id} role="status" aria-live="polite" className="fixed bottom-[5.7rem] left-4 right-4 z-40 mx-auto flex max-w-[min(680px,calc(100vw-2rem))] items-center justify-between gap-3 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/90 px-3 py-2 text-xs leading-snug text-slate-200 shadow-xl backdrop-blur lg:left-[13.25rem] lg:right-4" initial={{ opacity: 0, y: 8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.98 }}><span className="min-w-0 break-words">{voiceToast.text}</span>{voiceToast.actionLabel ? <button type="button" className="shrink-0 rounded-full border border-red-400/35 bg-red-500/15 px-3 py-1.5 text-[11px] font-bold text-red-100 transition hover:bg-red-500/25" onClick={() => { const mode = voiceToast.actionMode ?? false; setVoiceToast(null); void handleVoiceInput(mode); }}>{voiceToast.actionLabel}</button> : null}</motion.div> : null}
    </section>
  );
}
