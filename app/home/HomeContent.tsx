"use client";

import { useEffect, useMemo, useState } from "react";
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
  FiSearch,
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

type BrainMode = "company" | "user" | "screen" | "flow" | "pending" | "continue";
type RangeKey = "24h" | "7d" | "30d";

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
      summary:
        "O Brain cruza empresas, usuários, solicitações, fluxos e pendências recentes para orientar a próxima ação.",
      prompts: ["Analisar por empresa", "Analisar por usuário", "Ver pendências do dia"],
    };
  }

  if (role.includes("support") || role.includes("suporte") || role.includes("technical")) {
    return {
      label: "Suporte Técnico",
      summary:
        "O Brain organiza chamados, integrações, usuários bloqueados e alertas técnicos para acelerar o atendimento.",
      prompts: ["Ver incidentes", "Analisar integrações", "Checar usuários"],
    };
  }

  if (role.includes("empresa") || role.includes("company")) {
    return {
      label: "Empresa",
      summary:
        "O Brain organiza projeto, pendências, próximas entregas e movimentações recentes da empresa.",
      prompts: ["Ver saúde do projeto", "Listar pendências", "Abrir visão geral"],
    };
  }

  return {
    label: "QA",
    summary:
      "O Brain conecta runs, evidências, bugs e plano atual para você continuar sem procurar no menu.",
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
      <div className={`brain-orb ${active ? "is-active" : ""}`}>
        <div className="brain-orb-liquid" />
        <div className="brain-orb-shine" />
        <div className="brain-face">
          <span className="brain-eye left" />
          <span className="brain-eye right" />
        </div>
      </div>
      <div className="brain-ring one" />
      <div className="brain-ring two" />
    </div>
  );
}

function StatCard({ icon: Icon, value, label }: { icon: typeof FiBarChart2; value: number; label: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3 border-white/10 px-4 py-3 first:pl-0 lg:border-r lg:last:border-r-0">
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[var(--tc-accent,#ef0001)]/55 bg-[var(--tc-accent,#ef0001)]/8 text-[var(--tc-accent,#ef0001)] shadow-[0_0_26px_rgba(239,0,1,0.18)]">
        <Icon size={19} />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-black leading-none text-white">{value}</p>
        <p className="mt-1 text-xs font-semibold leading-tight text-white/64">{label}</p>
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
        <div className="grid max-h-[118px] gap-2 overflow-auto pr-1 lg:grid-cols-2">
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

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
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
    <section className="relative h-full min-h-0 overflow-hidden rounded-[2.25rem] border border-white/10 bg-[radial-gradient(circle_at_18%_18%,rgba(239,0,1,0.10),transparent_24%),radial-gradient(circle_at_75%_18%,rgba(37,99,235,0.12),transparent_28%),linear-gradient(135deg,#070b16_0%,#080f20_48%,#0b1428_100%)] p-4 text-white shadow-[0_30px_120px_rgba(0,0,0,0.38)] lg:p-6">
      <style>{`
        .brain-orb-wrap { position: relative; width: 250px; height: 250px; display: grid; place-items: center; }
        .brain-orb { position: relative; width: 172px; height: 172px; border-radius: 999px; overflow: hidden; background: radial-gradient(circle at 64% 24%, rgba(255,255,255,.36), transparent 24%), radial-gradient(circle at 42% 72%, rgba(239,0,1,.52), transparent 34%), radial-gradient(circle at 75% 76%, rgba(59,130,246,.32), transparent 30%), #07101f; box-shadow: inset 20px 18px 44px rgba(255,255,255,.11), inset -26px -30px 70px rgba(0,0,0,.68), 0 0 36px rgba(239,0,1,.32), 0 0 90px rgba(59,130,246,.10); animation: brainFloat 6s ease-in-out infinite; }
        .brain-orb-liquid { position: absolute; inset: -36%; border-radius: 42%; background: conic-gradient(from 90deg, rgba(239,0,1,.78), rgba(37,99,235,.34), rgba(255,255,255,.20), rgba(5,10,25,.78), rgba(239,0,1,.72)); filter: blur(18px); opacity: .64; animation: brainLiquid 8s linear infinite; }
        .brain-orb-shine { position: absolute; inset: 16px 22px auto auto; width: 82px; height: 54px; border-radius: 999px; background: linear-gradient(135deg, rgba(255,255,255,.42), transparent 72%); transform: rotate(-28deg); }
        .brain-face { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; gap: 38px; }
        .brain-eye { display: block; width: 23px; height: 7px; border-radius: 999px; background: white; box-shadow: 0 0 16px rgba(255,255,255,.86); }
        .brain-eye.left { transform: rotate(-56deg); }
        .brain-eye.right { transform: rotate(0deg); }
        .brain-ring { position: absolute; border-radius: 999px; border: 1px solid rgba(239,0,1,.26); }
        .brain-ring.one { width: 220px; height: 220px; animation: brainSpin 14s linear infinite; }
        .brain-ring.two { width: 252px; height: 252px; border-color: rgba(96,165,250,.14); animation: brainSpin 18s linear infinite reverse; }
        .brain-ring.one::after { content: ""; position: absolute; right: 18px; bottom: 46px; width: 8px; height: 8px; border-radius: 999px; background: var(--tc-accent,#ef0001); box-shadow: 0 0 18px rgba(239,0,1,.86); }
        .brain-orb.is-active { box-shadow: inset 20px 18px 44px rgba(255,255,255,.12), inset -26px -30px 70px rgba(0,0,0,.68), 0 0 46px rgba(239,0,1,.48), 0 0 110px rgba(59,130,246,.16); }
        @keyframes brainFloat { 0%,100% { transform: translateY(0) scale(1); } 50% { transform: translateY(-9px) scale(1.025); } }
        @keyframes brainLiquid { 0% { transform: rotate(0deg) scale(1); } 50% { transform: rotate(180deg) scale(1.08); } 100% { transform: rotate(360deg) scale(1); } }
        @keyframes brainSpin { to { transform: rotate(360deg); } }
        @media (prefers-reduced-motion: reduce) { .brain-orb, .brain-orb-liquid, .brain-ring { animation: none; } }
      `}</style>

      <div className="pointer-events-none absolute inset-0 rounded-[2.25rem] border border-white/[0.03]" />

      <div className="relative z-10 flex h-full min-h-0 flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-3 py-2 text-xs font-black uppercase tracking-[0.22em] text-white/58">
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

        <div className="grid min-h-0 flex-1 gap-5 lg:grid-cols-[300px_1fr] lg:items-start">
          <div className="hidden justify-center pt-7 lg:flex">
            <BrainOrb active={isThinking || Boolean(confirmation)} />
          </div>

          <div className="min-w-0 pt-1 lg:pt-8">
            <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
              <div className="min-w-0">
                <h1 className="text-4xl font-black leading-tight tracking-tight text-white lg:text-5xl">
                  {homeContext.greeting || greeting}, <span className="text-[var(--tc-accent,#ef0001)]">{homeContext.userName || userName}.</span>
                </h1>
                <p className="mt-5 min-h-[112px] max-w-3xl text-2xl font-semibold leading-relaxed text-white/78 lg:text-[1.72rem]">
                  {typed}
                  <span className="ml-1 inline-block h-8 w-1 translate-y-1 bg-white/84 animate-pulse" />
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-sm font-semibold text-white/50">
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-[var(--tc-accent,#ef0001)] shadow-[0_0_18px_rgba(239,0,1,0.8)]" />
                    Brain analisando contexto
                  </span>
                  <span className="h-4 w-px bg-white/10" />
                  <span>{isThinking ? "digitando..." : "contexto pronto"}</span>
                </div>
              </div>

              <div className="hidden rounded-[1.75rem] border border-white/10 bg-white/[0.035] p-4 lg:block">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-white/40">Módulos do sistema</p>
                <div className="mt-3 grid gap-2">
                  {quickModules.slice(0, 5).map((module) => (
                    <a
                      key={module.id}
                      href={module.href}
                      className="flex items-center justify-between rounded-2xl border border-white/8 bg-black/14 px-3 py-2 text-sm font-bold text-white/70 transition hover:border-[var(--tc-accent,#ef0001)]/50 hover:text-white"
                    >
                      <span className="truncate">{module.label}</span>
                      <FiArrowRight className="shrink-0 text-white/35" />
                    </a>
                  ))}
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 flex items-center gap-3 rounded-full border border-[var(--tc-accent,#ef0001)]/55 bg-black/20 px-5 py-4 shadow-[0_0_42px_rgba(59,130,246,0.13)] backdrop-blur">
              <FiCommand className="shrink-0 text-white/70" size={24} />
              <input
                value={command}
                onChange={(event) => setCommand(event.target.value)}
                placeholder="Pergunte ao Brain ou escolha uma ação..."
                className="min-w-0 flex-1 bg-transparent text-base font-semibold text-white outline-none placeholder:text-white/36"
              />
              <FiMic className="hidden shrink-0 text-white/48 sm:block" size={22} />
              <button type="submit" className="sr-only">
                Confirmar contexto
              </button>
            </form>

            <div className="mt-4 flex flex-wrap justify-center gap-3 lg:justify-start">
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

        <div className="grid gap-4">
          <section className="rounded-[1.7rem] border border-white/10 bg-white/[0.04] px-5 py-4 backdrop-blur">
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
            <div className="grid gap-2 lg:grid-cols-5">
              <StatCard icon={FiBarChart2} value={homeContext.summary.actions} label="ações registradas" />
              <StatCard icon={FiBriefcase} value={homeContext.summary.companiesUpdated} label="empresas com atualização" />
              <StatCard icon={FiUsers} value={homeContext.summary.usersInvolved} label="usuários envolvidos" />
              <StatCard icon={FiCheckSquare} value={homeContext.summary.pendingItems} label="pendências abertas" />
              <StatCard icon={FiAlertTriangle} value={homeContext.summary.flowsWithRisk} label="fluxos com risco" />
            </div>
          </section>

          <section className="rounded-[1.7rem] border border-white/10 bg-white/[0.035] px-5 py-4 backdrop-blur">
            <h2 className="mb-3 text-base font-black text-white">Destaques do contexto</h2>
            <div className="grid gap-3 lg:grid-cols-3">
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
  const visibleModules = modules.filter((module) => module.href || module.items.length > 0);
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
      <div className="flex h-[calc(100dvh-170px)] w-full items-center justify-center bg-transparent text-xl font-semibold text-slate-500 dark:text-white/70">
        Inicializando Brain...
      </div>
    );
  }

  return (
    <main className="h-[calc(100dvh-170px)] min-h-[700px] w-full overflow-hidden bg-transparent px-3 pb-3 text-slate-950 dark:text-white lg:px-5 lg:pb-5">
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
