"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { FiCommand, FiMessageCircle, FiMic } from "react-icons/fi";

import { useAuthUser } from "@/hooks/useAuthUser";

type ProfileExperience = {
  label: string;
  summary: string;
  prompts: string[];
};

type HomeCaptionTurn = {
  id: string;
  from: "user" | "assistant";
  text: string;
  ts: number;
};

type BrowserSpeechRecognitionEvent = {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal?: boolean;
      [index: number]: {
        transcript: string;
      };
    };
  };
};

type BrowserSpeechRecognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

const HOME_HISTORY_KEY_PREFIX = "brain_home_caption_history_v2";

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function resolveFirstName(user: unknown) {
  const candidate =
    (user as { name?: string | null } | null)?.name ??
    (user as { fullName?: string | null } | null)?.fullName ??
    (user as { displayName?: string | null } | null)?.displayName ??
    "Ana";

  return candidate.trim().split(" ")[0] || "Ana";
}

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

function resolveProfileExperience(roleValue: string): ProfileExperience {
  const role = normalizeText(roleValue);

  if (role.includes("leader") || role.includes("lider")) {
    return {
      label: "Líder TC",
      summary: "Eu cruzo empresas, usuários, solicitações, fluxos e pendências recentes para orientar a próxima ação.",
      prompts: ["Analisar por empresa", "Analisar por usuário", "Ver pendências do dia"],
    };
  }

  if (role.includes("support") || role.includes("suporte") || role.includes("technical")) {
    return {
      label: "Suporte Técnico",
      summary: "Eu organizo chamados, integrações, usuários bloqueados e alertas técnicos para acelerar o atendimento.",
      prompts: ["Ver incidentes", "Analisar integrações", "Checar usuários"],
    };
  }

  if (role.includes("empresa") || role.includes("company")) {
    return {
      label: "Empresa",
      summary: "Eu organizo projeto, pendências, próximas entregas e movimentações recentes da empresa.",
      prompts: ["Ver saúde do projeto", "Listar pendências", "Abrir visão geral"],
    };
  }

  return {
    label: "QA",
    summary: "Eu conecto runs, evidências, bugs e plano atual para você continuar sem procurar no menu.",
    prompts: ["Continuar meu trabalho", "Ver meus runs", "Revisar bugs"],
  };
}

function resolveSpeechRecognitionConstructor() {
  if (typeof window === "undefined") return null;
  const speechWindow = window as unknown as {
    SpeechRecognition?: new () => BrowserSpeechRecognition;
    webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
  };
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

function makeHomeId(prefix: string) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
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

function BrainOrb({ active }: { active: boolean }) {
  return (
    <div className={`brain-orb-wrap ${active ? "is-active" : ""}`} aria-hidden="true">
      <div className="brain-wave-field">
        <span className="brain-wave wave-one" />
        <span className="brain-wave wave-two" />
        <span className="brain-wave wave-three" />
        <span className="brain-wave-light light-one" />
        <span className="brain-wave-light light-two" />
      </div>
      <div className="brain-orb-aura" />
      <div className="brain-orb">
        <div className="brain-orb-liquid primary" />
        <div className="brain-orb-liquid secondary" />
        <div className="brain-orb-red-crescent" />
        <div className="brain-orb-glass" />
        <div className="brain-orb-shine" />
        <div className="brain-face">
          <span className="brain-chevron" />
          <span className="brain-dash" />
        </div>
      </div>
    </div>
  );
}

function openAssistantChat(input: {
  command: string;
  profile: ProfileExperience;
  homeConversation: HomeCaptionTurn[];
}) {
  if (typeof window === "undefined") return;

  const historySnippet = input.homeConversation
    .slice(-12)
    .map((turn) => `${turn.from === "user" ? "Usuária" : "Brain"}: ${turn.text}`)
    .join("\n");
  const prompt =
    input.command.trim() ||
    (historySnippet
      ? `Continue a conversa da Home.\n\n${historySnippet}`
      : "Continue a conversa da Home como Brain, respondendo em balões e usando o contexto da pessoa.");

  window.dispatchEvent(
    new CustomEvent("assistant:open", {
      detail: {
        source: "home",
        route: window.location.pathname || "/",
        panelMode: "side",
        agentMode: "qa",
        focusInput: true,
        initialMessage: prompt,
        context: {
          module: "home",
          screenLabel: "Brain Home",
          screenSummary: input.profile.summary,
          suggestedPrompts: input.profile.prompts,
          metadata: {
            homeConversation: input.homeConversation.slice(-12),
          },
        },
      },
    }),
  );
}

function BrainConsole({
  userName,
  profile,
  greeting,
  authUser,
}: {
  userName: string;
  profile: ProfileExperience;
  greeting: string;
  authUser: unknown;
}) {
  const [command, setCommand] = useState("");
  const [homeConversation, setHomeConversation] = useState<HomeCaptionTurn[]>([]);
  const [sendingHome, setSendingHome] = useState(false);
  const [dictating, setDictating] = useState(false);

  const homeStorageKey = useMemo(() => {
    const record = (authUser ?? {}) as Record<string, unknown>;
    const id = typeof record.id === "string" ? record.id : userName;
    return `${HOME_HISTORY_KEY_PREFIX}:${id}`;
  }, [authUser, userName]);

  const initialMessage = `${greeting}, ${userName}. Eu sou o Brain. Me diga o que você quer ver agora e eu respondo aqui por balões.`;

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(homeStorageKey);
      if (!raw) {
        setHomeConversation([{ id: makeHomeId("assistant"), from: "assistant", text: initialMessage, ts: Date.now() }]);
        return;
      }
      const parsed = JSON.parse(raw);
      const history = Array.isArray(parsed) ? parsed.slice(-16) : [];
      setHomeConversation(history.length ? history : [{ id: makeHomeId("assistant"), from: "assistant", text: initialMessage, ts: Date.now() }]);
    } catch {
      setHomeConversation([{ id: makeHomeId("assistant"), from: "assistant", text: initialMessage, ts: Date.now() }]);
    }
  }, [homeStorageKey, initialMessage]);

  useEffect(() => {
    try {
      window.localStorage.setItem(homeStorageKey, JSON.stringify(homeConversation.slice(-16)));
    } catch {
      // ignora falha de histórico local
    }
  }, [homeConversation, homeStorageKey]);

  function replaceThinkingWithAssistant(text: string) {
    setHomeConversation((current) => {
      const withoutThinking = current.filter((turn) => turn.id !== "brain-thinking-home");
      return [...withoutThinking, { id: makeHomeId("assistant"), from: "assistant", text, ts: Date.now() }].slice(-16);
    });
  }

  async function askHomeBrain(text: string) {
    const userTurn: HomeCaptionTurn = { id: makeHomeId("user"), from: "user", text, ts: Date.now() };
    const thinkingTurn: HomeCaptionTurn = {
      id: "brain-thinking-home",
      from: "assistant",
      text: "Estou conectando isso com o seu contexto...",
      ts: Date.now() + 1,
    };

    setCommand("");
    setSendingHome(true);
    setHomeConversation((current) => [...current, userTurn, thinkingTurn].slice(-16));

    try {
      const response = await fetch("/api/assistente/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          context: {
            route: "/home",
            module: "home",
            screenLabel: "Brain Home",
            screenSummary: profile.summary,
            suggestedPrompts: profile.prompts,
            actor: resolveAssistantActor(authUser),
            metadata: {
              homeConversation: [...homeConversation.slice(-8), userTurn],
            },
          },
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as { answer?: string; message?: string; error?: string };
      replaceThinkingWithAssistant(
        payload.answer || payload.message || payload.error || "Não consegui buscar detalhes agora, mas posso continuar pelo chat lateral.",
      );
    } catch {
      replaceThinkingWithAssistant("Não consegui consultar o Brain agora. Abre a conversa no chat que eu continuo por lá com este mesmo contexto.");
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
      replaceThinkingWithAssistant("Este navegador não liberou ditado por voz aqui. Você pode continuar digitando ou abrir o chat lateral.");
      return;
    }

    const recognition = new SpeechRecognitionConstructor();
    recognition.lang = "pt-BR";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      let transcript = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        transcript += event.results[index]?.[0]?.transcript ?? "";
      }
      const spoken = transcript.trim();
      if (spoken) setCommand((current) => `${current}${current.trim() ? " " : ""}${spoken}`.trim());
    };
    recognition.onerror = () => setDictating(false);
    recognition.onend = () => setDictating(false);

    setDictating(true);
    recognition.start();
  }

  return (
    <section className="relative ml-0 w-full max-w-none overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_13%_18%,rgba(239,0,1,0.14),transparent_24%),radial-gradient(circle_at_80%_20%,rgba(147,197,253,0.12),transparent_28%),linear-gradient(135deg,#050713_0%,#070b18_46%,#0a1020_100%)] p-4 text-white shadow-[0_30px_100px_rgba(0,0,0,0.34)] lg:p-6">
      <style>{`
        .brain-orb-wrap { position: relative; width: clamp(230px, 24vw, 330px); height: clamp(230px, 24vw, 330px); display: grid; place-items: center; isolation: isolate; animation: brainRobotHover 6.4s ease-in-out infinite; }
        .brain-wave-field { position: absolute; inset: 0; z-index: 1; border-radius: 999px; filter: drop-shadow(0 0 22px rgba(255,42,68,.22)); }
        .brain-wave { position: absolute; border-radius: 999px; opacity: .80; transform-origin: center; }
        .brain-wave::before { content: ""; position: absolute; inset: 0; border-radius: inherit; padding: 1px; background: conic-gradient(from 128deg, transparent 0deg, transparent 34deg, rgba(255,52,82,.13) 52deg, rgba(255,52,82,.86) 72deg, rgba(255,52,82,.18) 102deg, transparent 140deg, rgba(180,212,255,.18) 218deg, transparent 272deg, rgba(255,52,82,.46) 320deg, transparent 360deg); -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor; mask-composite: exclude; }
        .brain-wave::after { content: ""; position: absolute; width: 4px; height: 4px; border-radius: 999px; background: rgba(255,52,82,.96); box-shadow: 0 0 14px rgba(255,52,82,.96), 0 0 28px rgba(255,52,82,.40); }
        .brain-wave.wave-one { inset: 16%; animation: brainWaveOrbit 11s linear infinite, brainWavePulse 4.4s ease-in-out infinite; }
        .brain-wave.wave-one::after { right: 10%; bottom: 13%; }
        .brain-wave.wave-two { inset: 9%; opacity: .44; animation: brainWaveOrbit 18s linear infinite reverse, brainWavePulse 5.8s ease-in-out infinite reverse; }
        .brain-wave.wave-two::after { right: 7%; top: 34%; width: 3px; height: 3px; opacity: .44; }
        .brain-wave.wave-three { inset: 3%; opacity: .25; animation: brainWaveOrbit 28s linear infinite, brainWavePulse 6.2s ease-in-out infinite; }
        .brain-wave.wave-three::after { display: none; }
        .brain-wave-light { position: absolute; z-index: 2; width: 3px; height: 3px; border-radius: 999px; background: rgba(255,255,255,.58); box-shadow: 0 0 10px rgba(255,255,255,.58), 0 0 24px rgba(255,52,82,.26); opacity: .44; }
        .brain-wave-light.light-one { left: 18%; top: 18%; animation: brainLightDrift 4.2s ease-in-out infinite; }
        .brain-wave-light.light-two { right: 11%; top: 42%; animation: brainLightDrift 5.1s ease-in-out infinite reverse; }
        .brain-orb-aura { position: absolute; z-index: 2; width: 62%; height: 62%; border-radius: 999px; background: radial-gradient(circle at 33% 72%, rgba(255,40,70,.18), transparent 42%), radial-gradient(circle, rgba(94,139,213,.10), transparent 70%); filter: blur(13px); opacity: .66; animation: brainAura 5.4s ease-in-out infinite; }
        .brain-orb { position: relative; z-index: 3; width: 47%; height: 47%; border-radius: 999px; overflow: hidden; background: radial-gradient(circle at 60% 18%, rgba(198,222,247,.16), rgba(132,169,210,.06) 14%, transparent 27%), radial-gradient(circle at 42% 55%, #101a2b 0%, #07101c 55%, #02050d 100%); border: 1px solid rgba(194,215,255,.15); box-shadow: inset 14px 14px 26px rgba(222,238,255,.06), inset -28px -32px 58px rgba(0,0,0,.86), 0 0 12px rgba(255,52,82,.24), 0 0 38px rgba(255,52,82,.10), 0 0 72px rgba(150,196,255,.08); animation: brainBotBreath 4.8s ease-in-out infinite; }
        .brain-orb-liquid { position: absolute; border-radius: 999px; mix-blend-mode: screen; pointer-events: none; }
        .brain-orb-liquid.primary { left: -10%; bottom: 2%; width: 38%; height: 43%; background: radial-gradient(circle at 78% 72%, rgba(255,44,72,.18), rgba(255,44,72,.05) 44%, transparent 74%); filter: blur(13px); opacity: .38; animation: brainLiquid 7.2s ease-in-out infinite; }
        .brain-orb-liquid.secondary { right: -14%; top: -14%; width: 48%; height: 44%; background: radial-gradient(circle, rgba(190,220,255,.18), rgba(95,147,217,.06) 48%, transparent 72%); filter: blur(11px); opacity: .34; animation: brainLiquid 8.8s ease-in-out infinite reverse; }
        .brain-orb-red-crescent { position: absolute; left: 0%; bottom: 6%; width: 43%; height: 49%; border-radius: 999px; border-left: 4px solid rgba(255,52,82,.95); border-bottom: 3px solid rgba(255,52,82,.54); filter: drop-shadow(0 0 9px rgba(255,52,82,.78)) drop-shadow(0 0 20px rgba(255,52,82,.26)); transform: rotate(-25deg); opacity: .98; }
        .brain-orb-glass { position: absolute; inset: 0; border-radius: inherit; background: radial-gradient(circle at 66% 18%, rgba(236,246,255,.14), transparent 20%), radial-gradient(circle at 56% 64%, transparent 0%, rgba(255,255,255,.014) 58%, rgba(255,255,255,.055) 100%); border: 1px solid rgba(255,255,255,.06); }
        .brain-orb-shine { position: absolute; right: 13%; top: 10%; width: 34%; height: 20%; border-radius: 999px; background: linear-gradient(138deg, rgba(242,249,255,.22), rgba(190,218,255,.04) 50%, transparent 78%); transform: rotate(-30deg); opacity: .52; filter: blur(.1px); }
        .brain-face { position: absolute; inset: 0; z-index: 4; display: flex; align-items: center; justify-content: center; gap: clamp(21px, 2.7vw, 30px); transform: translate3d(0, 4px, 0); animation: brainFaceMotion 5.4s ease-in-out infinite; }
        .brain-chevron { position: relative; width: 16px; height: 13px; filter: drop-shadow(0 0 8px rgba(255,255,255,.98)); }
        .brain-chevron::before, .brain-chevron::after { content: ""; position: absolute; top: 6px; width: 11px; height: 4px; border-radius: 999px; background: rgba(255,255,255,.96); }
        .brain-chevron::before { left: 1px; transform: rotate(-54deg); transform-origin: right center; }
        .brain-chevron::after { right: 1px; transform: rotate(54deg); transform-origin: left center; }
        .brain-dash { display: block; width: 14px; height: 4px; border-radius: 999px; background: rgba(255,255,255,.94); box-shadow: 0 0 10px rgba(255,255,255,.84); animation: brainDashBlink 4.7s ease-in-out infinite; }
        .brain-orb-wrap.is-active .brain-wave.wave-one { animation-duration: 7.6s, 3.4s; }
        .brain-orb-wrap.is-active .brain-wave.wave-two { animation-duration: 11.4s, 4.4s; }
        @keyframes brainRobotHover { 0%, 100% { transform: translate3d(0,0,0) rotate(-.35deg); } 45% { transform: translate3d(0,-8px,0) rotate(.45deg); } 70% { transform: translate3d(2px,-5px,0) rotate(-.15deg); } }
        @keyframes brainBotBreath { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.018); } }
        @keyframes brainAura { 0%,100% { transform: scale(.94); opacity: .46; } 50% { transform: scale(1.10); opacity: .78; } }
        @keyframes brainLiquid { 0%,100% { transform: rotate(0deg) translate3d(0,0,0) scale(1); } 50% { transform: rotate(10deg) translate3d(4px,-5px,0) scale(1.06); } }
        @keyframes brainWaveOrbit { to { transform: rotate(360deg); } }
        @keyframes brainWavePulse { 0%,100% { opacity: .34; filter: blur(.2px) drop-shadow(0 0 14px rgba(255,52,82,.20)); } 45% { opacity: .80; filter: blur(.05px) drop-shadow(0 0 24px rgba(255,52,82,.36)); } }
        @keyframes brainLightDrift { 0%,100% { transform: translate3d(0,0,0) scale(.8); opacity: .24; } 50% { transform: translate3d(6px,-4px,0) scale(1.2); opacity: .64; } }
        @keyframes brainFaceMotion { 0%,100% { transform: translate3d(0,4px,0); } 50% { transform: translate3d(1px,1px,0); } }
        @keyframes brainDashBlink { 0%, 88%, 100% { transform: scaleY(1); opacity: .94; } 92% { transform: scaleY(.24); opacity: .70; } }
        @media (prefers-reduced-motion: reduce) { .brain-orb-wrap, .brain-orb, .brain-orb-aura, .brain-orb-liquid, .brain-wave, .brain-wave-light, .brain-face, .brain-dash { animation: none; } }
      `}</style>

      <div className="relative z-10 grid items-center gap-6 lg:grid-cols-[minmax(240px,360px)_minmax(0,1fr)]">
        <div className="flex justify-center lg:justify-start">
          <BrainOrb active={sendingHome || dictating} />
        </div>

        <div className="min-w-0">
          <div className="mb-4 inline-flex rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-white/55">
            Brain
          </div>
          <h1 className="text-3xl font-black leading-tight tracking-tight text-white sm:text-4xl xl:text-5xl">
            {greeting}, <span className="text-[var(--tc-accent,#ef0001)]">{userName}.</span>
          </h1>

          <div className="mt-5 max-h-[360px] space-y-3 overflow-auto pr-1">
            {homeConversation.map((turn) => (
              <div key={turn.id} className={`flex ${turn.from === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[88%] rounded-[1.35rem] px-4 py-3 text-sm font-semibold leading-6 shadow-[0_18px_44px_rgba(0,0,0,0.16)] sm:text-base ${
                    turn.from === "user"
                      ? "rounded-br-md bg-white text-slate-950"
                      : "rounded-bl-md border border-white/10 bg-white/[0.07] text-white/86 backdrop-blur"
                  }`}
                >
                  {turn.text}
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="mt-5 flex items-center gap-3 rounded-full border border-[var(--tc-accent,#ef0001)]/55 bg-black/20 px-5 py-4 shadow-[0_0_42px_rgba(59,130,246,0.13)] backdrop-blur">
            <FiCommand className="shrink-0 text-white/70" size={22} />
            <input
              value={command}
              onChange={(event) => setCommand(event.target.value)}
              placeholder="Fale ou escreva para o Brain..."
              className="min-w-0 flex-1 bg-transparent text-base font-semibold text-white outline-none placeholder:text-white/36"
            />
            <button
              type="button"
              onClick={startHomeDictation}
              disabled={dictating || sendingHome}
              className={`hidden h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white/58 transition hover:border-[var(--tc-accent,#ef0001)]/55 hover:text-white sm:inline-flex ${dictating ? "animate-pulse border-[var(--tc-accent,#ef0001)]/60 text-[var(--tc-accent,#ef0001)]" : ""}`}
              aria-label={dictating ? "Gravando áudio" : "Falar com o Brain"}
              title={dictating ? "Ouvindo..." : "Falar com o Brain"}
            >
              <FiMic size={19} />
            </button>
            <button type="submit" className="sr-only">
              Enviar para o Brain
            </button>
          </form>

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={() => openAssistantChat({ command, profile, homeConversation })}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-white transition hover:border-[var(--tc-accent,#ef0001)]/55"
            >
              Abrir conversa no chat
              <FiMessageCircle />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function HomeContent() {
  const { user, loading: authLoading } = useAuthUser();

  const currentUser = user as {
    permissionRole?: string | null;
    role?: string | null;
    companyRole?: string | null;
  } | null;

  const userName = resolveFirstName(user);
  const greeting = useMemo(() => resolveGreeting(), []);
  const roleValue = String(
    currentUser?.permissionRole ??
      currentUser?.role ??
      currentUser?.companyRole ??
      "usuario",
  );
  const profile = useMemo(() => resolveProfileExperience(roleValue), [roleValue]);

  if (authLoading) {
    return (
      <div className="flex min-h-[420px] w-full items-center justify-center rounded-[2rem] border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#ffffff)] text-sm font-semibold text-[var(--tc-text-muted,#64748b)]">
        Carregando Brain...
      </div>
    );
  }

  return <BrainConsole userName={userName} profile={profile} greeting={greeting} authUser={user} />;
}
