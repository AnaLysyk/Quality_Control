"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { FiClock, FiCommand, FiMic, FiZap } from "react-icons/fi";

import { useAuthUser } from "@/hooks/useAuthUser";

type ProfileExperience = {
  label: string;
  summary: string;
  prompts: string[];
};

type HomeContextPayload = {
  periodLabel?: string;
  summary?: {
    actions?: number;
    companiesUpdated?: number;
    usersInvolved?: number;
    pendingItems?: number;
    flowsWithRisk?: number;
  };
  highlights?: Array<{
    title?: string;
    description?: string;
    type?: string;
  }>;
};

type BrowserSpeechRecognitionEvent = {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal?: boolean;
      [index: number]: { transcript: string };
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

function normalizeText(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
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
      summary: "Eu cruzo empresas, usuários, solicitações, fluxos e pendências recentes para explicar a próxima ação.",
      prompts: ["últimos defeitos criados", "últimos planos de teste", "pendências por empresa"],
    };
  }

  if (role.includes("support") || role.includes("suporte") || role.includes("technical")) {
    return {
      label: "Suporte Técnico",
      summary: "Eu organizo chamados, integrações, usuários bloqueados e alertas técnicos para acelerar o atendimento.",
      prompts: ["chamados recentes", "integrações com risco", "usuários bloqueados"],
    };
  }

  if (role.includes("empresa") || role.includes("company")) {
    return {
      label: "Empresa",
      summary: "Eu organizo projeto, pendências, próximas entregas e movimentações recentes da empresa.",
      prompts: ["saúde do projeto", "pendências recentes", "atualizações das últimas 24h"],
    };
  }

  return {
    label: "QA",
    summary: "Eu conecto runs, evidências, bugs e plano atual para você continuar sem procurar no menu.",
    prompts: ["últimos defeitos criados", "últimos casos de teste", "últimos planos de teste"],
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

function extractHourWindow(command: string) {
  const normalized = normalizeText(command);
  const match = normalized.match(/(?:ultimas?|em|por)\s*(\d{1,2})\s*h(?:oras?)?/i) ?? normalized.match(/(\d{1,2})\s*h(?:oras?)?/i);
  const hours = match?.[1] ? Math.max(1, Math.min(72, Number(match[1]))) : 24;
  return {
    hours,
    label: hours === 1 ? "última 1 hora" : `últimas ${hours} horas`,
    apiRange: hours <= 24 ? "24h" : hours <= 168 ? "7d" : "30d",
  };
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

function buildWelcomeMessage(input: {
  greeting: string;
  userName: string;
  profile: ProfileExperience;
  payload?: HomeContextPayload | null;
}) {
  const summary = input.payload?.summary;
  const period = input.payload?.periodLabel ?? "últimas 24 horas";
  const parts = [
    `${input.greeting}, ${input.userName}. Eu sou o Brain e já atualizei as ${period}.`,
  ];

  if (summary) {
    parts.push(
      `Encontrei ${summary.actions ?? 0} ações, ${summary.companiesUpdated ?? 0} empresas com atualização, ${summary.usersInvolved ?? 0} usuários envolvidos, ${summary.pendingItems ?? 0} pendências e ${summary.flowsWithRisk ?? 0} fluxos com risco.`,
    );
  }

  parts.push(
    `Você pode me perguntar sobre ${input.profile.prompts.join(", ")}, usuários, empresas, permissões ou qualquer parte do sistema. O que você quer ver agora?`,
  );

  return parts.join(" ");
}

function BrainOrb({ active }: { active: boolean }) {
  return <div className={`brain-orb-wrap ${active ? "is-active" : ""}`} aria-hidden="true" />;
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
  const [answer, setAnswer] = useState("");
  const [typedAnswer, setTypedAnswer] = useState("");
  const [sendingHome, setSendingHome] = useState(false);
  const [dictating, setDictating] = useState(false);
  const [hoursLabel, setHoursLabel] = useState("últimas 24 horas");

  useEffect(() => {
    let active = true;

    async function loadInitialContext() {
      try {
        const response = await fetch("/api/brain/home-context?range=24h", { cache: "no-store" });
        const payload = response.ok ? ((await response.json().catch(() => null)) as HomeContextPayload | null) : null;
        if (active) setAnswer(buildWelcomeMessage({ greeting, userName, profile, payload }));
      } catch {
        if (active) setAnswer(buildWelcomeMessage({ greeting, userName, profile }));
      }
    }

    void loadInitialContext();
    return () => {
      active = false;
    };
  }, [greeting, profile, userName]);

  useEffect(() => {
    setTypedAnswer("");
    if (!answer) return;

    let index = 0;
    const timer = window.setInterval(() => {
      index += 2;
      setTypedAnswer(answer.slice(0, index));
      if (index >= answer.length) window.clearInterval(timer);
    }, 18);

    return () => window.clearInterval(timer);
  }, [answer]);

  async function askHomeBrain(text: string) {
    const windowInfo = extractHourWindow(text);
    const scope = windowInfo.label;
    setHoursLabel(scope);
    setCommand("");
    setSendingHome(true);
    setAnswer(`Estou analisando ${scope}. Vou organizar a resposta para você.`);

    try {
      const response = await fetch("/api/assistente/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `Responda na Home do Brain de forma curta, útil e organizada. Janela: ${scope}. Pedido: ${text}`,
          context: {
            route: "/home",
            module: "home",
            screenLabel: "Brain Home",
            screenSummary: profile.summary,
            suggestedPrompts: profile.prompts,
            actor: resolveAssistantActor(authUser),
            metadata: {
              requestedWindow: scope,
              apiRange: windowInfo.apiRange,
            },
          },
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as { answer?: string; message?: string; error?: string };
      setAnswer(payload.answer || payload.message || payload.error || "Não encontrei detalhes suficientes agora. Me diga uma empresa, usuário, tela, defeito, plano ou período específico.");
    } catch {
      setAnswer("Não consegui consultar o Brain agora. Tente novamente com uma pergunta mais específica.");
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
      setAnswer("Este navegador não liberou ditado por voz aqui. Você pode continuar digitando.");
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
    <section className="brain-home-shell relative ml-0 flex min-h-[calc(100vh-4.75rem)] w-full max-w-none overflow-hidden rounded-none border border-[var(--brain-border)] bg-[var(--brain-bg)] p-4 text-[var(--brain-text)] shadow-[0_30px_100px_var(--brain-shadow)] sm:rounded-[2rem] lg:min-h-[calc(100vh-5.5rem)] lg:p-6">
      <div className="relative z-10 grid min-h-full w-full flex-1 items-stretch gap-6 lg:grid-cols-[minmax(220px,28vw)_minmax(0,1fr)]">
        <div className="brain-home-orb-panel flex min-h-[240px] items-center justify-center rounded-[1.8rem] border border-[var(--brain-border)] bg-[var(--brain-chip)] p-4 lg:min-h-full">
          <BrainOrb active={sendingHome || dictating} />
        </div>

        <div className="brain-home-response-panel flex min-h-full min-w-0 flex-col rounded-[1.8rem] border border-[var(--brain-border)] bg-[var(--brain-panel)] p-4 backdrop-blur lg:p-6">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="inline-flex rounded-full border border-[var(--brain-border)] bg-[var(--brain-chip)] px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-[var(--brain-muted)]">
              Brain
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--brain-border)] bg-[var(--brain-chip)] px-3 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-[var(--brain-muted)]">
              <FiClock /> {hoursLabel}
            </span>
          </div>

          <h1 className="text-3xl font-black leading-tight tracking-tight text-[var(--brain-text)] sm:text-4xl xl:text-5xl">
            {greeting}, <span className="text-[var(--tc-accent,#ef0001)]">{userName}.</span>
          </h1>

          <article className="brain-home-answer-card mt-5 flex min-h-[240px] flex-1 flex-col justify-center rounded-[1.35rem] border border-[var(--brain-border)] bg-[var(--brain-panel-strong)] px-5 py-5 text-[var(--brain-text)] shadow-[0_18px_44px_var(--brain-shadow)] backdrop-blur">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--tc-accent,#ef0001)]/16 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[var(--tc-accent,#ef0001)]">
                <FiZap /> resposta do Brain
              </span>
            </div>
            <p className="brain-home-typed-text whitespace-pre-line text-base font-semibold leading-7 text-[var(--brain-text)] sm:text-lg">
              {typedAnswer}
              <span className="brain-home-cursor" aria-hidden="true">|</span>
            </p>
          </article>

          <form onSubmit={handleSubmit} className="mt-5 flex items-center gap-3 rounded-full border border-[var(--tc-accent,#ef0001)]/55 bg-[var(--brain-input)] px-5 py-4 shadow-[0_0_42px_rgba(59,130,246,0.13)] backdrop-blur">
            <FiCommand className="shrink-0 text-[var(--brain-muted)]" size={22} />
            <input
              value={command}
              onChange={(event) => setCommand(event.target.value)}
              placeholder="Pergunte ao Brain: últimos defeitos, planos, casos, usuários, empresas..."
              className="min-w-0 flex-1 bg-transparent text-base font-semibold text-[var(--brain-text)] outline-none placeholder:text-[var(--brain-muted)]"
            />
            <button
              type="button"
              onClick={startHomeDictation}
              disabled={dictating || sendingHome}
              className={`hidden h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--brain-border)] bg-[var(--brain-chip)] text-[var(--brain-muted)] transition hover:border-[var(--tc-accent,#ef0001)]/55 hover:text-[var(--brain-text)] sm:inline-flex ${dictating ? "animate-pulse border-[var(--tc-accent,#ef0001)]/60 text-[var(--tc-accent,#ef0001)]" : ""}`}
              aria-label={dictating ? "Gravando áudio" : "Falar com o Brain"}
              title={dictating ? "Ouvindo..." : "Falar com o Brain"}
            >
              <FiMic size={19} />
            </button>
            <button type="submit" className="sr-only">
              Enviar para o Brain
            </button>
          </form>
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
      <div className="flex min-h-[calc(100vh-5rem)] w-full items-center justify-center rounded-[2rem] border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#ffffff)] text-sm font-semibold text-[var(--tc-text-muted,#64748b)]">
        Carregando Brain...
      </div>
    );
  }

  return <BrainConsole userName={userName} profile={profile} greeting={greeting} authUser={user} />;
}
