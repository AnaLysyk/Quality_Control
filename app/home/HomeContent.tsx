"use client";

import { type CSSProperties, type FormEvent, type MouseEvent, useEffect, useMemo, useState } from "react";
import { FiClock, FiCommand, FiMessageCircle, FiMic, FiZap } from "react-icons/fi";

import { useAuthUser } from "@/hooks/useAuthUser";

type ProfileExperience = { label: string; summary: string; prompts: string[] };
type BrainUpdateWindow = { id: string; title: string; text: string; scope: string; ts: number };
type BrainPointer = { x: number; y: number };
type BrainOrbStyle = CSSProperties & { "--brain-look-x"?: string; "--brain-look-y"?: string; "--brain-tilt-x"?: string; "--brain-tilt-y"?: string };

type HomeContextPayload = {
  periodLabel?: string;
  typedMessages?: string[];
  summary?: { actions?: number; companiesUpdated?: number; usersInvolved?: number; pendingItems?: number; flowsWithRisk?: number };
  highlights?: Array<{ title?: string; description?: string; type?: string }>;
};

type BrowserSpeechRecognitionEvent = { resultIndex: number; results: { length: number; [index: number]: { isFinal?: boolean; [index: number]: { transcript: string } } } };
type BrowserSpeechRecognition = { lang: string; interimResults: boolean; continuous: boolean; maxAlternatives: number; start: () => void; stop: () => void; abort: () => void; onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null; onerror: (() => void) | null; onend: (() => void) | null };

const HOME_UPDATES_KEY_PREFIX = "brain_home_update_windows_v1";

function normalizeText(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function resolveFirstName(user: unknown) {
  const candidate = (user as { name?: string | null } | null)?.name ?? (user as { fullName?: string | null } | null)?.fullName ?? (user as { displayName?: string | null } | null)?.displayName ?? "Ana";
  return candidate.trim().split(" ")[0] || "Ana";
}

function resolveGreeting() {
  const hour = Number(new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", hour12: false, timeZone: "America/Sao_Paulo" }).format(new Date()));
  if (hour >= 5 && hour < 12) return "Bom dia";
  if (hour >= 12 && hour < 18) return "Boa tarde";
  return "Boa noite";
}

function resolveProfileExperience(roleValue: string): ProfileExperience {
  const role = normalizeText(roleValue);
  if (role.includes("leader") || role.includes("lider")) return { label: "Líder TC", summary: "Eu cruzo empresas, usuários, solicitações, fluxos e pendências recentes para explicar a próxima ação.", prompts: ["Analisar por empresa", "Analisar por usuário", "Ver pendências das últimas horas"] };
  if (role.includes("support") || role.includes("suporte") || role.includes("technical")) return { label: "Suporte Técnico", summary: "Eu organizo chamados, integrações, usuários bloqueados e alertas técnicos para acelerar o atendimento.", prompts: ["Ver incidentes", "Analisar integrações", "Checar usuários nas últimas horas"] };
  if (role.includes("empresa") || role.includes("company")) return { label: "Empresa", summary: "Eu organizo projeto, pendências, próximas entregas e movimentações recentes da empresa.", prompts: ["Ver saúde do projeto", "Listar pendências", "Atualizações das últimas 24 horas"] };
  return { label: "QA", summary: "Eu conecto runs, evidências, bugs e plano atual para você continuar sem procurar no menu.", prompts: ["Continuar meu trabalho", "Ver meus runs", "Revisar bugs das últimas horas"] };
}

function resolveSpeechRecognitionConstructor() {
  if (typeof window === "undefined") return null;
  const speechWindow = window as unknown as { SpeechRecognition?: new () => BrowserSpeechRecognition; webkitSpeechRecognition?: new () => BrowserSpeechRecognition };
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

function makeHomeId(prefix: string) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function resolveAssistantActor(user: unknown) {
  const record = (user ?? {}) as Record<string, unknown>;
  return {
    userId: typeof record.id === "string" ? record.id : null,
    permissionRole: typeof record.permissionRole === "string" ? record.permissionRole : null,
    role: typeof record.role === "string" ? record.role : null,
    companyRole: typeof record.companyRole === "string" ? record.companyRole : null,
    companySlug: typeof record.clientSlug === "string" ? record.clientSlug : null,
    companySlugs: Array.isArray(record.clientSlugs) ? record.clientSlugs : null,
    userOrigin: typeof record.userOrigin === "string" ? record.userOrigin : typeof record.user_origin === "string" ? record.user_origin : null,
    isGlobalAdmin: Boolean(record.isGlobalAdmin ?? record.is_global_admin),
  };
}

function extractHourWindow(command: string) {
  const normalized = normalizeText(command);
  const match = normalized.match(/(?:ultimas?|em|por)\s*(\d{1,2})\s*h(?:oras?)?/i) ?? normalized.match(/(\d{1,2})\s*h(?:oras?)?/i);
  const hours = match?.[1] ? Math.max(1, Math.min(72, Number(match[1]))) : 24;
  return { hours, label: hours === 1 ? "última 1 hora" : `últimas ${hours} horas`, apiRange: hours <= 24 ? "24h" : hours <= 168 ? "7d" : "30d" };
}

function buildInitialUpdates(input: { greeting: string; userName: string; profile: ProfileExperience; payload?: HomeContextPayload | null }): BrainUpdateWindow[] {
  const periodLabel = input.payload?.periodLabel ?? "últimas 24 horas";
  const summary = input.payload?.summary;
  const highlights = Array.isArray(input.payload?.highlights) ? input.payload?.highlights ?? [] : [];
  const baseText = Array.isArray(input.payload?.typedMessages) ? input.payload?.typedMessages?.join(" ").trim() ?? "" : "";
  const now = Date.now();
  const updates: BrainUpdateWindow[] = [{ id: makeHomeId("update"), title: "Brain acordado", scope: periodLabel, text: baseText || `${input.greeting}, ${input.userName}. Estou lendo empresas, usuários, fluxos e pendências. Escolha por onde começamos: empresa, usuário, tela ou risco.`, ts: now }];
  if (summary) updates.push({ id: makeHomeId("update"), title: "Resumo vivo do contexto", scope: periodLabel, text: `${summary.actions ?? 0} ações registradas • ${summary.companiesUpdated ?? 0} empresas atualizadas • ${summary.usersInvolved ?? 0} usuários envolvidos • ${summary.pendingItems ?? 0} pendências • ${summary.flowsWithRisk ?? 0} fluxos com risco.`, ts: now + 1 });
  for (const item of highlights.slice(0, 3)) updates.push({ id: makeHomeId("update"), title: item.title || "Destaque do contexto", scope: periodLabel, text: item.description || "Movimento encontrado no contexto recente.", ts: now + updates.length });
  return updates.slice(-5);
}

function BrainOrb({ active, listening, speaking, pointer }: { active: boolean; listening: boolean; speaking: boolean; pointer: BrainPointer }) {
  const style: BrainOrbStyle = { "--brain-look-x": `${pointer.x * 10}px`, "--brain-look-y": `${pointer.y * 8}px`, "--brain-tilt-x": `${pointer.y * -5}deg`, "--brain-tilt-y": `${pointer.x * 6}deg` };
  return (
    <div className={`brain-orb-wrap ${active ? "is-active" : ""} ${listening ? "is-listening" : ""} ${speaking ? "is-speaking" : ""}`} style={style} aria-hidden="true">
      <div className="brain-atmosphere" />
      <div className="brain-wave-field"><span className="brain-wave wave-one" /><span className="brain-wave wave-two" /><span className="brain-wave wave-three" /><span className="brain-particle p1" /><span className="brain-particle p2" /><span className="brain-particle p3" /></div>
      <div className="brain-orb-aura" />
      <div className="brain-orb"><div className="brain-orb-liquid primary" /><div className="brain-orb-liquid secondary" /><div className="brain-orb-red-crescent" /><div className="brain-orb-glass" /><div className="brain-orb-shine" /><div className="brain-face"><span className="brain-eye brain-eye-left" /><span className="brain-mouth" /><span className="brain-eye brain-eye-right" /></div></div>
      <div className="brain-status-chip chip-memory">Memória ativa</div><div className="brain-status-chip chip-context">Contexto</div><div className="brain-status-chip chip-live">Brain vivo</div>
    </div>
  );
}

function openAssistantChat(input: { command: string; profile: ProfileExperience; updates: BrainUpdateWindow[]; hoursLabel: string }) {
  if (typeof window === "undefined") return;
  const updatesSnippet = input.updates.slice(-8).map((turn) => `Brain/${turn.scope}: ${turn.title} — ${turn.text}`).join("\n");
  const prompt = input.command.trim() || `Continue a análise da Home. Janela: ${input.hoursLabel}.\n\n${updatesSnippet}`;
  window.dispatchEvent(new CustomEvent("assistant:open", { detail: { source: "home", route: window.location.pathname || "/", panelMode: "side", agentMode: "qa", focusInput: true, initialMessage: prompt, context: { module: "home", screenLabel: "Brain Home", screenSummary: input.profile.summary, suggestedPrompts: input.profile.prompts, metadata: { hoursLabel: input.hoursLabel, updates: input.updates.slice(-8) } } } }));
}

function BrainConsole({ userName, profile, greeting, authUser }: { userName: string; profile: ProfileExperience; greeting: string; authUser: unknown }) {
  const [command, setCommand] = useState("");
  const [updates, setUpdates] = useState<BrainUpdateWindow[]>([]);
  const [sendingHome, setSendingHome] = useState(false);
  const [dictating, setDictating] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [pointer, setPointer] = useState<BrainPointer>({ x: 0, y: 0 });
  const [hoursLabel, setHoursLabel] = useState("últimas 24 horas");
  const homeStorageKey = useMemo(() => {
    const record = (authUser ?? {}) as Record<string, unknown>;
    const id = typeof record.id === "string" ? record.id : userName;
    return `${HOME_UPDATES_KEY_PREFIX}:${id}`;
  }, [authUser, userName]);
  const brainIsAwake = sendingHome || dictating || inputFocused || command.trim().length > 0;

  useEffect(() => {
    let active = true;
    async function loadInitialUpdates() {
      try {
        const raw = window.localStorage.getItem(homeStorageKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setUpdates(parsed.slice(-5));
            return;
          }
        }
      } catch {}
      try {
        const response = await fetch("/api/brain/home-context?range=24h", { cache: "no-store" });
        const payload = response.ok ? ((await response.json().catch(() => null)) as HomeContextPayload | null) : null;
        if (active) setUpdates(buildInitialUpdates({ greeting, userName, profile, payload }));
      } catch {
        if (active) setUpdates(buildInitialUpdates({ greeting, userName, profile }));
      }
    }
    void loadInitialUpdates();
    return () => { active = false; };
  }, [greeting, homeStorageKey, profile, userName]);

  useEffect(() => {
    if (updates.length === 0) return;
    try { window.localStorage.setItem(homeStorageKey, JSON.stringify(updates.slice(-8))); } catch {}
  }, [updates, homeStorageKey]);

  function handleBrainMouseMove(event: MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    const y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
    setPointer({ x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)) });
  }

  function replaceThinkingWithUpdate(text: string, scope: string, title = "Resposta organizada") {
    setUpdates((current) => [...current.filter((turn) => turn.id !== "brain-thinking-home"), { id: makeHomeId("update"), title, text, scope, ts: Date.now() }].slice(-8));
  }

  async function askHomeBrain(text: string) {
    const windowInfo = extractHourWindow(text);
    const scope = windowInfo.label;
    const previousUpdates = updates.slice(-6);
    setHoursLabel(scope);
    setCommand("");
    setSendingHome(true);
    setUpdates((current) => [...current.filter((turn) => turn.id !== "brain-thinking-home"), { id: "brain-thinking-home", title: "Brain em movimento", text: `Estou varrendo a ${scope}, cruzando contexto e preparando uma resposta útil.`, scope, ts: Date.now() }].slice(-8));
    openAssistantChat({ command: text, profile, updates: previousUpdates, hoursLabel: scope });
    try {
      const response = await fetch("/api/assistente/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: `Responda para a Home do Brain sem repetir a pergunta da usuária. Traga dados, informações organizadas e uma explicação clara. Janela solicitada: ${scope}. Pedido: ${text}`, context: { route: "/home", module: "home", screenLabel: "Brain Home", screenSummary: profile.summary, suggestedPrompts: profile.prompts, actor: resolveAssistantActor(authUser), metadata: { requestedWindow: scope, apiRange: windowInfo.apiRange, previousUpdates } } }) });
      const payload = (await response.json().catch(() => ({}))) as { answer?: string; message?: string; error?: string };
      replaceThinkingWithUpdate(payload.answer || payload.message || payload.error || "Não encontrei detalhes suficientes agora. Tente pedir por empresa, usuário, tela, fluxo ou período em horas.", scope);
    } catch {
      replaceThinkingWithUpdate("Não consegui consultar o Brain agora. Mantive o pedido no chat flutuante para continuar a análise por lá.", scope, "Consulta indisponível");
    } finally {
      setSendingHome(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = command.trim();
    if (!text || sendingHome) return;
    void askHomeBrain(text);
  }

  function startHomeDictation() {
    const SpeechRecognitionConstructor = resolveSpeechRecognitionConstructor();
    if (!SpeechRecognitionConstructor) {
      replaceThinkingWithUpdate("Este navegador não liberou ditado por voz aqui. Você pode continuar digitando.", hoursLabel, "Áudio indisponível");
      return;
    }
    const recognition = new SpeechRecognitionConstructor();
    recognition.lang = "pt-BR";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      let transcript = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) transcript += event.results[index]?.[0]?.transcript ?? "";
      const spoken = transcript.trim();
      if (spoken) setCommand((current) => `${current}${current.trim() ? " " : ""}${spoken}`.trim());
    };
    recognition.onerror = () => setDictating(false);
    recognition.onend = () => setDictating(false);
    setDictating(true);
    recognition.start();
  }

  return (
    <section className="brain-home-shell relative ml-0 flex min-h-[calc(100vh-4.75rem)] w-full max-w-none overflow-hidden rounded-none border border-[var(--brain-border)] bg-[var(--brain-bg)] p-4 text-[var(--brain-text)] shadow-[0_30px_100px_var(--brain-shadow)] sm:rounded-[2rem] lg:min-h-[calc(100vh-5.5rem)] lg:p-6">
      <style>{`
        .brain-home-shell{--brain-bg:radial-gradient(circle at 10% 14%,rgba(239,0,1,.08),transparent 24%),radial-gradient(circle at 82% 20%,rgba(59,130,246,.13),transparent 30%),linear-gradient(135deg,#fff 0%,#f7faff 52%,#edf4ff 100%);--brain-text:#061225;--brain-muted:rgba(6,18,37,.62);--brain-panel:rgba(255,255,255,.84);--brain-panel-strong:rgba(255,255,255,.96);--brain-border:rgba(15,23,42,.12);--brain-chip:rgba(1,24,72,.06);--brain-input:rgba(255,255,255,.9);--brain-shadow:rgba(15,23,42,.10)}
        .dark .brain-home-shell,[data-theme="dark"] .brain-home-shell{--brain-bg:radial-gradient(circle at 13% 18%,rgba(239,0,1,.16),transparent 25%),radial-gradient(circle at 80% 20%,rgba(147,197,253,.13),transparent 29%),linear-gradient(135deg,#050713 0%,#070b18 46%,#0a1020 100%);--brain-text:#fff;--brain-muted:rgba(255,255,255,.62);--brain-panel:rgba(255,255,255,.075);--brain-panel-strong:rgba(255,255,255,.10);--brain-border:rgba(255,255,255,.12);--brain-chip:rgba(0,0,0,.20);--brain-input:rgba(0,0,0,.24);--brain-shadow:rgba(0,0,0,.34)}
        .brain-orb-wrap{position:relative;width:clamp(320px,34vw,560px);height:clamp(320px,34vw,560px);display:grid;place-items:center;isolation:isolate;perspective:900px;animation:brainRobotHover 6.4s ease-in-out infinite}.brain-atmosphere{position:absolute;inset:-12%;border-radius:999px;background:radial-gradient(circle at 50% 50%,rgba(255,52,82,.12),transparent 31%),radial-gradient(circle at 62% 45%,rgba(145,190,255,.14),transparent 38%);filter:blur(18px);opacity:.86;animation:brainAura 5.4s ease-in-out infinite}.brain-wave-field{position:absolute;inset:0;z-index:1;border-radius:999px;filter:drop-shadow(0 0 22px rgba(255,42,68,.24));transform:rotateX(var(--brain-tilt-x,0deg)) rotateY(var(--brain-tilt-y,0deg));transition:transform .18s ease-out}.brain-wave{position:absolute;border-radius:999px;opacity:.8;transform-origin:center}.brain-wave:before{content:"";position:absolute;inset:0;border-radius:inherit;padding:1px;background:conic-gradient(from 128deg,transparent 0deg,transparent 34deg,rgba(255,52,82,.20) 52deg,rgba(255,52,82,.98) 72deg,rgba(255,52,82,.18) 102deg,transparent 140deg,rgba(180,212,255,.26) 218deg,transparent 272deg,rgba(255,52,82,.52) 320deg,transparent 360deg);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude}.brain-wave:after{content:"";position:absolute;width:5px;height:5px;border-radius:999px;background:rgba(255,52,82,.98);box-shadow:0 0 16px rgba(255,52,82,.96),0 0 30px rgba(255,52,82,.42)}.wave-one{inset:18%;animation:brainWaveOrbit 9s linear infinite,brainWavePulse 4.1s ease-in-out infinite}.wave-one:after{right:10%;bottom:13%}.wave-two{inset:9%;opacity:.52;animation:brainWaveOrbit 16s linear infinite reverse,brainWavePulse 5.6s ease-in-out infinite reverse}.wave-two:after{right:7%;top:34%;width:3px;height:3px;opacity:.58}.wave-three{inset:1%;opacity:.28;animation:brainWaveOrbit 26s linear infinite,brainWavePulse 6.2s ease-in-out infinite}.wave-three:after{display:none}.brain-particle{position:absolute;z-index:2;width:4px;height:4px;border-radius:999px;background:rgba(255,255,255,.72);box-shadow:0 0 12px rgba(255,255,255,.62),0 0 24px rgba(255,52,82,.28)}.p1{left:19%;top:18%;animation:brainLightDrift 4.2s ease-in-out infinite}.p2{right:12%;top:43%;animation:brainLightDrift 5.1s ease-in-out infinite reverse}.p3{left:49%;bottom:8%;background:rgba(255,52,82,.75);animation:brainLightDrift 6s ease-in-out infinite}
        .brain-orb-aura{position:absolute;z-index:2;width:70%;height:70%;border-radius:999px;background:radial-gradient(circle at 33% 72%,rgba(255,40,70,.20),transparent 42%),radial-gradient(circle,rgba(94,139,213,.14),transparent 70%);filter:blur(15px);opacity:.76;animation:brainAura 5.4s ease-in-out infinite}.brain-orb{position:relative;z-index:3;width:52%;height:52%;border-radius:999px;overflow:hidden;background:radial-gradient(circle at 60% 18%,rgba(198,222,247,.22),rgba(132,169,210,.08) 15%,transparent 28%),radial-gradient(circle at 42% 55%,#162234 0%,#07101c 55%,#02050d 100%);border:1px solid rgba(194,215,255,.19);box-shadow:inset 16px 16px 30px rgba(222,238,255,.07),inset -30px -36px 64px rgba(0,0,0,.86),0 0 18px rgba(255,52,82,.28),0 0 48px rgba(255,52,82,.13),0 0 96px rgba(150,196,255,.12);animation:brainBotBreath 4.8s ease-in-out infinite;transform:rotateX(var(--brain-tilt-x,0deg)) rotateY(var(--brain-tilt-y,0deg));transition:transform .18s ease-out,box-shadow .22s ease-out}.brain-orb-liquid{position:absolute;border-radius:999px;mix-blend-mode:screen;pointer-events:none}.primary{left:-10%;bottom:2%;width:40%;height:45%;background:radial-gradient(circle at 78% 72%,rgba(255,44,72,.22),rgba(255,44,72,.07) 44%,transparent 74%);filter:blur(13px);opacity:.46;animation:brainLiquid 7.2s ease-in-out infinite}.secondary{right:-12%;top:-12%;width:48%;height:44%;background:radial-gradient(circle,rgba(190,220,255,.23),rgba(95,147,217,.08) 48%,transparent 72%);filter:blur(11px);opacity:.42;animation:brainLiquid 8.8s ease-in-out infinite reverse}.brain-orb-red-crescent{position:absolute;left:-1%;bottom:6%;width:43%;height:49%;border-radius:999px;border-left:5px solid rgba(255,52,82,.96);border-bottom:3px solid rgba(255,52,82,.58);filter:drop-shadow(0 0 10px rgba(255,52,82,.80));transform:rotate(-25deg)}.brain-orb-glass{position:absolute;inset:0;border-radius:inherit;background:radial-gradient(circle at 66% 18%,rgba(236,246,255,.17),transparent 21%),radial-gradient(circle at 56% 64%,transparent 0%,rgba(255,255,255,.018) 58%,rgba(255,255,255,.06) 100%)}.brain-orb-shine{position:absolute;right:12%;top:9%;width:36%;height:21%;border-radius:999px;background:linear-gradient(138deg,rgba(242,249,255,.27),rgba(190,218,255,.05) 50%,transparent 78%);transform:rotate(-30deg);opacity:.58}
        .brain-face{position:absolute;inset:0;z-index:4;display:flex;align-items:center;justify-content:center;gap:clamp(18px,2vw,30px);transform:translate3d(var(--brain-look-x,0),calc(4px + var(--brain-look-y,0)),0);animation:brainFaceMotion 5.4s ease-in-out infinite;transition:transform .16s ease-out}.brain-eye{position:relative;width:clamp(25px,2.7vw,38px);height:clamp(18px,2.2vw,30px);filter:drop-shadow(0 0 10px rgba(255,255,255,.98));animation:brainEyeBlink 7.2s ease-in-out infinite}.brain-eye:before,.brain-eye:after{content:"";position:absolute;top:50%;width:60%;height:17%;border-radius:999px;background:rgba(255,255,255,.96)}.brain-eye:before{left:2px;transform:rotate(-54deg);transform-origin:right center}.brain-eye:after{right:2px;transform:rotate(54deg);transform-origin:left center}.brain-eye-right{transform:scaleX(-1)}.brain-mouth{display:block;width:clamp(22px,2.4vw,35px);height:clamp(5px,.55vw,8px);border-radius:999px;background:rgba(255,255,255,.94);box-shadow:0 0 12px rgba(255,255,255,.88);animation:brainMouthIdle 4.7s ease-in-out infinite}.brain-status-chip{position:absolute;z-index:5;border:1px solid rgba(255,255,255,.12);border-radius:999px;background:rgba(5,10,22,.45);color:rgba(255,255,255,.72);padding:.45rem .75rem;font-size:10px;font-weight:900;letter-spacing:.14em;text-transform:uppercase;-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px)}.chip-memory{left:4%;top:20%;animation:brainChipFloat 5.2s ease-in-out infinite}.chip-context{right:1%;top:36%;animation:brainChipFloat 5.8s ease-in-out infinite reverse}.chip-live{left:19%;bottom:10%;animation:brainChipFloat 6.4s ease-in-out infinite}.is-active .wave-one{animation-duration:6.8s,3.2s}.is-active .wave-two{animation-duration:10.4s,4.2s}.brain-orb-wrap.is-active .brain-orb{box-shadow:inset 16px 16px 30px rgba(222,238,255,.08),inset -30px -36px 64px rgba(0,0,0,.86),0 0 28px rgba(255,52,82,.38),0 0 76px rgba(255,52,82,.18),0 0 120px rgba(150,196,255,.16)}.is-speaking .brain-mouth{animation:brainTalk .85s ease-in-out infinite}.is-listening .brain-atmosphere{background:radial-gradient(circle at 50% 50%,rgba(255,52,82,.18),transparent 31%),radial-gradient(circle at 62% 45%,rgba(145,190,255,.20),transparent 38%)}
        @keyframes brainRobotHover{0%,100%{transform:translate3d(0,0,0) rotate(-.35deg)}45%{transform:translate3d(0,-10px,0) rotate(.45deg)}70%{transform:translate3d(2px,-6px,0) rotate(-.15deg)}}@keyframes brainBotBreath{0%,100%{scale:1}50%{scale:1.025}}@keyframes brainAura{0%,100%{transform:scale(.94);opacity:.52}50%{transform:scale(1.12);opacity:.88}}@keyframes brainLiquid{0%,100%{transform:rotate(0deg) translate3d(0,0,0) scale(1)}50%{transform:rotate(10deg) translate3d(4px,-5px,0) scale(1.06)}}@keyframes brainWaveOrbit{to{transform:rotate(360deg)}}@keyframes brainWavePulse{0%,100%{opacity:.36}45%{opacity:.86}}@keyframes brainLightDrift{0%,100%{transform:translate3d(0,0,0) scale(.8);opacity:.28}50%{transform:translate3d(7px,-5px,0) scale(1.25);opacity:.68}}@keyframes brainFaceMotion{0%,100%{margin-top:4px}50%{margin-top:0}}@keyframes brainMouthIdle{0%,88%,100%{transform:scaleY(1);opacity:.94}92%{transform:scaleY(.24);opacity:.7}}@keyframes brainTalk{0%,100%{width:clamp(18px,2vw,28px);transform:scaleY(.8)}45%{width:clamp(34px,3.2vw,50px);transform:scaleY(1.35)}70%{width:clamp(24px,2.4vw,38px);transform:scaleY(.95)}}@keyframes brainEyeBlink{0%,93%,100%{scale:1 1}96%{scale:1 .2}}@keyframes brainChipFloat{0%,100%{transform:translate3d(0,0,0);opacity:.68}50%{transform:translate3d(0,-8px,0);opacity:.92}}@media(max-width:900px){.brain-status-chip{display:none}.brain-orb-wrap{width:clamp(260px,78vw,390px);height:clamp(260px,78vw,390px)}}@media(prefers-reduced-motion:reduce){.brain-orb-wrap,.brain-orb,.brain-orb-aura,.brain-orb-liquid,.brain-wave,.brain-particle,.brain-face,.brain-mouth,.brain-status-chip,.brain-atmosphere,.brain-eye{animation:none}}
      `}</style>
      <div className="relative z-10 grid min-h-full w-full flex-1 items-stretch gap-6 lg:grid-cols-[minmax(340px,44vw)_minmax(0,1fr)] xl:grid-cols-[minmax(430px,48vw)_minmax(0,1fr)]">
        <div className="relative flex min-h-[340px] items-center justify-center overflow-hidden rounded-[1.8rem] border border-[var(--brain-border)] bg-[var(--brain-chip)] p-4 lg:min-h-full" onMouseMove={handleBrainMouseMove} onMouseLeave={() => setPointer({ x: 0, y: 0 })}>
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(239,0,1,.08),transparent_35%),radial-gradient(circle_at_70%_25%,rgba(147,197,253,.08),transparent_33%)]" />
          <BrainOrb active={brainIsAwake} listening={dictating || inputFocused} speaking={sendingHome || command.trim().length > 0} pointer={pointer} />
        </div>
        <div className="flex min-h-full min-w-0 flex-col rounded-[1.8rem] border border-[var(--brain-border)] bg-[var(--brain-panel)] p-4 backdrop-blur lg:p-6">
          <div className="mb-4 flex flex-wrap items-center gap-2"><span className="inline-flex rounded-full border border-[var(--brain-border)] bg-[var(--brain-chip)] px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-[var(--brain-muted)]">Brain</span><span className="inline-flex items-center gap-2 rounded-full border border-[var(--brain-border)] bg-[var(--brain-chip)] px-3 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-[var(--brain-muted)]"><FiClock /> {hoursLabel}</span></div>
          <h1 className="text-3xl font-black leading-tight tracking-tight text-[var(--brain-text)] sm:text-4xl xl:text-5xl">{greeting}, <span className="text-[var(--tc-accent,#ef0001)]">{userName}.</span></h1>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-[var(--brain-muted)] sm:text-base">O Brain está ativo, lendo seu contexto e transformando dados em próximas ações.</p>
          <div className="mt-5 min-h-[260px] flex-1 space-y-3 overflow-auto pr-1 lg:min-h-0">
            {updates.map((item) => <article key={item.id} className="rounded-[1.35rem] rounded-bl-md border border-[var(--brain-border)] bg-[var(--brain-panel-strong)] px-4 py-3 text-[var(--brain-text)] shadow-[0_18px_44px_var(--brain-shadow)] backdrop-blur"><div className="mb-2 flex flex-wrap items-center gap-2"><span className="inline-flex items-center gap-1 rounded-full bg-[var(--tc-accent,#ef0001)]/16 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[var(--tc-accent,#ef0001)]"><FiZap /> {item.scope}</span><h2 className="text-sm font-black text-[var(--brain-text)]">{item.title}</h2></div><p className="whitespace-pre-line text-sm font-semibold leading-6 text-[var(--brain-text)] sm:text-base">{item.text}</p></article>)}
          </div>
          <form onSubmit={handleSubmit} className="mt-5 flex items-center gap-3 rounded-full border border-[var(--tc-accent,#ef0001)]/55 bg-[var(--brain-input)] px-5 py-4 shadow-[0_0_42px_rgba(59,130,246,0.13)] backdrop-blur"><FiCommand className="shrink-0 text-[var(--brain-muted)]" size={22} /><input value={command} onChange={(event) => setCommand(event.target.value)} onFocus={() => setInputFocused(true)} onBlur={() => setInputFocused(false)} placeholder="Peça dados, atualizações ou informe horas. Ex: últimas 6h por empresa..." className="min-w-0 flex-1 bg-transparent text-base font-semibold text-[var(--brain-text)] outline-none placeholder:text-[var(--brain-muted)]" /><button type="button" onClick={startHomeDictation} disabled={dictating || sendingHome} className={`hidden h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--brain-border)] bg-[var(--brain-chip)] text-[var(--brain-muted)] transition hover:border-[var(--tc-accent,#ef0001)]/55 hover:text-[var(--brain-text)] sm:inline-flex ${dictating ? "animate-pulse border-[var(--tc-accent,#ef0001)]/60 text-[var(--tc-accent,#ef0001)]" : ""}`} aria-label={dictating ? "Gravando áudio" : "Falar com o Brain"} title={dictating ? "Ouvindo..." : "Falar com o Brain"}><FiMic size={19} /></button><button type="submit" className="sr-only">Enviar para o Brain</button></form>
          <div className="mt-4 flex justify-end"><button type="button" onClick={() => openAssistantChat({ command, profile, updates, hoursLabel })} className="inline-flex items-center gap-2 rounded-full border border-[var(--brain-border)] bg-[var(--brain-chip)] px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--brain-text)] transition hover:border-[var(--tc-accent,#ef0001)]/55">Abrir conversa no chat <FiMessageCircle /></button></div>
        </div>
      </div>
    </section>
  );
}

export default function HomeContent() {
  const { user, loading: authLoading } = useAuthUser();
  const currentUser = user as { permissionRole?: string | null; role?: string | null; companyRole?: string | null } | null;
  const userName = resolveFirstName(user);
  const greeting = useMemo(() => resolveGreeting(), []);
  const roleValue = String(currentUser?.permissionRole ?? currentUser?.role ?? currentUser?.companyRole ?? "usuario");
  const profile = useMemo(() => resolveProfileExperience(roleValue), [roleValue]);
  if (authLoading) return <div className="flex min-h-[calc(100vh-5rem)] w-full items-center justify-center rounded-[2rem] border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#ffffff)] text-sm font-semibold text-[var(--tc-text-muted,#64748b)]">Carregando Brain...</div>;
  return <BrainConsole userName={userName} profile={profile} greeting={greeting} authUser={user} />;
}
