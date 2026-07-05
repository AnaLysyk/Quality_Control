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
    <section className="relative ml-0 w-full max-w-none overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_13%_18%,rgba(239,0,1,0.14),transparent_24%),radial-gradient(circle_at_80%_20%,rgba(147,197,253,0.12),transparent_28%),radial-gradient(circle_at_44%_105%,rgba(239,0,1,0.12),transparent_28%),linear-gradient(135deg,#050713_0%,#070b18_46%,#0a1020_100%)] p-4 text-white shadow-[0_30px_100px_rgba(0,0,0,0.34)] lg:p-5 xl:p-6">
      <style>{`
        .brain-orb-wrap { position: relative; width: clamp(220px, 22vw, 300px); height: clamp(220px, 22vw, 300px); display: grid; place-items: center; isolation: isolate; animation: brainRobotHover 6.4s ease-in-out infinite; }
        .brain-wave-field { position: absolute; inset: 0; z-index: 1; border-radius: 999px; filter: drop-shadow(0 0 22px rgba(255,42,68,.22)); }
        .brain-wave { position: absolute; border-radius: 999px; opacity: .80; transform-origin: center; }
        .brain-wave::before { content: ""; position: absolute; inset: 0; border-radius: inherit; padding: 1px; background: conic-gradient(from 128deg, transparent 0deg, transparent 34deg, rgba(255,52,82,.13) 52deg, rgba(255,52,82,.86) 72deg, rgba(255,52,82,.18) 102deg, transparent 140deg, rgba(180,212,255,.18) 218deg, transparent 272deg, rgba(255,52,82,.46) 320deg, transparent 360deg); -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor; mask-composite: exclude; }
        .brain-wave::after { content: ""; position: absolute; width: 4px; height: 4px; border-radius: 999px; background: rgba(255,52,82,.96); box-shadow: 0 0 14px rgba(255,52,82,.96), 0 0 28px rgba(255,52,82,.40); }
        .brain-wave.wave-one { inset: 16%; animation: brainWaveOrbit 11s linear infinite, brainWavePulse 4.4s ease-in-out infinite; }
        .brain-wave.wave-one::after { right: 10%; bottom: 13%; }
        .brain-wave.wave-two { inset: 9%; opacity: .44; animation: brainWaveOrbit 18s linear infinite reverse, brainWavePulse 5.8s ease-in-out infinite reverse; }
        .brain-wave.wave-two::before { padding: 1px; background: conic-gradient(from -32deg, transparent 0deg, rgba(255,52,82,.06) 38deg, rgba(255,52,82,.44) 78deg, transparent 118deg, rgba(178,212,255,.20) 190deg, transparent 244deg, rgba(255,52,82,.16) 314deg, transparent 360deg); }
        .brain-wave.wave-two::after { right: 7%; top: 34%; width: 3px; height: 3px; opacity: .44; }
        .brain-wave.wave-three { inset: 3%; opacity: .25; animation: brainWaveOrbit 28s linear infinite, brainWavePulse 6.2s ease-in-out infinite; }
        .brain-wave.wave-three::before { padding: 1px; background: conic-gradient(from 194deg, transparent 0deg, rgba(255,255,255,.05) 46deg, rgba(255,52,82,.20) 84deg, transparent 128deg, rgba(148,196,255,.12) 232deg, transparent 304deg, rgba(255,52,82,.16) 338deg, transparent 360deg); }
        .brain-wave.wave-three::after { display: none; }
        .brain-wave-light { position: absolute; z-index: 2; width: 3px; height: 3px; border-radius: 999px; background: rgba(255,255,255,.58); box-shadow: 0 0 10px rgba(255,255,255,.58), 0 0 24px rgba(255,52,82,.26); opacity: .44; }
        .brain-wave-light.light-one { left: 18%; top: 18%; animation: brainLightDrift 4.2s ease-in-out infinite; }
        .brain-wave-light.light-two { right: 11%; top: 42%; animation: brainLightDrift 5.1s ease-in-out infinite reverse; }
        .brain-orb-aura { position: absolute; z-index: 2; width: 62%; height: 62%; border-radius: 999px; background: radial-gradient(circle at 33% 72%, rgba(255,40,70,.18), transparent 42%), radial-gradient(circle, rgba(94,139,213,.10), transparent 70%); filter: blur(13px); opacity: .66; animation: brainAura 5.4s ease-in-out infinite; }
        .brain-orb { position: relative; z-index: 3; width: 52%; height: 52%; border-radius: 999px; overflow: hidden; background: radial-gradient(circle at 64% 18%, rgba(235,246,255,.26), rgba(132,169,210,.10) 15%, transparent 28%), radial-gradient(circle at 44% 54%, #101a2b 0%, #07101c 52%, #02050d 100%); border: 1px solid rgba(194,215,255,.16); box-shadow: inset 18px 17px 30px rgba(222,238,255,.08), inset -28px -32px 60px rgba(0,0,0,.82), 0 0 14px rgba(255,52,82,.28), 0 0 44px rgba(255,52,82,.13), 0 0 76px rgba(150,196,255,.08); animation: brainBotBreath 4.8s ease-in-out infinite; }
        .brain-orb-liquid { position: absolute; border-radius: 999px; mix-blend-mode: screen; pointer-events: none; }
        .brain-orb-liquid.primary { left: -9%; bottom: 4%; width: 45%; height: 48%; background: radial-gradient(circle at 76% 68%, rgba(255,44,72,.30), rgba(255,44,72,.08) 42%, transparent 72%); filter: blur(14px); opacity: .52; animation: brainLiquid 7.2s ease-in-out infinite; }
        .brain-orb-liquid.secondary { right: -12%; top: -12%; width: 58%; height: 52%; background: radial-gradient(circle, rgba(190,220,255,.30), rgba(95,147,217,.10) 48%, transparent 72%); filter: blur(13px); opacity: .44; animation: brainLiquid 8.8s ease-in-out infinite reverse; }
        .brain-orb-red-crescent { position: absolute; left: 3%; bottom: 2%; width: 50%; height: 56%; border-radius: 999px; border-left: 5px solid rgba(255,52,82,.98); border-bottom: 4px solid rgba(255,52,82,.62); filter: drop-shadow(0 0 10px rgba(255,52,82,.82)) drop-shadow(0 0 24px rgba(255,52,82,.30)); transform: rotate(-24deg); opacity: .98; }
        .brain-orb-glass { position: absolute; inset: 0; border-radius: inherit; background: radial-gradient(circle at 66% 18%, rgba(236,246,255,.21), transparent 22%), radial-gradient(circle at 56% 64%, transparent 0%, rgba(255,255,255,.018) 58%, rgba(255,255,255,.07) 100%); border: 1px solid rgba(255,255,255,.07); }
        .brain-orb-shine { position: absolute; right: 12%; top: 9%; width: 43%; height: 25%; border-radius: 999px; background: linear-gradient(138deg, rgba(242,249,255,.34), rgba(190,218,255,.07) 50%, transparent 76%); transform: rotate(-30deg); opacity: .64; filter: blur(.1px); }
        .brain-face { position: absolute; inset: 0; z-index: 4; display: flex; align-items: center; justify-content: center; gap: clamp(21px, 2.7vw, 30px); transform: translate3d(0, 4px, 0); animation: brainFaceMotion 5.4s ease-in-out infinite; }
        .brain-chevron { position: relative; width: 16px; height: 13px; filter: drop-shadow(0 0 8px rgba(255,255,255,.98)); }
        .brain-chevron::before, .brain-chevron::after { content: ""; position: absolute; top: 6px; width: 11px; height: 4px; border-radius: 999px; background: rgba(255,255,255,.96); }
        .brain-chevron::before { left: 1px; transform: rotate(-54deg); transform-origin: right center; }
        .brain-chevron::after { right: 1px; transform: rotate(54deg); transform-origin: left center; }
        .brain-dash { display: block; width: 14px; height: 4px; border-radius: 999px; background: rgba(255,255,255,.94); box-shadow: 0 0 10px rgba(255,255,255,.84); animation: brainDashBlink 4.7s ease-in-out infinite; }
        .brain-orb-wrap.is-active .brain-wave.wave-one { animation-duration: 7.6s, 3.4s; }
        .brain-orb-wrap.is-active .brain-wave.wave-two { animation-duration: 11.4s, 4.4s; }
        .brain-orb-wrap.is-active .brain-orb { box-shadow: inset 18px 17px 30px rgba(222,238,255,.09), inset -28px -32px 60px rgba(0,0,0,.82), 0 0 22px rgba(255,52,82,.44), 0 0 58px rgba(255,52,82,.18), 0 0 92px rgba(150,196,255,.11); }
        .brain-orb-wrap.is-active .brain-orb-liquid.primary { opacity: .62; }
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

        <div className="grid gap-5 lg:grid-cols-[minmax(235px,330px)_minmax(0,1fr)] xl:grid-cols-[minmax(250px,340px)_minmax(0,1fr)] xl:items-start">
          <div className="flex justify-center pt-1 lg:justify-start lg:pt-3">
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
