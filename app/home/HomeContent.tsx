"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  FiActivity,
  FiArrowRight,
  FiBarChart2,
  FiCpu,
  FiGitBranch,
  FiMessageCircle,
  FiShield,
  FiZap,
} from "react-icons/fi";
import { useAuthUser } from "@/hooks/useAuthUser";
import { useNavigationItems } from "@/hooks/navigation/useNavigationItems";

type ProfileExperience = {
  label: string;
  eyebrow: string;
  headline: string;
  summary: string;
  focus: string[];
  prompts: string[];
};

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

function resolveProfileExperience(roleValue: string): ProfileExperience {
  const role = normalizeText(roleValue);

  if (role.includes("leader") || role.includes("lider")) {
    return {
      label: "Líder TC",
      eyebrow: "Contexto executivo",
      headline: "Seu centro de decisão está pronto.",
      summary:
        "O Brain cruza empresas em risco, defeitos críticos, runs instáveis, agenda e decisões pendentes para orientar a próxima ação.",
      focus: ["Empresas em risco", "Defeitos críticos", "Runs instáveis", "Decisões pendentes"],
      prompts: ["Resumir riscos de hoje", "Priorizar empresas críticas", "Ver pendências do time"],
    };
  }

  if (role.includes("support") || role.includes("suporte") || role.includes("technical")) {
    return {
      label: "Suporte Técnico",
      eyebrow: "Radar técnico",
      headline: "O Brain separa sinal de ruído.",
      summary:
        "Integrações, usuários bloqueados, chamados críticos e alertas técnicos aparecem como contexto pronto para atendimento.",
      focus: ["Chamados críticos", "Integrações", "Usuários bloqueados", "Logs e alertas"],
      prompts: ["Ver incidentes", "Analisar integrações", "Checar usuários"],
    };
  }

  if (role.includes("empresa") || role.includes("company")) {
    return {
      label: "Empresa",
      eyebrow: "Saúde do projeto",
      headline: "Seu projeto com contexto inteligente.",
      summary:
        "O Brain organiza plano ativo, defeitos abertos, próximas entregas e pendências que impactam a operação.",
      focus: ["Saúde do projeto", "Plano ativo", "Defeitos abertos", "Próximas entregas"],
      prompts: ["Ver saúde do projeto", "Abrir plano atual", "Listar defeitos"],
    };
  }

  return {
    label: "QA",
    eyebrow: "Execução inteligente",
    headline: "Seu dia de QA começa com contexto.",
    summary:
      "Runs, evidências, bugs para revisar e plano atual ficam conectados para você continuar sem procurar no menu.",
    focus: ["Meus runs", "Evidências", "Bugs para revisar", "Plano atual"],
    prompts: ["Continuar meu trabalho", "Ver meus runs", "Revisar bugs"],
  };
}

function useTyping(messages: string[]) {
  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState("");

  const message = messages[index % messages.length];

  useEffect(() => {
    setTyped("");

    let cursor = 0;
    const typing = window.setInterval(() => {
      cursor += 1;
      setTyped(message.slice(0, cursor));

      if (cursor >= message.length) {
        window.clearInterval(typing);
      }
    }, 17);

    const next = window.setTimeout(() => {
      setIndex((current) => (current + 1) % messages.length);
    }, Math.max(4200, message.length * 34));

    return () => {
      window.clearInterval(typing);
      window.clearTimeout(next);
    };
  }, [message, messages.length]);

  return typed;
}

function FocusChip({ children }: { children: ReactNode }) {
  return (
    <div className="inline-flex min-w-0 items-center gap-2 rounded-full border border-slate-200/80 bg-white/80 px-3 py-2 text-xs font-black text-slate-800 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/[0.06] dark:text-white">
      <FiZap className="shrink-0 text-[var(--tc-accent,#ef0001)]" size={13} />
      <span className="truncate">{children}</span>
    </div>
  );
}

function QuickSignal({
  icon,
  title,
  description,
  href,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group flex min-h-20 items-start gap-3 rounded-3xl border border-slate-200/80 bg-white/75 p-4 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:border-[var(--tc-accent,#ef0001)] hover:bg-white dark:border-white/10 dark:bg-white/[0.055] dark:hover:bg-white/[0.085]"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-[var(--tc-accent,#ef0001)]/10 text-[var(--tc-accent,#ef0001)]">
        {icon}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-sm font-black text-slate-900 dark:text-white">
          {title}
        </span>
        <span className="mt-1 block line-clamp-2 text-xs leading-5 text-slate-500 dark:text-white/58">
          {description}
        </span>
      </span>

      <FiArrowRight
        className="mt-2 shrink-0 text-[var(--tc-accent,#ef0001)] transition group-hover:translate-x-1"
        size={15}
      />
    </Link>
  );
}

function NeuralMark() {
  return (
    <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[58%] overflow-hidden lg:block">
      <svg
        className="absolute right-[-8%] top-1/2 h-[92%] w-[92%] -translate-y-1/2 text-[var(--tc-accent,#ef0001)]/28 dark:text-[var(--tc-accent,#ef0001)]/42"
        viewBox="0 0 720 620"
        fill="none"
      >
        <path d="M360 310 C270 220 190 210 108 142" stroke="currentColor" strokeWidth="1.2" />
        <path d="M360 310 C260 350 195 430 112 505" stroke="currentColor" strokeWidth="1.2" />
        <path d="M360 310 C465 220 545 215 622 140" stroke="currentColor" strokeWidth="1.2" />
        <path d="M360 310 C470 352 545 438 622 500" stroke="currentColor" strokeWidth="1.2" />
        <path d="M360 310 C360 220 360 155 360 88" stroke="currentColor" strokeWidth="1" opacity="0.8" />
        <path d="M360 310 C360 410 360 485 360 545" stroke="currentColor" strokeWidth="1" opacity="0.8" />

        <circle cx="360" cy="310" r="90" stroke="currentColor" strokeWidth="1.2" opacity="0.45" />
        <circle cx="360" cy="310" r="150" stroke="currentColor" strokeWidth="1" opacity="0.25" />
        <circle cx="360" cy="310" r="215" stroke="currentColor" strokeWidth="1" opacity="0.13" />

        {[
          [360, 310, 15],
          [108, 142, 7],
          [112, 505, 7],
          [622, 140, 7],
          [622, 500, 7],
          [360, 88, 6],
          [360, 545, 6],
          [242, 235, 5],
          [478, 235, 5],
          [242, 400, 5],
          [478, 400, 5],
        ].map(([cx, cy, r]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} fill="currentColor" />
        ))}
      </svg>

      <div className="absolute right-[18%] top-1/2 size-80 -translate-y-1/2 rounded-full bg-[var(--tc-accent,#ef0001)]/14 blur-3xl animate-pulse" />
      <div className="absolute right-[34%] top-[22%] size-48 rounded-full bg-blue-500/10 blur-3xl dark:bg-blue-400/12" />
    </div>
  );
}

function BrainConsole({
  userName,
  profile,
  chatHref,
  graphHref,
}: {
  userName: string;
  profile: ProfileExperience;
  chatHref: string;
  graphHref: string;
}) {
  const messages = useMemo(
    () => [
      `Bom dia, ${userName}. Eu sou o Brain. O contexto de ${profile.label} já está organizado.`,
      profile.summary,
      `Minha sugestão agora: olhar ${profile.focus.slice(0, 2).join(" e ")}.`,
      "Converse comigo pelo Chat. Use os nós do Brain quando quiser aprofundar um assunto do sistema.",
    ],
    [profile, userName],
  );

  const typed = useTyping(messages);

  return (
    <section className="relative flex h-full min-h-0 overflow-hidden rounded-[2.25rem] border border-slate-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(246,248,252,0.74))] shadow-[0_26px_80px_rgba(15,23,42,0.10)] backdrop-blur dark:border-white/10 dark:bg-[linear-gradient(135deg,rgba(2,7,19,0.82),rgba(1,24,72,0.32))] dark:shadow-[0_34px_110px_rgba(0,0,0,0.36)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_78%_44%,rgba(239,0,1,0.14),transparent_28%),radial-gradient(circle_at_22%_15%,rgba(1,24,72,0.10),transparent_32%)] dark:bg-[radial-gradient(circle_at_78%_44%,rgba(239,0,1,0.22),transparent_30%),radial-gradient(circle_at_22%_15%,rgba(37,99,235,0.14),transparent_34%)]" />
      <NeuralMark />

      <div className="relative z-10 grid h-full min-h-0 w-full grid-cols-1 lg:grid-cols-[0.46fr_0.54fr]">
        <div className="flex h-full min-h-0 flex-col justify-between p-5 lg:p-8">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/70 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.28em] text-[var(--tc-accent,#ef0001)] shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/[0.055]">
              <FiCpu size={13} />
              {profile.eyebrow}
            </div>

            <h1 className="mt-5 max-w-xl text-4xl font-black leading-[0.98] tracking-tight text-slate-950 dark:text-white lg:text-5xl 2xl:text-6xl">
              {profile.headline}
            </h1>

            <p className="mt-5 max-w-xl text-sm leading-6 text-slate-600 dark:text-white/66 lg:text-base">
              {profile.summary}
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href={chatHref}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[var(--tc-accent,#ef0001)] px-5 py-3 text-xs font-black uppercase tracking-[0.22em] text-white shadow-[0_16px_34px_rgba(239,0,1,0.25)] transition hover:-translate-y-0.5 hover:bg-[var(--tc-accent-hover,#c80001)]"
              >
                Conversar no Chat
                <FiMessageCircle size={15} />
              </Link>

              <Link
                href="/admin/visao-geral"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200/80 bg-white/55 px-5 py-3 text-xs font-black uppercase tracking-[0.22em] text-slate-900 backdrop-blur transition hover:-translate-y-0.5 hover:border-[var(--tc-accent,#ef0001)] hover:text-[var(--tc-accent,#ef0001)] dark:border-white/10 dark:bg-white/[0.055] dark:text-white"
              >
                Abrir visão geral
                <FiArrowRight size={15} />
              </Link>
            </div>
          </div>

          <div className="mt-6 grid gap-2 sm:grid-cols-2">
            {profile.focus.map((item) => (
              <FocusChip key={item}>{item}</FocusChip>
            ))}
          </div>
        </div>

        <div className="relative flex h-full min-h-0 flex-col justify-center p-5 lg:p-8">
          <div className="max-w-4xl">
            <div className="mb-5 flex items-center gap-3">
              <div className="relative grid size-14 place-items-center rounded-2xl bg-[var(--tc-accent,#ef0001)] text-white shadow-[0_18px_40px_rgba(239,0,1,0.28)]">
                <FiCpu size={25} />
                <span className="absolute -right-1 -top-1 size-3 rounded-full bg-emerald-400 ring-4 ring-white dark:ring-[#07101f]" />
              </div>

              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[var(--tc-accent,#ef0001)]">
                  Brain online
                </p>
                <h2 className="text-lg font-black text-slate-950 dark:text-white">
                  Resposta pelo Chat · conhecimento pelos nós
                </h2>
              </div>
            </div>

            <div className="rounded-[2rem] border border-slate-200/80 bg-white/64 p-5 shadow-sm backdrop-blur dark:border-white/10 dark:bg-black/18 lg:p-7">
              <p className="min-h-[156px] text-3xl font-black leading-tight tracking-tight text-slate-950 dark:text-white lg:text-5xl">
                {typed}
                <span className="ml-1 inline-block h-9 w-1 translate-y-1 bg-[var(--tc-accent,#ef0001)] animate-pulse" />
              </p>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {profile.prompts.map((prompt) => (
                <Link
                  key={prompt}
                  href={chatHref}
                  className="rounded-2xl border border-slate-200/80 bg-white/58 px-4 py-3 text-center text-xs font-black text-slate-900 backdrop-blur transition hover:border-[var(--tc-accent,#ef0001)] hover:text-[var(--tc-accent,#ef0001)] dark:border-white/10 dark:bg-white/[0.055] dark:text-white"
                >
                  {prompt}
                </Link>
              ))}
            </div>

            <div className="mt-4">
              <Link
                href={graphHref}
                className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.22em] text-slate-500 transition hover:text-[var(--tc-accent,#ef0001)] dark:text-white/45"
              >
                Aprofundar no mapa de nós do Brain
                <FiGitBranch size={14} />
              </Link>
            </div>
          </div>
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
  const visibleModules = modules.filter((module) => navModule.href || navModule.items.length > 0);

  const roleValue = String(
    effectiveRole ??
      currentUser?.permissionRole ??
      currentUser?.role ??
      currentUser?.companyRole ??
      "usuario",
  );

  const profile = useMemo(() => resolveProfileExperience(roleValue), [roleValue]);

  const chatHref = companySlug
    ? `/chat?assistant=brain&companySlug=${encodeURIComponent(companySlug)}`
    : "/chat?assistant=brain";

  const graphHref = companySlug
    ? `/brain?companySlug=${encodeURIComponent(companySlug)}`
    : "/brain";

  const findHref = useMemo(() => {
    return (terms: string[]) => {
      const normalizedTerms = terms.map(normalizeText);

      for (const navModule of visibleModules) {
        const moduleLabel = normalizeText(navModule.label);

        if (normalizedTerms.some((term) => moduleLabel.includes(term))) {
          return navModule.href ?? navModule.items[0]?.href ?? graphHref;
        }

        const matchedItem = navModule.items.find((item) => {
          const label = normalizeText(item.label);
          return normalizedTerms.some((term) => label.includes(term));
        });

        if (matchedItem?.href) return matchedItem.href;
      }

      return graphHref;
    };
  }, [graphHref, visibleModules]);

  if (loading) {
    return (
      <div className="flex h-[calc(100dvh-170px)] w-full items-center justify-center bg-transparent text-xl font-semibold text-slate-500 dark:text-white/70">
        Inicializando Brain...
      </div>
    );
  }

  return (
    <main className="h-[calc(100dvh-170px)] min-h-[560px] w-full overflow-hidden bg-transparent px-3 pb-3 text-slate-950 dark:text-white lg:px-5 lg:pb-5">
      <div className="grid h-full min-h-0 w-full grid-rows-[minmax(0,1fr)_auto] gap-4">
        <BrainConsole
          userName={userName}
          profile={profile}
          chatHref={chatHref}
          graphHref={graphHref}
        />

        <section className="grid shrink-0 gap-3 md:grid-cols-4">
          <QuickSignal
            icon={<FiShield size={18} />}
            title="Riscos e defeitos"
            description="Falhas críticas, bloqueios e sinais de impacto."
            href={findHref(["defeito", "bug", "risco"])}
          />

          <QuickSignal
            icon={<FiActivity size={18} />}
            title="Runs e execução"
            description="Execuções, falhas, regressão e ciclos ativos."
            href={findHref(["run", "execucao", "execucoes"])}
          />

          <QuickSignal
            icon={<FiBarChart2 size={18} />}
            title="Planos e cobertura"
            description="Prioridades, cobertura e próximos testes."
            href={findHref(["plano", "planos"])}
          />

          <QuickSignal
            icon={<FiCpu size={18} />}
            title="Mapa do Brain"
            description="Aprofunde conhecimento nos nós do sistema."
            href={graphHref}
          />
        </section>
      </div>
    </main>
  );
}
