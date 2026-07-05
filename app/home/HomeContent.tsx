"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import {
  FiAlertTriangle,
  FiArrowRight,
  FiBarChart2,
  FiBriefcase,
  FiCheckSquare,
  FiClock,
  FiCommand,
  FiCpu,
  FiGitBranch,
  FiMessageCircle,
  FiMic,
  FiMonitor,
  FiUser,
  FiUsers,
} from "react-icons/fi";

import { useAuthUser } from "@/hooks/useAuthUser";
import { useNavigationItems } from "@/hooks/navigation/useNavigationItems";

type ProfileExperience = {
  label: string;
  summary: string;
  prompts: string[];
};

type HomeNavItem = {
  label: string;
  href?: string;
};

type HomeNavModule = {
  id?: string;
  label: string;
  href?: string;
  items?: HomeNavItem[];
};

type HomeEntityOption = {
  id: string;
  label: string;
  description?: string | null;
  href?: string;
  value?: string;
};

type RangeKey = "24h" | "7d" | "30d";
type BrainMode = "company" | "user" | "screen" | "flow" | "pending" | "continue";

type HomeContext = {
  greeting: string;
  userName: string;
  profileLabel: string;
  range: RangeKey;
  periodLabel: string;
  typedMessages: string[];
  summary: {
    actions: number;
    companiesUpdated: number;
    usersInvolved: number;
    pendingItems: number;
    flowsWithRisk: number;
  };
  companies: HomeEntityOption[];
  users: HomeEntityOption[];
  highlights: Array<{
    type: string;
    title: string;
    description: string;
    href?: string;
  }>;
  routes?: {
    adminOverview?: string;
  };
};

type QuickModule = {
  id: string;
  label: string;
  href: string;
};

const FILTERS: Array<{ mode: BrainMode; label: string; icon: typeof FiBriefcase }> = [
  { mode: "company", label: "Por empresa", icon: FiBriefcase },
  { mode: "user", label: "Por usuário", icon: FiUser },
  { mode: "screen", label: "Por tela", icon: FiMonitor },
  { mode: "flow", label: "Por fluxo", icon: FiGitBranch },
  { mode: "pending", label: "Pendências do dia", icon: FiCheckSquare },
  { mode: "continue", label: "Continuar de onde parei", icon: FiClock },
];

const RANGE_OPTIONS: Array<{ value: RangeKey; label: string }> = [
  { value: "24h", label: "24h" },
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" },
];

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
      summary: "O Brain cruza empresas, usuários, solicitações, fluxos e pendências recentes para orientar a próxima ação.",
      prompts: ["Analisar por empresa", "Analisar por usuário", "Ver pendências do dia"],
    };
  }

  if (role.includes("support") || role.includes("suporte") || role.includes("technical")) {
    return {
      label: "Suporte Técnico",
      summary: "O Brain organiza chamados, integrações, usuários bloqueados e alertas técnicos para acelerar o atendimento.",
      prompts: ["Ver incidentes", "Analisar integrações", "Checar usuários"],
    };
  }

  if (role.includes("empresa") || role.includes("company")) {
    return {
      label: "Empresa",
      summary: "O Brain organiza projeto, pendências, próximas entregas e movimentações recentes da empresa.",
      prompts: ["Ver saúde do projeto", "Listar pendências", "Abrir visão geral"],
    };
  }

  return {
    label: "QA",
    summary: "O Brain conecta runs, evidências, bugs e plano atual para você continuar sem procurar no menu.",
    prompts: ["Continuar meu trabalho", "Ver meus runs", "Revisar bugs"],
  };
}

function useTyping(message: string) {
  const [typed, setTyped] = useState("");

  useEffect(() => {
    setTyped("");
    let cursor = 0;
    const typing = window.setInterval(() => {
      cursor += 1;
      setTyped(message.slice(0, cursor));
      if (cursor >= message.length) window.clearInterval(typing);
    }, 15);

    return () => window.clearInterval(typing);
  }, [message]);

  return typed;
}

function resolveQuickModules(modules: HomeNavModule[]): QuickModule[] {
  const preferredOrder = ["overview", "companies", "management", "requests", "agenda", "chat", "brain", "quality", "automation", "support"];

  return modules
    .filter((module) => module.id !== "home")
    .filter((module) => module.id !== "operations")
    .map((module) => {
      const items = (module.items ?? []).filter((item) => Boolean(item.href));
      const href = module.href ?? items[0]?.href ?? "";
      return {
        id: String(module.id ?? module.label),
        label: module.label,
        href,
      };
    })
    .filter((module) => Boolean(module.href))
    .sort((a, b) => {
      const indexA = preferredOrder.indexOf(a.id);
      const indexB = preferredOrder.indexOf(b.id);
      return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
    })
    .slice(0, 7);
}

function fallbackContext(input: { greeting: string; userName: string; profile: ProfileExperience; range: RangeKey }): HomeContext {
  return {
    greeting: input.greeting,
    userName: input.userName,
    profileLabel: input.profile.label,
    range: input.range,
    periodLabel: input.range === "24h" ? "últimas 24 horas" : input.range === "7d" ? "últimos 7 dias" : "últimos 30 dias",
    typedMessages: [
      `${input.greeting}, ${input.userName}. Eu sou o Brain. Seu contexto de ${input.profile.label} já está organizado.`,
      "Você gostaria de começar por empresa, por usuário, por tela ou por fluxo?",
    ],
    summary: {
      actions: 0,
      companiesUpdated: 0,
      usersInvolved: 0,
      pendingItems: 0,
      flowsWithRisk: 0,
    },
    companies: [],
    users: [],
    highlights: [],
    routes: { adminOverview: "/admin/visao-geral" },
  };
}

function confirmationFor(mode: BrainMode, userName: string) {
  if (mode === "company") {
    return `Claro, ${userName}. Digite ou selecione a empresa para eu te direcionar para a visão geral dessa empresa.`;
  }
  if (mode === "user") {
    return `Claro, ${userName}. Digite ou selecione o usuário para eu te mostrar a visão geral e as últimas atividades dele.`;
  }
  if (mode === "screen") return "Certo. Vou organizar o contexto pelas telas relacionadas às últimas interações.";
  if (mode === "flow") return "Ok. Vou focar nos fluxos atualizados e nos movimentos recentes.";
  if (mode === "pending") return "Entendi. Vou priorizar as pendências do período selecionado.";
  return "Perfeito. Vou continuar a partir do último contexto disponível.";
}

function modeLabel(mode: BrainMode | null) {
  return FILTERS.find((item) => item.mode === mode)?.label ?? "Contexto geral";
}

function BrainOrb({ active }: { active: boolean }) {
  return (
    <div className="brain-orb-wrap" aria-hidden="true">
      <div className="brain-orb-aura" />
      <div className={`brain-orb ${active ? "is-active" : ""}`}>
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
      <div className="brain-ring one" />
      <div className="brain-ring two" />
      <div className="brain-ring-dot" />
    </div>
  );
}

function StatCard({ icon: Icon, value, label }: { icon: typeof FiBarChart2; value: number; label: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3 border-white/10 px-3 py-3 first:pl-0 md:border-r md:last:border-r-0">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[var(--tc-accent,#ef0001)]/55 bg-[var(--tc-accent,#ef0001)]/8 text-[var(--tc-accent,#ef0001)] shadow-[0_0_22px_rgba(239,0,1,0.15)]">
        <Icon size={17} />
      </div>
      <div className="min-w-0">
        <p className="text-xl font-black leading-none text-white">{value}</p>
        <p className="mt-1 text-[11px] font-semibold leading-tight text-white/64">{label}</p>
      </div>
    </div>
  );
}

function openAssistantChat(input: {
  command: string;
  companySlug?: string | null;
  selectedMode: BrainMode | null;
  selectedEntity?: HomeEntityOption | null;
  profile: ProfileExperience;
  homeContext: HomeContext;
}) {
  if (typeof window === "undefined") return;

  const prompt =
    input.command.trim() ||
    `Continue a análise da Home usando ${modeLabel(input.selectedMode)} em ${input.homeContext.periodLabel}.`;

  window.dispatchEvent(
    new CustomEvent("assistant:open", {
      detail: {
        source: "home",
        route: window.location.pathname || "/",
        panelMode: "compact",
        agentMode: "qa",
        focusInput: true,
        initialMessage: prompt,
        context: {
          module: "home",
          screenLabel: "Brain Command Center",
          screenSummary: input.profile.summary,
          suggestedPrompts: input.profile.prompts,
          metadata: {
            range: input.homeContext.range,
            periodLabel: input.homeContext.periodLabel,
            selectedMode: input.selectedMode,
            selectedEntity: input.selectedEntity ?? null,
            companySlug: input.companySlug ?? null,
            summary: input.homeContext.summary,
          },
        },
      },
    }),
  );
}

function ContextSelector({
  mode,
  companies,
  users,
  onSelect,
}: {
  mode: BrainMode | null;
  companies: HomeEntityOption[];
  users: HomeEntityOption[];
  onSelect: (option: HomeEntityOption) => void;
}) {
  const options = mode === "company" ? companies : mode === "user" ? users : [];
  if (mode !== "company" && mode !== "user") return null;

  return (
    <div className="mt-3 rounded-3xl border border-white/10 bg-black/18 p-3 shadow-inner shadow-black/20">
      <p className="px-2 pb-2 text-[11px] font-black uppercase tracking-[0.22em] text-white/42">
        {mode === "company" ? "Selecione a empresa" : "Selecione o usuário"}
      </p>
      {options.length > 0 ? (
        <div className="grid max-h-[118px] gap-2 overflow-auto pr-1 md:grid-cols-2">
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => onSelect(option)}
              className="group flex min-w-0 items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.045] px-3 py-2.5 text-left transition hover:border-[var(--tc-accent,#ef0001)]/55 hover:bg-[var(--tc-accent,#ef0001)]/8"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-black text-white">{option.label}</span>
                {option.description ? <span className="block truncate text-xs font-semibold text-white/45">{option.description}</span> : null}
              </span>
              <FiArrowRight className="shrink-0 text-white/35 transition group-hover:translate-x-1 group-hover:text-[var(--tc-accent,#ef0001)]" />
            </button>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-white/10 px-4 py-3 text-sm font-semibold text-white/55">
          Nenhuma opção liberada para este perfil nesse contexto.
        </div>
      )}
    </div>
  );
}

function BrainConsole({
  userName,
  profile,
  greeting,
  quickModules,
  companySlug,
}: {
  userName: string;
  profile: ProfileExperience;
  greeting: string;
  quickModules: QuickModule[];
  companySlug?: string | null;
}) {
  const [range, setRange] = useState<RangeKey>("24h");
  const [homeContext, setHomeContext] = useState<HomeContext>(() => fallbackContext({ greeting, userName, profile, range: "24h" }));
  const [loadingContext, setLoadingContext] = useState(true);
  const [selectedMode, setSelectedMode] = useState<BrainMode | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<HomeEntityOption | null>(null);
  const [command, setCommand] = useState("");
  const [confirmation, setConfirmation] = useState("");

  useEffect(() => {
    let active = true;
    setLoadingContext(true);
    fetch(`/api/brain/home-context?range=${range}`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: HomeContext | null) => {
        if (!active) return;
        setHomeContext(data ?? fallbackContext({ greeting, userName, profile, range }));
      })
      .catch(() => {
        if (active) setHomeContext(fallbackContext({ greeting, userName, profile, range }));
      })
      .finally(() => {
        if (active) setLoadingContext(false);
      });

    return () => {
      active = false;
    };
  }, [greeting, profile, range, userName]);

  const narrative = useMemo(() => homeContext.typedMessages.join(" "), [homeContext.typedMessages]);
  const typed = useTyping(narrative);
  const isThinking = loadingContext || typed.length < narrative.length;

  function handleFilter(mode: BrainMode) {
    setSelectedMode(mode);
    setSelectedEntity(null);
    setConfirmation(confirmationFor(mode, homeContext.userName || userName));
  }

  function handleEntitySelect(option: HomeEntityOption) {
    setSelectedEntity(option);
    setConfirmation(
      selectedMode === "company"
        ? `Perfeito, ${homeContext.userName}. Preparei a visão geral da empresa ${option.label}.`
        : `Perfeito, ${homeContext.userName}. Preparei a visão geral do usuário ${option.label}.`,
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = command.trim();
    if (!trimmed) return;
    setConfirmation("Entendi o contexto digitado. Posso continuar pelo chat flutuante com essa mensagem completa.");
  }

  function goToOverview() {
    const href = selectedEntity?.href ?? homeContext.routes?.adminOverview ?? "/admin/visao-geral";
    window.location.href = href;
  }

  return (
    <section className="relative ml-0 w-full max-w-none overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_18%_18%,rgba(239,0,1,0.10),transparent_24%),radial-gradient(circle_at_75%_18%,rgba(37,99,235,0.12),transparent_28%),linear-gradient(135deg,#070b16_0%,#080f20_48%,#0b1428_100%)] p-4 text-white shadow-[0_30px_100px_rgba(0,0,0,0.34)] lg:p-5 xl:p-6">
      <style>{`
        .brain-orb-wrap { position: relative; width: clamp(205px, 20vw, 270px); height: clamp(205px, 20vw, 270px); display: grid; place-items: center; isolation: isolate; }
        .brain-orb-aura { position: absolute; width: 78%; height: 78%; border-radius: 999px; background: radial-gradient(circle, rgba(239,0,1,.20), transparent 62%); filter: blur(10px); opacity: .76; animation: brainAura 5.6s ease-in-out infinite; }
        .brain-orb { position: relative; z-index: 2; width: 62%; height: 62%; border-radius: 999px; overflow: hidden; background: radial-gradient(circle at 62% 22%, rgba(255,255,255,.36), transparent 18%), radial-gradient(circle at 44% 48%, #0d1b2f 0%, #07111f 52%, #030710 100%); box-shadow: inset 24px 20px 38px rgba(255,255,255,.11), inset -28px -32px 64px rgba(0,0,0,.74), 0 0 22px rgba(239,0,1,.38), 0 0 58px rgba(239,0,1,.14), 0 0 88px rgba(96,165,250,.08); animation: brainFloat 6s ease-in-out infinite; }
        .brain-orb-liquid { position: absolute; border-radius: 44%; filter: blur(16px); opacity: .72; mix-blend-mode: screen; }
        .brain-orb-liquid.primary { inset: 18% 43% -18% -24%; background: radial-gradient(circle, rgba(239,0,1,.98), rgba(239,0,1,.42) 44%, transparent 70%); animation: brainLiquid 7.5s ease-in-out infinite; }
        .brain-orb-liquid.secondary { inset: -24% -30% 22% 34%; background: radial-gradient(circle, rgba(147,197,253,.45), rgba(37,99,235,.20) 46%, transparent 72%); animation: brainLiquid 9s ease-in-out infinite reverse; }
        .brain-orb-red-crescent { position: absolute; left: -8%; bottom: -5%; width: 66%; height: 80%; border-radius: 999px; border-left: 12px solid rgba(255,50,74,.98); border-bottom: 9px solid rgba(255,50,74,.80); filter: blur(.2px) drop-shadow(0 0 18px rgba(239,0,1,.72)); transform: rotate(-18deg); opacity: .94; }
        .brain-orb-glass { position: absolute; inset: 0; border-radius: inherit; background: radial-gradient(circle at 64% 22%, rgba(255,255,255,.30), transparent 24%), radial-gradient(circle at 54% 64%, transparent 0%, rgba(255,255,255,.035) 58%, rgba(255,255,255,.10) 100%); border: 1px solid rgba(255,255,255,.10); }
        .brain-orb-shine { position: absolute; right: 13%; top: 10%; width: 46%; height: 28%; border-radius: 999px; background: linear-gradient(138deg, rgba(255,255,255,.42), rgba(255,255,255,.08) 48%, transparent 76%); transform: rotate(-30deg); opacity: .76; }
        .brain-face { position: absolute; inset: 0; z-index: 4; display: flex; align-items: center; justify-content: center; gap: clamp(22px, 3vw, 34px); transform: translateY(5px); }
        .brain-chevron { position: relative; width: 28px; height: 22px; filter: drop-shadow(0 0 10px rgba(255,255,255,.88)); }
        .brain-chevron::before, .brain-chevron::after { content: ""; position: absolute; top: 8px; width: 18px; height: 7px; border-radius: 999px; background: rgba(255,255,255,.96); }
        .brain-chevron::before { left: 1px; transform: rotate(-54deg); }
        .brain-chevron::after { right: 1px; transform: rotate(54deg); }
        .brain-dash { display: block; width: 26px; height: 7px; border-radius: 999px; background: rgba(255,255,255,.96); box-shadow: 0 0 13px rgba(255,255,255,.86); }
        .brain-ring { position: absolute; z-index: 1; border-radius: 999px; border: 1px solid rgba(239,0,1,.23); }
        .brain-ring.one { width: 80%; height: 80%; animation: brainSpin 15s linear infinite; }
        .brain-ring.two { width: 94%; height: 94%; border-color: rgba(255,255,255,.09); border-left-color: rgba(239,0,1,.20); animation: brainSpin 22s linear infinite reverse; }
        .brain-ring-dot { position: absolute; z-index: 3; right: 12%; bottom: 24%; width: 8px; height: 8px; border-radius: 999px; background: var(--tc-accent,#ef0001); box-shadow: 0 0 16px rgba(239,0,1,.92); animation: brainDot 3.6s ease-in-out infinite; }
        .brain-orb.is-active { box-shadow: inset 24px 20px 38px rgba(255,255,255,.12), inset -28px -32px 64px rgba(0,0,0,.74), 0 0 34px rgba(239,0,1,.58), 0 0 74px rgba(239,0,1,.20), 0 0 106px rgba(96,165,250,.12); }
        .brain-orb.is-active .brain-orb-liquid.primary { opacity: .90; }
        @keyframes brainFloat { 0%,100% { transform: translate3d(0,0,0) scale(1); } 50% { transform: translate3d(0,-10px,0) scale(1.025); } }
        @keyframes brainAura { 0%,100% { transform: scale(.96); opacity: .58; } 50% { transform: scale(1.08); opacity: .88; } }
        @keyframes brainLiquid { 0%,100% { transform: rotate(0deg) translate3d(0,0,0) scale(1); } 50% { transform: rotate(14deg) translate3d(8px,-10px,0) scale(1.14); } }
        @keyframes brainSpin { to { transform: rotate(360deg); } }
        @keyframes brainDot { 0%,100% { transform: scale(1); opacity: .76; } 50% { transform: scale(1.55); opacity: 1; } }
        @media (prefers-reduced-motion: reduce) { .brain-orb, .brain-orb-aura, .brain-orb-liquid, .brain-ring, .brain-ring-dot { animation: none; } }
      `}</style>

      <div className="pointer-events-none absolute inset-0 rounded-[2rem] border border-white/[0.03]" />

      <div className="relative z-10 flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-3 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-white/58 sm:text-xs sm:tracking-[0.22em]">
            <FiCpu className="text-[var(--tc-accent,#ef0001)]" />
            Brain Command Center
          </div>
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/18 p-1">
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setRange(option.value)}
                className={`rounded-full px-3 py-1.5 text-xs font-black transition ${
                  range === option.value ? "bg-[var(--tc-accent,#ef0001)] text-white" : "text-white/48 hover:text-white"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(190px,245px)_minmax(0,1fr)] xl:grid-cols-[minmax(210px,260px)_minmax(0,1fr)] xl:items-start">
          <div className="hidden justify-start pt-2 lg:flex">
            <BrainOrb active={isThinking || Boolean(confirmation)} />
          </div>

          <div className="min-w-0 max-w-[980px]">
            <h1 className="text-3xl font-black leading-tight tracking-tight text-white sm:text-4xl xl:text-5xl">
              {homeContext.greeting || greeting}, <span className="text-[var(--tc-accent,#ef0001)]">{homeContext.userName || userName}.</span>
            </h1>
            <p className="mt-4 min-h-[92px] max-w-4xl text-xl font-semibold leading-relaxed text-white/78 sm:text-2xl xl:text-[1.55rem]">
              {typed}
              <span className="ml-1 inline-block h-7 w-1 translate-y-1 bg-white/84 animate-pulse" />
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm font-semibold text-white/50">
              <span className="inline-flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[var(--tc-accent,#ef0001)] shadow-[0_0_18px_rgba(239,0,1,0.8)]" />
                Brain analisando contexto
              </span>
              <span className="h-4 w-px bg-white/10" />
              <span>{isThinking ? "digitando..." : "contexto pronto"}</span>
            </div>

            <form onSubmit={handleSubmit} className="mt-5 flex items-center gap-3 rounded-full border border-[var(--tc-accent,#ef0001)]/55 bg-black/20 px-5 py-4 shadow-[0_0_42px_rgba(59,130,246,0.13)] backdrop-blur">
              <FiCommand className="shrink-0 text-white/70" size={22} />
              <input
                value={command}
                onChange={(event) => setCommand(event.target.value)}
                placeholder="Pergunte ao Brain ou escolha uma ação..."
                className="min-w-0 flex-1 bg-transparent text-base font-semibold text-white outline-none placeholder:text-white/36"
              />
              <FiMic className="hidden shrink-0 text-white/48 sm:block" size={21} />
              <button type="submit" className="sr-only">
                Confirmar contexto
              </button>
            </form>

            <div className="mt-4 flex flex-wrap justify-start gap-3">
              {FILTERS.map((item) => {
                const Icon = item.icon;
                const active = selectedMode === item.mode;
                return (
                  <button
                    key={item.mode}
                    type="button"
                    onClick={() => handleFilter(item.mode)}
                    className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-black transition ${
                      active
                        ? "border-[var(--tc-accent,#ef0001)] bg-[var(--tc-accent,#ef0001)]/14 text-white shadow-[0_0_34px_rgba(239,0,1,0.20)]"
                        : "border-white/10 bg-white/[0.055] text-white/76 hover:border-white/22 hover:text-white"
                    }`}
                  >
                    <Icon size={17} />
                    {item.label}
                  </button>
                );
              })}
            </div>

            {confirmation ? (
              <div className="mt-4 rounded-[1.6rem] border border-[var(--tc-accent,#ef0001)]/35 bg-[var(--tc-accent,#ef0001)]/8 px-5 py-4 text-sm font-semibold leading-relaxed text-white/82 shadow-[0_0_34px_rgba(239,0,1,0.12)]">
                {confirmation}
                <ContextSelector mode={selectedMode} companies={homeContext.companies} users={homeContext.users} onSelect={handleEntitySelect} />
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedEntity ? (
                    <button
                      type="button"
                      onClick={goToOverview}
                      className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-slate-950 transition hover:-translate-y-0.5"
                    >
                      Abrir visão geral
                      <FiArrowRight />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() =>
                      openAssistantChat({
                        command,
                        companySlug,
                        selectedMode,
                        selectedEntity,
                        profile,
                        homeContext,
                      })
                    }
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-white transition hover:border-[var(--tc-accent,#ef0001)]/55"
                  >
                    Continuar no chat
                    <FiMessageCircle />
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {quickModules.length ? (
          <div className="flex flex-wrap justify-start gap-2 border-t border-white/8 pt-2">
            {quickModules.slice(0, 6).map((module) => (
              <a
                key={module.id}
                href={module.href}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-black text-white/64 transition hover:border-[var(--tc-accent,#ef0001)]/45 hover:text-white"
              >
                {module.label}
                <FiArrowRight className="text-white/30" />
              </a>
            ))}
          </div>
        ) : null}

        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
          <section className="rounded-[1.7rem] border border-white/10 bg-white/[0.04] px-4 py-4 backdrop-blur">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-white">Radar do Brain</h2>
                <span className="rounded-full bg-[var(--tc-accent,#ef0001)]/18 px-2 py-1 text-[10px] font-black text-[var(--tc-accent,#ef0001)]">
                  {homeContext.periodLabel}
                </span>
              </div>
              <a href={homeContext.routes?.adminOverview ?? "/admin/visao-geral"} className="hidden items-center gap-2 text-xs font-bold text-white/54 hover:text-white sm:inline-flex">
                Ver detalhes
                <FiArrowRight />
              </a>
            </div>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
              <StatCard icon={FiBarChart2} value={homeContext.summary.actions} label="ações registradas" />
              <StatCard icon={FiBriefcase} value={homeContext.summary.companiesUpdated} label="empresas com atualização" />
              <StatCard icon={FiUsers} value={homeContext.summary.usersInvolved} label="usuários envolvidos" />
              <StatCard icon={FiCheckSquare} value={homeContext.summary.pendingItems} label="pendências abertas" />
              <StatCard icon={FiAlertTriangle} value={homeContext.summary.flowsWithRisk} label="fluxos com risco" />
            </div>
          </section>

          <section className="rounded-[1.7rem] border border-white/10 bg-white/[0.035] px-4 py-4 backdrop-blur">
            <h2 className="mb-3 text-base font-black text-white">Destaques do contexto</h2>
            <div className="grid gap-3">
              {(homeContext.highlights.length > 0 ? homeContext.highlights : [
                { type: "flow", title: "Fluxos atualizados", description: "Sem mudanças recentes no período", href: "/operacoes/dashboard" },
                { type: "company", title: "Empresas", description: "Selecione uma empresa para detalhar", href: "/admin/visao-geral" },
                { type: "alert", title: "Pendências", description: "Nenhuma pendência crítica encontrada", href: "/admin/visao-geral" },
              ]).map((item) => (
                <a
                  key={`${item.type}-${item.title}`}
                  href={item.href ?? "/admin/visao-geral"}
                  className="group flex items-center gap-4 rounded-2xl border border-white/8 bg-black/12 p-3 transition hover:border-white/18 hover:bg-white/[0.055]"
                >
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.06] text-[var(--tc-accent,#ef0001)]">
                    {item.type === "company" ? <FiBriefcase /> : item.type === "alert" ? <FiAlertTriangle /> : <FiGitBranch />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-white">{item.title}</p>
                    <p className="truncate text-xs font-semibold text-white/52">{item.description}</p>
                  </div>
                  <FiArrowRight className="shrink-0 text-white/30 transition group-hover:translate-x-1 group-hover:text-white" />
                </a>
              ))}
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}

export default function HomeContent() {
  const { user, loading: authLoading } = useAuthUser();
  const { modules, loading: navLoading, companySlug, effectiveRole } = useNavigationItems();

  const currentUser = user as {
    permissionRole?: string | null;
    role?: string | null;
    companyRole?: string | null;
  } | null;

  const loading = authLoading || navLoading;
  const userName = resolveFirstName(user);
  const visibleModules = modules.filter((module) => module.href || (module.items?.length ?? 0) > 0);
  const quickModules = useMemo(() => resolveQuickModules(visibleModules), [visibleModules]);
  const greeting = useMemo(() => resolveGreeting(), []);

  const roleValue = String(
    effectiveRole ??
      currentUser?.permissionRole ??
      currentUser?.role ??
      currentUser?.companyRole ??
      "usuario",
  );

  const profile = useMemo(() => resolveProfileExperience(roleValue), [roleValue]);

  if (loading) {
    return (
      <div className="flex min-h-[420px] w-full items-center justify-center bg-transparent text-xl font-semibold text-slate-500 dark:text-white/70">
        Inicializando Brain...
      </div>
    );
  }

  return (
    <main className="w-full overflow-x-hidden bg-transparent px-2 pb-4 text-slate-950 dark:text-white sm:px-4 lg:px-5 lg:pb-5">
      <BrainConsole
        userName={userName}
        profile={profile}
        greeting={greeting}
        quickModules={quickModules}
        companySlug={companySlug}
      />
    </main>
  );
}
