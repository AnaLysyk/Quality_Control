"use client";

import { type CSSProperties, type FormEvent, type MouseEvent, useEffect, useMemo, useState } from "react";
import { FiActivity, FiBriefcase, FiCalendar, FiCommand, FiGrid, FiHome, FiMessageCircle, FiMic, FiShield, FiZap } from "react-icons/fi";

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

const HOME_MENU_LINKS = [
  { label: "Home", href: "/admin/home", icon: FiHome },
  { label: "Agenda", href: "/agenda", icon: FiCalendar },
  { label: "Visão geral", href: "/dashboard", icon: FiGrid },
  { label: "Empresas", href: "/admin/companies", icon: FiBriefcase },
  { label: "Solicitações", href: "/admin/access-requests", icon: FiShield },
  { label: "Brain visual", href: "/admin/brain", icon: FiActivity },
];

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
  const updates: BrainUpdateWindow[] = [{ id: makeHomeId("update"), title: "Atualizações recentes", scope: periodLabel, text: baseText || `${input.greeting}, ${input.userName}. Analisei seu contexto recente. Use a barra para pedir últimas 24 horas, empresa, usuário, tela ou risco.`, ts: now }];
  if (summary) updates.push({ id: makeHomeId("update"), title: "Resumo tratado pelo Brain", scope: periodLabel, text: `${summary.actions ?? 0} ações registradas • ${summary.companiesUpdated ?? 0} empresas com atualização • ${summary.usersInvolved ?? 0} usuários envolvidos • ${summary.pendingItems ?? 0} pendências abertas • ${summary.flowsWithRisk ?? 0} fluxos com risco.`, ts: now + 1 });
  for (const item of highlights.slice(0, 4)) updates.push({ id: makeHomeId("update"), title: item.title || "Destaque do contexto", scope: periodLabel, text: item.description || "Movimento encontrado no contexto recente.", ts: now + updates.length });
  return updates.slice(-5);
}

function BrainOrb({ active, listening, speaking, pointer }: { active: boolean; listening: boolean; speaking: boolean; pointer: BrainPointer }) {
  const style: BrainOrbStyle = { "--brain-look-x": `${pointer.x * 11}px`, "--brain-look-y": `${pointer.y * 9}px`, "--brain-tilt-x": `${pointer.y * -5}deg`, "--brain-tilt-y": `${pointer.x * 7}deg` };
  return (
    <div className={`brain-orb-wrap ${active ? "is-active" : ""} ${listening ? "is-listening" : ""} ${speaking ? "is-speaking" : ""}`} style={style} aria-label="Brian, assistente visual">
      <div className="brain-orbit orbit-one" />
      <div className="brain-orbit orbit-two" />
      <div className="brain-orbit orbit-three" />
      <span className="brain-satellite sat-one" />
      <span className="brain-satellite sat-two" />
      <span className="brain-satellite sat-three" />
      <div className="brain-orb-aura" />
      <div className="brain-orb">
        <div className="brain-orb-depth" />
        <div className="brain-orb-glow" />
        <div className="brain-orb-glass" />
        <div className="brain-face">
          <span className="brain-eye brain-eye-left" />
          <span className="brain-mouth" />
          <span className="brain-eye brain-eye-right" />
        </div>
      </div>
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
    try { window.localStorage.setItem(homeStorageKey, JSON.stringify(updates.slice(-6))); } catch {}
  }, [updates, homeStorageKey]);

  function handleBrainMouseMove(event: MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    const y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
    setPointer({ x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)) });
  }

  function replaceThinkingWithUpdate(text: string, scope: string, title = "Resposta organizada") {
    setUpdates((current) => [...current.filter((turn) => turn.id !== "brain-thinking-home"), { id: makeHomeId("update"), title, text, scope, ts: Date.now() }].slice(-6));
  }

  async function askHomeBrain(text: string) {
    const windowInfo = extractHourWindow(text);
    const scope = windowInfo.label;
    const previousUpdates = updates.slice(-5);
    setHoursLabel(scope);
    setCommand("");
    setSendingHome(true);
    setUpdates((current) => [...current.filter((turn) => turn.id !== "brain-thinking-home"), { id: "brain-thinking-home", title: "Brian está analisando", text: `Estou varrendo a ${scope}, cruzando contexto e preparando o espaço de informação.`, scope, ts: Date.now() }].slice(-6));
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
    <section className="brain-home-shell relative flex min-h-[calc(100vh-4.75rem)] w-full max-w-none rounded-none bg-[var(--brain-bg)] px-4 py-4 text-[var(--brain-text)] sm:rounded-[1.8rem] lg:min-h-[calc(100vh-5.5rem)] lg:px-7 lg:py-5">
      <style>{`
        .brain-home-shell{--brain-bg:radial-gradient(circle at 12% 12%,rgba(239,0,1,.035),transparent 25%),radial-gradient(circle at 86% 18%,rgba(59,130,246,.07),transparent 28%),linear-gradient(135deg,#fff 0%,#f8fbff 52%,#eef5ff 100%);--brain-text:#061225;--brain-muted:rgba(6,18,37,.62);--brain-panel:rgba(255,255,255,.72);--brain-panel-strong:rgba(255,255,255,.92);--brain-border:rgba(15,23,42,.12);--brain-chip:rgba(1,24,72,.055);--brain-input:rgba(255,255,255,.92);--brain-shadow:rgba(15,23,42,.10)}
        .dark .brain-home-shell,[data-theme="dark"] .brain-home-shell{--brain-bg:radial-gradient(circle at 13% 15%,rgba(239,0,1,.14),transparent 26%),radial-gradient(circle at 82% 18%,rgba(147,197,253,.12),transparent 30%),linear-gradient(135deg,#040711 0%,#060b17 48%,#0a1020 100%);--brain-text:#fff;--brain-muted:rgba(255,255,255,.64);--brain-panel:rgba(255,255,255,.065);--brain-panel-strong:rgba(255,255,255,.09);--brain-border:rgba(255,255,255,.12);--brain-chip:rgba(0,0,0,.22);--brain-input:rgba(0,0,0,.24);--brain-shadow:rgba(0,0,0,.34)}
        .brain-home-nav{position:absolute;left:22px;right:22px;top:18px;z-index:30;display:flex;gap:8px;overflow-x:auto;padding:4px}.brain-home-nav::-webkit-scrollbar{height:0}.brain-home-nav a{display:inline-flex;align-items:center;gap:8px;white-space:nowrap;border:1px solid var(--brain-border);border-radius:999px;background:var(--brain-panel);color:var(--brain-text);padding:9px 13px;font-size:11px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;box-shadow:0 12px 30px var(--brain-shadow);-webkit-backdrop-filter:blur(18px);backdrop-filter:blur(18px);transition:transform .18s ease,border-color .18s ease}.brain-home-nav a:hover{transform:translateY(-1px);border-color:rgba(239,0,1,.42)}
        .brain-orb-zone{min-height:calc(100vh - 190px);display:grid;place-items:center;background:transparent!important;border:0!important;box-shadow:none!important;overflow:visible}.brain-orb-wrap{position:relative;width:clamp(330px,35vw,540px);height:clamp(330px,35vw,540px);display:grid;place-items:center;isolation:isolate;perspective:900px;background:transparent!important;border:0!important;box-shadow:none!important;animation:brainRobotHover 6.4s ease-in-out infinite}.brain-orbit{position:absolute;z-index:1;border-radius:999px;background:transparent!important;box-shadow:none;border-style:solid;border-color:rgba(255,42,68,.24);border-right-color:transparent;border-bottom-color:rgba(147,197,253,.16);filter:drop-shadow(0 0 14px rgba(255,42,68,.26));animation:brainOrbit 11s linear infinite}.orbit-one{inset:21%;border-width:2px;transform:rotateX(68deg) rotateZ(-18deg);animation-duration:8s;border-top-color:rgba(255,42,68,.98);border-left-color:rgba(255,42,68,.72)}.orbit-two{inset:12%;border-width:1.5px;opacity:.62;transform:rotateX(74deg) rotateY(28deg) rotateZ(20deg);animation-duration:14s;animation-direction:reverse}.orbit-three{inset:3%;border-width:1px;opacity:.32;transform:rotateX(58deg) rotateY(-38deg) rotateZ(8deg);animation-duration:23s}.brain-satellite{position:absolute;z-index:3;width:7px;height:7px;border-radius:999px;background:#ff2a44;box-shadow:0 0 16px rgba(255,42,68,.95),0 0 36px rgba(255,42,68,.36);animation:brainSatellite 7s ease-in-out infinite}.sat-one{left:21%;top:34%}.sat-two{right:20%;top:42%;width:5px;height:5px;animation-delay:-2.1s;background:#dbeafe;box-shadow:0 0 18px rgba(219,234,254,.9)}.sat-three{left:49%;bottom:16%;width:4px;height:4px;animation-delay:-3.4s}.brain-orb-aura{position:absolute;z-index:0;width:56%;height:56%;border-radius:999px;background:radial-gradient(circle,rgba(255,42,68,.20),transparent 62%);filter:blur(26px);opacity:.50;animation:brainAura 5.4s ease-in-out infinite}.brain-orb{position:relative;z-index:4;width:44%;height:44%;border-radius:999px;overflow:hidden;background:radial-gradient(circle at 62% 18%,rgba(220,235,255,.14),transparent 22%),radial-gradient(circle at 45% 42%,#101826 0%,#050913 55%,#000 100%);border:1px solid rgba(255,255,255,.13);box-shadow:inset 14px 14px 32px rgba(255,255,255,.055),inset -30px -34px 58px rgba(0,0,0,.92),0 0 26px rgba(255,42,68,.28),0 0 78px rgba(255,42,68,.15),0 0 120px rgba(147,197,253,.12);animation:brainBotBreath 4.8s ease-in-out infinite;transform:rotateX(var(--brain-tilt-x,0deg)) rotateY(var(--brain-tilt-y,0deg));transition:transform .16s ease-out}.brain-orb-depth{position:absolute;inset:0;border-radius:inherit;background:radial-gradient(circle at 36% 62%,rgba(255,42,68,.18),transparent 36%),radial-gradient(circle at 70% 22%,rgba(150,196,255,.18),transparent 26%)}.brain-orb-glow{position:absolute;left:-8%;bottom:7%;width:42%;height:48%;border-radius:999px;border-left:4px solid rgba(255,42,68,.96);border-bottom:3px solid rgba(255,42,68,.50);filter:drop-shadow(0 0 12px rgba(255,42,68,.82));transform:rotate(-28deg)}.brain-orb-glass{position:absolute;inset:0;border-radius:inherit;background:radial-gradient(circle at 34% 34%,rgba(255,255,255,.18),transparent 9%),radial-gradient(circle at 67% 23%,rgba(230,242,255,.16),transparent 17%),linear-gradient(145deg,rgba(255,255,255,.05),transparent 45%)}
        .brain-face{position:absolute;inset:0;z-index:5;display:flex;align-items:center;justify-content:center;gap:clamp(17px,2vw,30px);transform:translate3d(var(--brain-look-x,0),calc(4px + var(--brain-look-y,0)),0);animation:brainFaceMotion 5.4s ease-in-out infinite;transition:transform .16s ease-out}.brain-eye{position:relative;width:clamp(23px,2.6vw,38px);height:clamp(18px,2.1vw,29px);filter:drop-shadow(0 0 10px rgba(255,255,255,.98));animation:brainEyeBlink 7.2s ease-in-out infinite}.brain-eye:before,.brain-eye:after{content:"";position:absolute;top:50%;width:62%;height:18%;border-radius:999px;background:rgba(255,255,255,.98)}.brain-eye:before{left:1px;transform:rotate(-54deg);transform-origin:right center}.brain-eye:after{right:1px;transform:rotate(54deg);transform-origin:left center}.brain-eye-right{transform:scaleX(-1)}.brain-mouth{display:block;width:clamp(22px,2.4vw,35px);height:clamp(5px,.55vw,8px);border-radius:999px;background:rgba(255,255,255,.94);box-shadow:0 0 12px rgba(255,255,255,.88);animation:brainMouthIdle 4.7s ease-in-out infinite}.is-active .brain-orb{box-shadow:inset 14px 14px 32px rgba(255,255,255,.065),inset -30px -34px 58px rgba(0,0,0,.92),0 0 36px rgba(255,42,68,.40),0 0 96px rgba(255,42,68,.22),0 0 138px rgba(147,197,253,.18)}.is-speaking .brain-mouth{animation:brainTalk .85s ease-in-out infinite}.is-listening .brain-orb-aura{opacity:.82;filter:blur(32px)}
        .brain-info-space{height:calc(100vh - 188px);min-height:520px;max-height:720px;border:1px solid var(--brain-border);border-radius:2rem;background:var(--brain-panel);box-shadow:0 26px 80px var(--brain-shadow);-webkit-backdrop-filter:blur(18px);backdrop-filter:blur(18px)}.brain-update-scroll{scrollbar-width:thin;scrollbar-color:rgba(239,0,1,.45) transparent}.brain-update-scroll::-webkit-scrollbar{width:7px}.brain-update-scroll::-webkit-scrollbar-thumb{border-radius:999px;background:rgba(239,0,1,.45)}.brain-submit-btn{display:inline-flex;align-items:center;justify-content:center;border-radius:999px;border:1px solid rgba(239,0,1,.42);background:rgba(239,0,1,.10);color:var(--tc-accent,#ef0001);height:40px;min-width:40px;padding:0 12px;font-size:11px;font-weight:950;text-transform:uppercase;letter-spacing:.08em;transition:transform .16s ease,background .16s ease}.brain-submit-btn:hover{transform:translateY(-1px);background:rgba(239,0,1,.16)}
        @keyframes brainRobotHover{0%,100%{transform:translate3d(0,0,0) rotate(-.3deg)}45%{transform:translate3d(0,-11px,0) rotate(.45deg)}70%{transform:translate3d(3px,-6px,0) rotate(-.15deg)}}@keyframes brainBotBreath{0%,100%{scale:1}50%{scale:1.028}}@keyframes brainAura{0%,100%{transform:scale(.9);opacity:.42}50%{transform:scale(1.18);opacity:.82}}@keyframes brainOrbit{to{rotate:360deg}}@keyframes brainSatellite{0%,100%{transform:translate3d(0,0,0) scale(.86);opacity:.55}50%{transform:translate3d(10px,-8px,0) scale(1.22);opacity:1}}@keyframes brainFaceMotion{0%,100%{margin-top:4px}50%{margin-top:0}}@keyframes brainMouthIdle{0%,88%,100%{transform:scaleY(1);opacity:.94}92%{transform:scaleY(.24);opacity:.7}}@keyframes brainTalk{0%,100%{width:clamp(18px,2vw,28px);transform:scaleY(.8)}45%{width:clamp(34px,3.2vw,50px);transform:scaleY(1.35)}70%{width:clamp(24px,2.4vw,38px);transform:scaleY(.95)}}@keyframes brainEyeBlink{0%,93%,100%{scale:1 1}96%{scale:1 .2}}@media(max-width:1024px){.brain-home-nav{position:relative;left:auto;right:auto;top:auto;margin-bottom:18px}.brain-orb-zone{min-height:330px}.brain-info-space{height:auto;min-height:420px}.brain-orb-wrap{width:clamp(260px,78vw,390px);height:clamp(260px,78vw,390px)}}@media(prefers-reduced-motion:reduce){.brain-orb-wrap,.brain-orb,.brain-orb-aura,.brain-orbit,.brain-satellite,.brain-face,.brain-mouth,.brain-eye{animation:none}}
      `}</style>

      <nav className="brain-home-nav" aria-label="Atalhos principais da home">
        {HOME_MENU_LINKS.map((item) => {
          const Icon = item.icon;
          return <a key={item.href} href={item.href}><Icon className="h-3.5 w-3.5" />{item.label}</a>;
        })}
      </nav>

      <div className="relative z-10 grid w-full flex-1 items-center gap-8 pt-16 lg:grid-cols-[minmax(360px,44vw)_minmax(520px,1fr)] lg:pt-14 xl:grid-cols-[minmax(430px,47vw)_minmax(560px,1fr)]">
        <div className="brain-orb-zone" onMouseMove={handleBrainMouseMove} onMouseLeave={() => setPointer({ x: 0, y: 0 })}>
          <BrainOrb active={brainIsAwake} listening={dictating || inputFocused} speaking={sendingHome || command.trim().length > 0} pointer={pointer} />
        </div>

        <div className="brain-info-space flex min-w-0 flex-col p-5 sm:p-7 lg:p-8">
          <div className="shrink-0">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="inline-flex rounded-full border border-[var(--brain-border)] bg-[var(--brain-chip)] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.22em] text-[var(--brain-muted)]">Brian</span>
              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--brain-border)] bg-[var(--brain-chip)] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-[var(--brain-muted)]"><FiZap /> {hoursLabel}</span>
            </div>
            <h1 className="text-5xl font-black leading-[.95] tracking-tight text-[var(--brain-text)] sm:text-6xl xl:text-7xl">{greeting}, <span className="text-[var(--tc-accent,#ef0001)]">{userName}.</span></h1>
            <p className="mt-4 max-w-2xl text-sm font-semibold leading-6 text-[var(--brain-muted)] sm:text-base">Esse é o espaço de informação do Brian. Peça atualizações das últimas 24 horas, puxe uma empresa, usuário, tela, risco ou qualquer contexto específico.</p>
          </div>

          <div className="brain-update-scroll mt-6 min-h-0 flex-1 space-y-3 overflow-auto pr-1">
            {updates.map((item) => (
              <article key={item.id} className="rounded-[1.3rem] rounded-bl-md border border-[var(--brain-border)] bg-[var(--brain-panel-strong)] px-4 py-3 text-[var(--brain-text)] shadow-[0_18px_44px_var(--brain-shadow)] backdrop-blur">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-[var(--tc-accent,#ef0001)]/16 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[var(--tc-accent,#ef0001)]"><FiZap /> {item.scope}</span>
                  <h2 className="text-sm font-black text-[var(--brain-text)]">{item.title}</h2>
                </div>
                <p className="whitespace-pre-line text-sm font-semibold leading-6 text-[var(--brain-text)] sm:text-base">{item.text}</p>
              </article>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="mt-5 flex shrink-0 items-center gap-3 rounded-full border border-[var(--tc-accent,#ef0001)]/50 bg-[var(--brain-input)] px-5 py-4 shadow-[0_0_42px_rgba(59,130,246,0.13)] backdrop-blur">
            <FiCommand className="shrink-0 text-[var(--brain-muted)]" size={22} />
            <input value={command} onChange={(event) => setCommand(event.target.value)} onFocus={() => setInputFocused(true)} onBlur={() => setInputFocused(false)} placeholder="Peça dados, fale com o Brian ou pergunte: últimas 24 horas por empresa..." className="min-w-0 flex-1 bg-transparent text-base font-semibold text-[var(--brain-text)] outline-none placeholder:text-[var(--brain-muted)]" />
            <button type="button" onClick={startHomeDictation} disabled={dictating || sendingHome} className={`hidden h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--brain-border)] bg-[var(--brain-chip)] text-[var(--brain-muted)] transition hover:border-[var(--tc-accent,#ef0001)]/55 hover:text-[var(--brain-text)] sm:inline-flex ${dictating ? "animate-pulse border-[var(--tc-accent,#ef0001)]/60 text-[var(--tc-accent,#ef0001)]" : ""}`} aria-label={dictating ? "Gravando áudio" : "Falar com o Brian"} title={dictating ? "Ouvindo..." : "Falar com o Brian"}><FiMic size={19} /></button>
            <button type="submit" disabled={!command.trim() || sendingHome} className="brain-submit-btn"><FiZap className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">Enviar</span></button>
            <button type="button" onClick={() => openAssistantChat({ command, profile, updates, hoursLabel })} className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--brain-border)] bg-[var(--brain-chip)] text-[var(--brain-muted)] transition hover:border-[var(--tc-accent,#ef0001)]/55 hover:text-[var(--brain-text)] sm:inline-flex" aria-label="Abrir conversa no chat" title="Abrir conversa no chat"><FiMessageCircle size={18} /></button>
          </form>
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
