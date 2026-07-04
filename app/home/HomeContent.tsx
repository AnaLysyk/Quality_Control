"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  FiArrowRight,
  FiCpu,
  FiGrid,
  FiMessageCircle,
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

type QuickAccess = {
  id: string;
  label: string;
  href: string;
  items: HomeNavItem[];
};

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function fixMojibake(value: string) {
  if (!/[ÃÂ]/.test(value)) return value;

  try {
    const bytes = Array.from(value, (char) =>
      `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`,
    ).join("");
    return decodeURIComponent(bytes);
  } catch {
    return value;
  }
}

function normalizeProfileExperience(profile: ProfileExperience): ProfileExperience {
  return {
    label: fixMojibake(profile.label),
    eyebrow: fixMojibake(profile.eyebrow),
    headline: fixMojibake(profile.headline),
    summary: fixMojibake(profile.summary),
    focus: profile.focus.map(fixMojibake),
    prompts: profile.prompts.map(fixMojibake),
  };
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
      eyebrow: "Contexto executivo",
      headline: "Seu contexto de trabalho está pronto.",
      summary:
        "A Home mostra apenas os atalhos liberados para o seu perfil e abre o Brain para apoiar prioridades, decisões e acompanhamento do time.",
      focus: ["Empresas em risco", "Defeitos críticos", "Runs instáveis", "Decisões pendentes"],
      prompts: ["Resumir riscos de hoje", "Priorizar empresas críticas", "Ver pendências do time"],
    };
  }

  if (role.includes("support") || role.includes("suporte") || role.includes("technical")) {
    return {
      label: "Suporte Técnico",
      eyebrow: "Radar técnico",
      headline: "Seu radar de atendimento está pronto.",
      summary:
        "A Home reúne os acessos liberados para atendimento técnico e deixa o Brain pronto para ajudar com chamados, logs e integrações.",
      focus: ["Chamados críticos", "Integrações", "Usuários bloqueados", "Logs e alertas"],
      prompts: ["Ver incidentes", "Analisar integrações", "Checar usuários"],
    };
  }

  if (role.includes("empresa") || role.includes("company")) {
    return {
      label: "Empresa",
      eyebrow: "Saúde do projeto",
      headline: "Seu projeto está organizado.",
      summary:
        "A Home mostra os caminhos liberados para a empresa e deixa o Brain pronto para apoiar plano ativo, defeitos e próximas entregas.",
      focus: ["Saúde do projeto", "Plano ativo", "Defeitos abertos", "Próximas entregas"],
      prompts: ["Ver saúde do projeto", "Abrir plano atual", "Listar defeitos"],
    };
  }

  return {
    label: "QA",
    eyebrow: "Execução inteligente",
    headline: "Seu dia de QA está organizado.",
    summary:
      "A Home mostra seus atalhos liberados e deixa o Brain pronto para ajudar com runs, evidências, bugs e plano atual.",
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
    }, 14);

    const next = window.setTimeout(() => {
      setIndex((current) => (current + 1) % messages.length);
    }, Math.max(3600, message.length * 28));

    return () => {
      window.clearInterval(typing);
      window.clearTimeout(next);
    };
  }, [message, messages.length]);

  return typed;
}

function openAssistantChat(input: { greeting: string; userName: string; profile: ProfileExperience }) {
  if (typeof window === "undefined") return;

  const prompt = `${input.greeting}, ${input.userName}. Me ajuda a priorizar meu trabalho como ${input.profile.label}.`;

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
          screenLabel: "Home inteligente",
          screenSummary: input.profile.summary,
          suggestedPrompts: input.profile.prompts,
          metadata: {
            profile: input.profile.label,
            greeting: input.greeting,
          },
        },
      },
    }),
  );
}

function resolveQuickAccess(navModules: HomeNavModule[]): QuickAccess[] {
  return navModules
    .filter((navGroup) => navGroup.id !== "home")
    .map((navGroup) => {
      const items = (navGroup.items ?? []).filter((item) => Boolean(item.href));
      const href = navGroup.href ?? items[0]?.href ?? "";
      return {
        id: String(navGroup.id ?? navGroup.label),
        label: fixMojibake(navGroup.label),
        href,
        items: items.slice(0, 3).map((item) => ({
          ...item,
          label: fixMojibake(item.label),
        })),
      };
    })
    .filter((navGroup) => Boolean(navGroup.href))
    .slice(0, 6);
}

function FocusChip({ children }: { children: ReactNode }) {
  return (
    <div className="inline-flex min-w-0 items-center gap-2 rounded-full border border-slate-200/80 bg-white/80 px-3 py-2 text-xs font-black text-slate-800 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/[0.06] dark:text-white">
      <FiZap className="shrink-0 text-[var(--tc-accent,#ef0001)]" size={13} />
      <span className="truncate">{children}</span>
    </div>
  );
}

function QuickAccessCard({ access }: { access: QuickAccess }) {
  return (
    <article className="group rounded-[1.55rem] border border-slate-200/80 bg-white/78 p-4 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:border-[var(--tc-accent,#ef0001)] hover:bg-white dark:border-white/10 dark:bg-white/[0.055] dark:hover:bg-white/[0.085]">
      <Link href={access.href} className="flex items-start justify-between gap-3">
        <span className="min-w-0">
          <span className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-[var(--tc-accent,#ef0001)]">
            <FiGrid size={13} />
            Atalho
          </span>
          <span className="mt-2 block truncate text-base font-black text-slate-950 dark:text-white">
            {access.label}
          </span>
        </span>
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--tc-accent,#ef0001)]/10 text-[var(--tc-accent,#ef0001)] transition group-hover:translate-x-1">
          <FiArrowRight size={15} />
        </span>
      </Link>

      {access.items.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {access.items.map((item) => (
            <Link
              key={`${access.id}-${item.href}-${item.label}`}
              href={item.href ?? access.href}
              className="max-w-full truncate rounded-full border border-slate-200/70 bg-white/65 px-3 py-1.5 text-[11px] font-bold text-slate-600 transition hover:border-[var(--tc-accent,#ef0001)] hover:text-[var(--tc-accent,#ef0001)] dark:border-white/10 dark:bg-black/12 dark:text-white/62"
            >
              {item.label}
            </Link>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-xs leading-5 text-slate-500 dark:text-white/55">
          Acesso direto pelo menu lateral.
        </p>
      )}
    </article>
  );
}

function BrainConsole({
  userName,
  profile,
  greeting,
  quickAccess,
}: {
  userName: string;
  profile: ProfileExperience;
  greeting: string;
  quickAccess: QuickAccess[];
}) {
  const messages = useMemo(
    () => [
      fixMojibake(`${greeting}, ${userName}. Eu sou o Brain e acompanho seu contexto como ${profile.label}.`),
      profile.summary,
      fixMojibake(`Minha sugestão agora: olhar ${profile.focus.slice(0, 2).join(" e ")}.`),
      fixMojibake("Os cards abaixo repetem apenas os caminhos liberados no menu lateral."),
    ],
    [greeting, profile, userName],
  );

  const typed = useTyping(messages);

  return (
    <section className="relative overflow-hidden rounded-[2.25rem] border border-slate-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.94),rgba(246,248,252,0.76))] p-5 shadow-[0_26px_80px_rgba(15,23,42,0.10)] backdrop-blur dark:border-white/10 dark:bg-[linear-gradient(135deg,rgba(2,7,19,0.86),rgba(1,24,72,0.34))] dark:shadow-[0_34px_110px_rgba(0,0,0,0.36)] lg:p-7">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_18%,rgba(239,0,1,0.18),transparent_26%),radial-gradient(circle_at_18%_12%,rgba(1,24,72,0.10),transparent_30%)] dark:bg-[radial-gradient(circle_at_78%_20%,rgba(239,0,1,0.22),transparent_30%),radial-gradient(circle_at_16%_10%,rgba(37,99,235,0.14),transparent_34%)]" />

      <div className="relative z-10 flex flex-col gap-5">
        <header className="grid gap-5 xl:grid-cols-[0.46fr_0.54fr] xl:items-stretch">
          <div className="rounded-[1.75rem] border border-slate-200/70 bg-white/52 p-5 backdrop-blur dark:border-white/10 dark:bg-black/14">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/70 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.28em] text-[var(--tc-accent,#ef0001)] shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/[0.055]">
              <FiCpu size={13} />
              {profile.eyebrow}
            </div>

            <h1 className="mt-4 max-w-2xl text-3xl font-black leading-tight tracking-tight text-slate-950 dark:text-white lg:text-5xl">
              {profile.headline}
            </h1>

            <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-600 dark:text-white/66 lg:text-base">
              {profile.summary}
            </p>
          </div>

          <div className="flex min-h-[190px] flex-col justify-between rounded-[1.75rem] border border-slate-200/80 bg-white/64 p-5 shadow-sm backdrop-blur dark:border-white/10 dark:bg-black/18">
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[var(--tc-accent,#ef0001)]">
              Brain online
            </p>
            <p className="mt-3 min-h-[82px] text-xl font-black leading-snug tracking-tight text-slate-950 dark:text-white lg:text-2xl">
              {typed}
              <span className="ml-1 inline-block h-6 w-1 translate-y-1 bg-[var(--tc-accent,#ef0001)] animate-pulse" />
            </p>
            <button
              type="button"
              onClick={() => openAssistantChat({ greeting, userName, profile })}
              className="mt-4 inline-flex w-fit items-center justify-center gap-2 rounded-2xl bg-[var(--tc-accent,#ef0001)] px-5 py-3 text-xs font-black uppercase tracking-[0.22em] text-white shadow-[0_16px_34px_rgba(239,0,1,0.25)] transition hover:-translate-y-0.5 hover:bg-[var(--tc-accent-hover,#c80001)]"
            >
              Conversar com o Brain
              <FiMessageCircle size={15} />
            </button>
          </div>
        </header>

        <div className="flex flex-wrap gap-2">
          {profile.focus.map((item) => (
            <FocusChip key={item}>{item}</FocusChip>
          ))}
        </div>

        <section className="rounded-[1.75rem] border border-slate-200/80 bg-white/50 p-4 backdrop-blur dark:border-white/10 dark:bg-black/12 lg:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[var(--tc-accent,#ef0001)]">
                Atalhos do menu lateral
              </p>
              <h2 className="text-lg font-black text-slate-950 dark:text-white">
                Mesmas opções liberadas para o seu perfil
              </h2>
            </div>
          </div>

          {quickAccess.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {quickAccess.map((access) => (
                <QuickAccessCard key={access.id} access={access} />
              ))}
            </div>
          ) : (
            <div className="rounded-[1.75rem] border border-dashed border-slate-200/80 bg-white/60 p-6 text-sm font-semibold text-slate-600 dark:border-white/10 dark:bg-white/[0.045] dark:text-white/62">
              Nenhum atalho disponível para este perfil ainda.
            </div>
          )}
        </section>
      </div>
    </section>
  );
}

export default function HomeContent() {
  const { user, loading: authLoading } = useAuthUser();
  const { modules, loading: navLoading, companySlug: _companySlug, effectiveRole } = useNavigationItems();

  const currentUser = user as {
    permissionRole?: string | null;
    role?: string | null;
    companyRole?: string | null;
  } | null;

  const loading = authLoading || navLoading;
  const userName = resolveFirstName(user);
  const visibleModules = modules.filter((navGroup) => navGroup.href || navGroup.items.length > 0);
  const greeting = useMemo(() => resolveGreeting(), []);
  const quickAccess = useMemo(() => resolveQuickAccess(visibleModules), [visibleModules]);

  const roleValue = String(
    effectiveRole ??
      currentUser?.permissionRole ??
      currentUser?.role ??
      currentUser?.companyRole ??
      "usuario",
  );

  const profile = useMemo(() => normalizeProfileExperience(resolveProfileExperience(roleValue)), [roleValue]);

  if (loading) {
    return (
      <div className="flex min-h-[calc(100dvh-170px)] w-full items-center justify-center bg-transparent text-xl font-semibold text-slate-500 dark:text-white/70">
        Inicializando Brain...
      </div>
    );
  }

  return (
    <main className="min-h-[calc(100dvh-170px)] w-full bg-transparent px-3 pb-3 text-slate-950 dark:text-white lg:px-5 lg:pb-5">
      <BrainConsole
        userName={userName}
        profile={profile}
        greeting={greeting}
        quickAccess={quickAccess}
      />
    </main>
  );
}
