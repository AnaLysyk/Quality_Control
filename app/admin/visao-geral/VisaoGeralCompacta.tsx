"use client";

import { useEffect, useMemo, useState } from "react";
import type { IconType } from "react-icons";
import {
  FiActivity,
  FiAlertTriangle,
  FiBriefcase,
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiSearch,
  FiShield,
  FiTarget,
  FiTrendingUp,
  FiUser,
  FiUsers,
  FiZap,
} from "react-icons/fi";

import { fetchApi } from "@/lib/api";
import { unwrapEnvelopeData } from "@/lib/apiEnvelope";
import type { CompanyRow, Stats } from "@/lib/quality";
import { buildPieGradient } from "./pieChartUtils";
import QualityControlOverviewBoard from "./QualityControlOverviewBoard";

type Overview = {
  companies: CompanyRow[];
  releaseCount: number;
  globalStats: Stats;
  globalPassRate: number | null;
  projectRows?: Array<{ id: string; name: string; releaseCount: number }>;
};

type Audit = {
  id: string;
  created_at: string;
  actor_email: string | null;
  action: string;
  entity_label: string | null;
  entity_type?: string | null;
};

type Defect = {
  id: string;
  title: string;
  status: string;
  run_id?: string | number | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type AdminUser = {
  id?: string;
  name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
  avatarUrl?: string | null;
  image?: string | null;
  role?: string | null;
  permissionRole?: string | null;
  companyRole?: string | null;
  profileLabel?: string | null;
};

type ActorProfile = { name: string; avatar: string | null };
type Mode = "company" | "user";
type Slice = { label: string; value: number; color: string };
type RunRow = {
  id: string;
  title: string;
  companyName: string;
  project: string;
  total: number;
  pass: number;
  fail: number;
  blocked: number;
  notRun: number;
};

const FIRST_ITEMS = 6;
const FIRST_EVENTS = 6;
const periods = [7, 30, 90] as const;

const contextCard =
  "group relative flex h-28 w-56 shrink-0 flex-col justify-between overflow-hidden rounded-3xl border border-[var(--tc-border)] bg-white/85 px-4 py-3 text-left shadow-[0_16px_34px_rgba(1,24,72,.08)] transition hover:-translate-y-0.5 hover:border-[rgba(239,0,1,.28)] hover:bg-white dark:bg-white/[0.04] dark:hover:bg-white/[0.07]";
const contextCardSelected =
  "group relative flex h-28 w-56 shrink-0 flex-col justify-between overflow-hidden rounded-3xl border border-[rgba(239,0,1,.58)] bg-white px-4 py-3 text-left shadow-[inset_5px_0_0_var(--tc-accent),0_22px_46px_rgba(1,24,72,.14)] ring-2 ring-[rgba(239,0,1,.10)] dark:bg-white/[0.07]";

function normalize(value?: string | null) {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function total(stats?: Stats | null) {
  return stats ? stats.pass + stats.fail + stats.blocked + stats.notRun : 0;
}

function keyOf(company: CompanyRow) {
  return company.slug ?? company.id;
}

function shortDate(value?: string | null) {
  if (!value) return "--";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString("pt-BR") : "--";
}

function shortDateTime(value?: string | null) {
  if (!value) return "Sem horário";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Sem horário";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function nameFromEmail(email?: string | null) {
  if (!email) return "Sistema";
  return email
    .split("@")[0]
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function avatarFromUser(user?: AdminUser | null) {
  return user?.avatar_url ?? user?.avatarUrl ?? user?.image ?? null;
}

function profileTag(user: AdminUser) {
  const raw = normalize(user.profileLabel ?? user.permissionRole ?? user.role ?? user.companyRole ?? "Usuário");
  if (raw.includes("leader") || raw.includes("lider")) return "Líder TC";
  if (raw.includes("support") || raw.includes("suporte")) return "Suporte";
  if (raw.includes("testing") || raw.includes("tc")) return "Usuário TC";
  if (raw.includes("empresa") || raw.includes("company")) return "Empresa";
  return "Usuário";
}

function daysBetween(start: string, end: string) {
  const startAt = new Date(`${start}T00:00:00`).getTime();
  const endAt = new Date(`${end}T23:59:59`).getTime();
  return Number.isFinite(startAt) && Number.isFinite(endAt) && endAt >= startAt
    ? Math.max(1, Math.ceil((endAt - startAt) / 86400000))
    : 30;
}

function mergeStats(releases: CompanyRow["releases"]): Stats {
  return releases.reduce<Stats>(
    (acc, item) => {
      if (!item.stats) return acc;
      acc.pass += item.stats.pass;
      acc.fail += item.stats.fail;
      acc.blocked += item.stats.blocked;
      acc.notRun += item.stats.notRun;
      return acc;
    },
    { pass: 0, fail: 0, blocked: 0, notRun: 0 },
  );
}

function isInsidePeriod(value: string | null | undefined, period: number, from: string, to: string) {
  if (!value) return false;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return false;

  if (from && to) {
    const startAt = new Date(`${from}T00:00:00`).getTime();
    const endAt = new Date(`${to}T23:59:59`).getTime();
    return Number.isFinite(startAt) && Number.isFinite(endAt) && time >= startAt && time <= endAt;
  }

  return time >= Date.now() - period * 86400000;
}

function humanizeAction(action: string) {
  return action.replace(/[_-]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").trim();
}

function eventMatchesCompany(item: Audit, company: CompanyRow | null) {
  if (!company) return true;
  const text = normalize(`${item.entity_label ?? ""} ${item.entity_type ?? ""} ${item.action}`);
  const name = normalize(company.name);
  const slug = normalize(company.slug);
  return Boolean((name && text.includes(name)) || (slug && text.includes(slug)));
}

function statusTone(value: number) {
  if (value >= 85) return "text-emerald-300";
  if (value >= 65) return "text-amber-200";
  return "text-rose-200";
}

function resolveHealth(passRate: number | null, defectsInPeriod: number) {
  if (passRate === null) return { label: "Sem dados", detail: "Aguardando runs com estatísticas", tone: "border-white/12 bg-white/8 text-white" };
  if (defectsInPeriod > 0 && passRate < 70) return { label: "Atenção alta", detail: "Falhas e defeitos precisam de foco", tone: "border-rose-300/45 bg-rose-500/16 text-rose-50" };
  if (passRate < 85) return { label: "Monitorar", detail: "Qualidade abaixo da meta ideal", tone: "border-amber-300/45 bg-amber-500/16 text-amber-50" };
  return { label: "Saudável", detail: "Operação dentro do esperado", tone: "border-emerald-300/45 bg-emerald-500/16 text-emerald-50" };
}

function runTitle(release: CompanyRow["releases"][number], index: number) {
  const record = release as unknown as Record<string, unknown>;
  const title = record.title ?? record.name ?? record.runName ?? record.code ?? record.id;
  return typeof title === "string" && title.trim() ? title.trim() : `Run ${index + 1}`;
}

function runProject(release: CompanyRow["releases"][number]) {
  const record = release as unknown as Record<string, unknown>;
  const value = record.project ?? record.app ?? record.qaseProject ?? record.application;
  return typeof value === "string" && value.trim() ? value.trim() : "Projeto não informado";
}

function buildRunRows(companies: CompanyRow[], selectedCompany: CompanyRow | null): RunRow[] {
  const source = selectedCompany ? [selectedCompany] : companies;
  return source.flatMap((entry) =>
    entry.releases.map((release, index) => {
      const stats = release.stats ?? { pass: 0, fail: 0, blocked: 0, notRun: 0 };
      return {
        id: `${keyOf(entry)}-${runTitle(release, index)}-${index}`,
        title: runTitle(release, index),
        companyName: entry.name,
        project: runProject(release),
        total: total(stats),
        pass: stats.pass,
        fail: stats.fail,
        blocked: stats.blocked,
        notRun: stats.notRun,
      };
    }),
  );
}

function eventKind(item: Audit) {
  const text = normalize(`${item.action} ${item.entity_type ?? ""} ${item.entity_label ?? ""}`);
  const action = humanizeAction(item.action);

  if (/perfil|profile|role/.test(text) && /permission|permissao|access|acesso|update|alter|reset/.test(text)) return { title: "Permissão de perfil alterada", detail: "Perfil teve matriz de acesso atualizada.", color: "bg-cyan-500" };
  if (/usuario|user/.test(text) && /permission|permissao|access|acesso|role|perfil|update|alter/.test(text)) return { title: "Permissão de usuário alterada", detail: "Usuário teve acesso, vínculo ou perfil atualizado.", color: "bg-cyan-500" };
  if (/defeito|defect|bug|falha/.test(text) && /create|created|criou|novo|open|opened|abert/.test(text)) return { title: "Defeito aberto", detail: "Registro de defeito criado no período filtrado.", color: "bg-rose-500" };
  if (/defeito|defect|bug|falha/.test(text) && /status|update|alter|resolved|closed|fech|conclu/.test(text)) return { title: "Status de defeito alterado", detail: "Defeito teve mudança de status ou atualização.", color: "bg-rose-500" };
  if (/run|execu/.test(text) && /finish|finished|closed|completed|finaliz|conclu/.test(text)) return { title: "Run finalizada", detail: "Execução encerrada dentro do período filtrado.", color: "bg-emerald-500" };
  if (/run|execu/.test(text) && /create|created|criou|novo|open|opened|abert/.test(text)) return { title: "Run criada", detail: "Nova execução criada no período filtrado.", color: "bg-violet-500" };
  if (/run|execu/.test(text) && /status|update|alter|andamento|progress/.test(text)) return { title: "Status da run alterado", detail: "Execução teve alteração de andamento ou status.", color: "bg-violet-500" };
  if (/plano|plan/.test(text) && /create|created|criou|novo/.test(text)) return { title: "Plano de teste criado", detail: "Novo plano de teste registrado no período.", color: "bg-emerald-500" };
  if (/plano|plan/.test(text)) return { title: "Plano de teste atualizado", detail: "Plano de teste teve alteração ou movimentação.", color: "bg-emerald-500" };
  if (/caso|case|teste|test/.test(text) && /finish|finished|finaliz|conclu|passed|failed|blocked|execut/.test(text)) return { title: "Teste finalizado", detail: "Caso de teste recebeu resultado de execução.", color: "bg-sky-500" };
  if (/caso|case|teste|test|repositorio/.test(text) && /create|created|criou|novo/.test(text)) return { title: "Caso de teste criado", detail: "Novo caso de teste registrado no repositório.", color: "bg-sky-500" };
  if (/ticket|chamado|suporte|support/.test(text)) return { title: "Chamado de suporte movimentado", detail: "Chamado ou solicitação recebeu ação no período.", color: "bg-amber-500" };
  if (/empresa|company|projeto|project/.test(text) && /create|created|criou|novo/.test(text)) return { title: "Empresa ou projeto criado", detail: "Cadastro institucional criado no período.", color: "bg-indigo-500" };
  if (/empresa|company|projeto|project/.test(text)) return { title: "Empresa ou projeto atualizado", detail: "Cadastro institucional recebeu alteração.", color: "bg-indigo-500" };
  if (/delete|deleted|remove|removed|exclu|apag/.test(text)) return { title: "Exclusão realizada", detail: "Item foi removido ou desvinculado no período.", color: "bg-red-500" };
  if (/status|update|alter|mudou|troca/.test(text)) return { title: "Status atualizado", detail: "Item do sistema teve status ou dados alterados.", color: "bg-sky-500" };
  if (/create|created|criou|novo|nova/.test(text)) return { title: "Criação registrada", detail: "Novo item criado no sistema.", color: "bg-emerald-500" };

  return { title: `Ação registrada: ${action || "sistema"}`, detail: "Ação do sistema sem categoria específica mapeada ainda.", color: "bg-slate-500" };
}

function eventDetail(item: Audit, actorName: string) {
  const target = item.entity_label?.trim() || humanizeAction(item.action) || "item do sistema";
  const type = item.entity_type?.trim() ? ` em ${humanizeAction(item.entity_type)}` : "";
  return `${actorName} movimentou ${target}${type} às ${shortDateTime(item.created_at)}.`;
}

function StatCard({ icon: Icon, value, label, note }: { icon: IconType; value: string | number; label: string; note?: string }) {
  return (
    <div className="group flex h-full min-h-[152px] flex-col justify-between rounded-[26px] border border-white/15 bg-white/10 p-4 text-white shadow-[0_18px_38px_rgba(1,24,72,.12)] backdrop-blur-sm ring-1 ring-white/5 transition hover:-translate-y-0.5 hover:bg-white/15">
      <div className="flex items-start justify-between gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-2xl border border-white/15 bg-white/10 text-white/80">
          <Icon />
        </div>
        <FiTrendingUp className="mt-1 text-white/30 transition group-hover:text-white/70" />
      </div>
      <div>
        <b className="mt-4 block text-3xl leading-none tracking-[-.05em]">{value}</b>
        <small className="mt-2 block text-xs font-black uppercase tracking-[.16em] text-white/62">{label}</small>
        {note ? <p className="mt-2 text-xs font-semibold text-white/52">{note}</p> : null}
      </div>
    </div>
  );
}

function RoundUserAvatar({ src, name, size = "md" }: { src?: string | null; name: string; size?: "sm" | "md" }) {
  const boxSize = size === "sm" ? "h-10 w-10" : "h-12 w-12";
  const iconSize = size === "sm" ? 18 : 21;

  return (
    <div className={`${boxSize} flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/70 bg-[#e8edf5] text-[#64748b] shadow-[0_10px_22px_rgba(1,24,72,.08)] ring-1 ring-black/5 dark:border-white/20 dark:bg-[#dce3ee] dark:text-[#64748b]`}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} className="h-full w-full rounded-full object-cover" />
      ) : (
        <FiUser size={iconSize} strokeWidth={2.6} />
      )}
    </div>
  );
}

function RoundCompanyAvatar({ company }: { company?: CompanyRow | null }) {
  const logo = company?.logo ?? null;
  const name = company?.name ?? "Empresa";

  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/70 bg-[#e8edf5] text-[#64748b] shadow-[0_10px_22px_rgba(1,24,72,.08)] ring-1 ring-black/5 dark:border-white/20 dark:bg-[#dce3ee] dark:text-[#64748b]">
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt={name} className="h-full w-full rounded-full object-cover" />
      ) : (
        <FiBriefcase size={20} strokeWidth={2.4} />
      )}
    </div>
  );
}

function EventAvatar({ email, profile }: { email: string | null; profile?: ActorProfile }) {
  const name = profile?.name ?? nameFromEmail(email);
  return <RoundUserAvatar src={profile?.avatar ?? null} name={name} size="sm" />;
}

function CommandPill({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full border border-white/12 bg-white/8 px-3 py-1 text-[11px] font-black uppercase tracking-[.16em] text-white/62">{children}</span>;
}

function Pie({ title, slices, note, contextLabel }: { title: string; note: string; contextLabel: string; slices: Slice[] }) {
  const [activeLabel, setActiveLabel] = useState<string | null>(null);
  const visibleSlices = slices.filter((slice) => slice.value > 0);
  const sum = visibleSlices.reduce((acc, slice) => acc + slice.value, 0);
  if (!sum) return null;

  const activeSlice = visibleSlices.find((slice) => slice.label === activeLabel) ?? visibleSlices[0];
  const activePercent = Math.round((activeSlice.value / sum) * 100);

  return (
    <section className="overflow-hidden rounded-[30px] border border-[var(--tc-border)] bg-white/85 p-4 shadow-[0_18px_36px_rgba(1,24,72,.08)] dark:bg-white/[0.045]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[.18em] text-[#64748b] dark:text-white/45">{contextLabel}</p>
          <h2 className="mt-1 text-lg font-black tracking-[-.03em]">{title}</h2>
          <p className="mt-1 text-sm text-[#64748b] dark:text-white/60">{note}</p>
        </div>
        <div className="group relative grid place-items-center">
          <div
            className="relative h-36 w-36 rounded-full shadow-[inset_0_0_0_1px_rgba(255,255,255,.18),0_18px_45px_rgba(15,23,42,.14)] transition duration-300 group-hover:scale-[1.03]"
            style={{ background: buildPieGradient(visibleSlices) }}
            tabIndex={0}
            aria-label={`${title}: ${activeSlice.label}, ${activePercent}%`}
          >
            <div className="absolute inset-9 flex flex-col items-center justify-center rounded-full bg-white text-center text-[#011848] shadow-inner dark:bg-[#07111f] dark:text-white">
              <b className="text-2xl leading-none">{activePercent}%</b>
              <small className="mt-1 max-w-[74px] truncate text-[10px] font-black uppercase tracking-[.12em] text-[#64748b] dark:text-white/45">{activeSlice.label}</small>
            </div>
          </div>
          <div className="pointer-events-none absolute -top-2 left-1/2 hidden -translate-x-1/2 -translate-y-full rounded-2xl border border-[var(--tc-border)] bg-white px-3 py-2 text-xs font-black text-[#011848] shadow-2xl group-hover:block group-focus-within:block dark:bg-[#07111f] dark:text-white">
            {activeSlice.label}: {activeSlice.value} · {activePercent}%
          </div>
        </div>
      </div>
      <div className="mt-4 grid gap-2">
        {visibleSlices.map((slice) => {
          const percent = Math.round((slice.value / sum) * 100);
          const active = activeSlice.label === slice.label;
          return (
            <button
              key={slice.label}
              type="button"
              onMouseEnter={() => setActiveLabel(slice.label)}
              onFocus={() => setActiveLabel(slice.label)}
              onClick={() => setActiveLabel(slice.label)}
              className={`flex items-center justify-between rounded-2xl border px-3 py-2 text-sm transition ${active ? "border-[rgba(239,0,1,.34)] bg-[rgba(239,0,1,.06)]" : "border-[var(--tc-border)] bg-transparent hover:bg-black/[0.025] dark:hover:bg-white/[0.04]"}`}
              title={`${slice.label}: ${slice.value} (${percent}%)`}
            >
              <span className="flex min-w-0 items-center gap-2 text-[#64748b] dark:text-white/60">
                <i className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: slice.color }} />
                <span className="truncate">{slice.label}</span>
              </span>
              <b className="shrink-0">{slice.value} · {percent}%</b>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default function VisaoGeralCompacta() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [defects, setDefects] = useState<Defect[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [actorProfiles, setActorProfiles] = useState<Record<string, ActorProfile>>({});
  const [period, setPeriod] = useState<(typeof periods)[number]>(30);
  const [mode, setMode] = useState<Mode>("company");
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [draftFrom, setDraftFrom] = useState("");
  const [draftTo, setDraftTo] = useState("");
  const [showCalendar, setShowCalendar] = useState(false);
  const [visibleCards, setVisibleCards] = useState(FIRST_ITEMS);
  const [visibleEvents, setVisibleEvents] = useState(FIRST_EVENTS);
  const [loading, setLoading] = useState(false);
  const [loadingActivity, setLoadingActivity] = useState(false);

  const hasRange = Boolean(from && to);
  const effectivePeriod = hasRange ? daysBetween(from, to) : period;

  useEffect(() => {
    let ok = true;
    setLoading(true);
    const params = new URLSearchParams({ period: String(effectivePeriod) });
    if (hasRange) {
      params.set("start", from);
      params.set("end", to);
    }
    fetchApi(`/api/admin/quality/overview?${params.toString()}`, { cache: "no-store" })
      .then((response) => response.json().then((json) => ({ response, json })).catch(() => ({ response, json: null })))
      .then(({ response, json }) => ok && setOverview(response.ok ? unwrapEnvelopeData<Overview>(json) ?? json : null))
      .catch(() => ok && setOverview(null))
      .finally(() => ok && setLoading(false));
    return () => {
      ok = false;
    };
  }, [effectivePeriod, from, hasRange, to]);

  useEffect(() => {
    let ok = true;
    setLoadingActivity(true);
    const id = window.setTimeout(() => {
      const auditParams = new URLSearchParams({ limit: String(Math.max(12, visibleEvents + FIRST_EVENTS)), period: String(effectivePeriod) });
      if (hasRange) {
        auditParams.set("start", from);
        auditParams.set("end", to);
      }
      Promise.all([
        fetchApi(`/api/admin/audit-logs?${auditParams.toString()}`, { cache: "no-store" }),
        fetchApi(selectedCompany ? `/api/admin/defeitos?company=${encodeURIComponent(selectedCompany)}` : "/api/admin/defeitos", { cache: "no-store" }),
      ])
        .then(async ([auditResponse, defectResponse]) => {
          const auditJson = await auditResponse.json().catch(() => null);
          const defectJson = await defectResponse.json().catch(() => null);
          const auditData = auditResponse.ok ? unwrapEnvelopeData<{ items?: Audit[] }>(auditJson) ?? auditJson : null;
          const defectData = defectResponse.ok ? unwrapEnvelopeData<{ items?: Defect[] }>(defectJson) ?? defectJson : null;
          if (!ok) return;
          setAudit(Array.isArray(auditData?.items) ? auditData.items : []);
          setDefects(Array.isArray(defectData?.items) ? defectData.items : []);
        })
        .catch(() => {
          if (!ok) return;
          setAudit([]);
          setDefects([]);
        })
        .finally(() => ok && setLoadingActivity(false));
    }, 250);
    return () => {
      ok = false;
      window.clearTimeout(id);
    };
  }, [effectivePeriod, from, hasRange, selectedCompany, to, visibleEvents]);

  useEffect(() => {
    let ok = true;
    const id = window.setTimeout(() => {
      fetchApi("/api/admin/users", { cache: "no-store" })
        .then((response) => response.json().then((json) => ({ response, json })).catch(() => ({ response, json: null })))
        .then(({ response, json }) => {
          if (!ok || !response.ok) return;
          const envelopedData = unwrapEnvelopeData<{ items?: AdminUser[] }>(json);
          const rawData = (envelopedData ?? json) as { items?: unknown } | null;
          const items: AdminUser[] = Array.isArray(rawData?.items) ? (rawData.items as AdminUser[]) : [];
          setAdminUsers(items);

          const next: Record<string, ActorProfile> = {};
          items.forEach((user) => {
            const email = user.email?.trim();
            if (!email) return;
            next[email] = { name: user.name?.trim() || nameFromEmail(email), avatar: avatarFromUser(user) };
          });
          setActorProfiles((current) => ({ ...current, ...next }));
        })
        .catch(() => undefined);
    }, 650);

    return () => {
      ok = false;
      window.clearTimeout(id);
    };
  }, []);

  useEffect(() => {
    setVisibleCards(FIRST_ITEMS);
    setVisibleEvents(FIRST_EVENTS);
  }, [mode, query, selectedCompany, selectedUser, effectivePeriod]);

  const companies = overview?.companies ?? [];
  const company = selectedCompany ? companies.find((entry) => keyOf(entry) === selectedCompany) ?? null : null;
  const releases = company ? company.releases : companies.flatMap((entry) => entry.releases);
  const stats = company ? mergeStats(company.releases) : overview?.globalStats ?? null;
  const filteredCompanies = useMemo(() => companies.filter((entry) => normalize(`${entry.name} ${entry.slug ?? ""}`).includes(normalize(query))), [companies, query]);
  const shownCompanies = filteredCompanies.slice(0, visibleCards);
  const filteredUsers = useMemo(() => adminUsers.filter((user) => normalize(`${user.name ?? ""} ${user.email ?? ""} ${profileTag(user)}`).includes(normalize(query))), [adminUsers, query]);
  const shownUsers = filteredUsers.slice(0, visibleCards);
  const filteredEvents = audit
    .filter((event) => isInsidePeriod(event.created_at, effectivePeriod, from, to))
    .filter((event) => eventMatchesCompany(event, company))
    .filter((event) => !selectedUser || event.actor_email === selectedUser);
  const shownEvents = filteredEvents.slice(0, visibleEvents);
  const defectsInPeriod = defects.filter((defect) => isInsidePeriod(defect.created_at ?? defect.updated_at, effectivePeriod, from, to));
  const linkedDefects = defectsInPeriod.filter((defect) => defect.run_id !== null && defect.run_id !== undefined && String(defect.run_id).trim()).length;
  const testCaseCount = total(stats);
  const planCount = company ? Math.max(0, new Set(company.releases.map((release) => {
    const row = release as unknown as Record<string, unknown>;
    return row.project ?? row.app ?? row.qaseProject ?? row.title ?? row.name;
  }).filter(Boolean)).size) : overview?.projectRows?.length ?? 0;
  const statsTotal = total(stats);
  const passRate = stats && statsTotal > 0 ? Math.round((stats.pass / statsTotal) * 100) : null;
  const health = resolveHealth(passRate, defectsInPeriod.length);
  const hasInsightCards = statsTotal > 0 || defectsInPeriod.length > 0 || releases.length > 0;
  const selectedContextLabel = company?.name ?? (mode === "user" ? (selectedUser ? nameFromEmail(selectedUser) : "Todos os usuários") : "Todas as empresas");
  const periodLabel = hasRange ? `${shortDate(from)} até ${shortDate(to)}` : `últimos ${period} dias`;
  const runRows = buildRunRows(companies, company);
  const contextExplanation = mode === "company"
    ? company
      ? `Mostrando apenas a empresa ${company.name} em ${periodLabel}.`
      : `Mostrando a saúde consolidada de todas as empresas em ${periodLabel}.`
    : selectedUser
      ? `Mostrando movimentações do usuário ${nameFromEmail(selectedUser)} em ${periodLabel}.`
      : `Mostrando movimentações de todos os usuários em ${periodLabel}.`;

  return (
    <div className="text-[#011848] dark:text-white">
      <div className="flex flex-col gap-6 px-3 py-4 sm:px-4 lg:px-8">
        <section className="relative overflow-visible rounded-[34px] border border-white/14 bg-[radial-gradient(circle_at_10%_8%,rgba(239,0,1,.30),transparent_26%),radial-gradient(circle_at_82%_18%,rgba(59,130,246,.26),transparent_32%),linear-gradient(135deg,#040814_0%,#07111f_52%,#0b1932_100%)] p-5 text-white shadow-[0_28px_90px_rgba(1,24,72,.28)] sm:p-6 lg:p-7">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/45 to-transparent" />
          <div className="relative z-10 grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_380px]">
            <div className="min-w-0">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <CommandPill>Central de Qualidade</CommandPill>
                <CommandPill>{selectedContextLabel}</CommandPill>
                <CommandPill>{periodLabel}</CommandPill>
                {loading || loadingActivity ? <CommandPill>Atualizando dados</CommandPill> : <CommandPill>Dados prontos</CommandPill>}
              </div>
              <h1 className="max-w-5xl text-4xl font-black leading-[.95] tracking-[-.06em] sm:text-5xl xl:text-6xl">
                Controle real da qualidade
              </h1>
              <p className="mt-4 max-w-3xl text-base font-semibold leading-relaxed text-white/68 sm:text-lg">
                {contextExplanation} A leitura agora junta runs, defeitos, planos, casos, solicitações, agenda, gestão e usuários no mesmo contexto.
              </p>

              <div className="mt-6 grid items-stretch gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard icon={FiActivity} value={releases.length} label="Runs" note={`${selectedContextLabel} · ${periodLabel}`} />
                <StatCard icon={FiShield} value={passRate === null ? "--" : `${passRate}%`} label="Aprovação" note="taxa do contexto filtrado" />
                <StatCard icon={FiAlertTriangle} value={defectsInPeriod.length} label="Defeitos" note={`${linkedDefects} vinculados a runs`} />
                <StatCard icon={FiUsers} value={filteredEvents.length} label="Movimentações" note="ações rastreadas" />
              </div>
            </div>

            <aside className={`flex min-h-[280px] flex-col justify-between rounded-[30px] border p-5 backdrop-blur ${health.tone}`}>
              <div>
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-full border border-white/15 bg-black/12 px-3 py-1 text-[11px] font-black uppercase tracking-[.18em] text-white/72">Saúde do filtro</span>
                  <FiZap className="text-white/72" />
                </div>
                <h2 className="mt-5 text-4xl font-black tracking-[-.06em]">{health.label}</h2>
                <p className="mt-2 text-sm font-semibold text-white/70">{health.detail}</p>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-white/12 bg-black/12 p-3"><p className="text-[10px] font-black uppercase tracking-[.16em] text-white/48">Filtro</p><p className="mt-1 truncate text-sm font-black">{selectedContextLabel}</p></div>
                <div className="rounded-2xl border border-white/12 bg-black/12 p-3"><p className="text-[10px] font-black uppercase tracking-[.16em] text-white/48">Planos</p><p className="mt-1 text-sm font-black">{planCount}</p></div>
                <div className="rounded-2xl border border-white/12 bg-black/12 p-3"><p className="text-[10px] font-black uppercase tracking-[.16em] text-white/48">Casos</p><p className="mt-1 text-sm font-black">{testCaseCount}</p></div>
                <div className="rounded-2xl border border-white/12 bg-black/12 p-3"><p className="text-[10px] font-black uppercase tracking-[.16em] text-white/48">Empresas</p><p className="mt-1 text-sm font-black">{company ? 1 : companies.length}</p></div>
              </div>
            </aside>
          </div>

          <div className="relative z-[70] mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/12 pt-4">
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => { setMode("company"); setSelectedUser(null); }} className={mode === "company" ? "tc-button-primary" : "tc-button-secondary"}><FiBriefcase /> Empresa</button>
              <button type="button" onClick={() => { setMode("user"); setSelectedCompany(null); }} className={mode === "user" ? "tc-button-primary" : "tc-button-secondary"}><FiUsers /> Usuário</button>
            </div>
            <div className="relative z-[80] flex flex-wrap gap-2">
              <div className="flex gap-1 rounded-2xl border border-white/16 bg-white/10 p-1">
                {periods.map((item) => (
                  <button key={item} type="button" onClick={() => { setPeriod(item); setFrom(""); setTo(""); setShowCalendar(false); }} className={!hasRange && period === item ? "rounded-xl bg-white px-3 py-2 text-xs font-black text-[#011848]" : "rounded-xl px-3 py-2 text-xs font-black text-white/75"}>
                    {item === 7 ? "Semana" : `${item} dias`}
                  </button>
                ))}
                <button type="button" onClick={() => setShowCalendar((value) => !value)} className={hasRange ? "rounded-xl bg-white px-3 py-2 text-xs font-black text-[#011848]" : "rounded-xl px-3 py-2 text-xs font-black text-white/75"}>
                  <FiCalendar className="inline" /> Período
                </button>
              </div>
              {showCalendar ? (
                <div className="absolute right-0 top-[calc(100%+.5rem)] z-[999] w-80 rounded-3xl border border-slate-200 bg-white p-4 text-[#011848] shadow-[0_32px_80px_rgba(15,23,42,.28)] ring-1 ring-black/5 dark:border-white/12 dark:bg-[#07111f] dark:text-white">
                  <p className="text-xs font-black uppercase tracking-[.22em] text-[var(--tc-text-muted)]">Filtrar por período</p>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <label className="text-xs font-bold">De<input type="date" value={draftFrom} onChange={(event) => setDraftFrom(event.target.value)} className="mt-1 w-full rounded-xl border border-[var(--tc-border)] bg-white px-3 py-2 dark:bg-[#0b1628]" /></label>
                    <label className="text-xs font-bold">Até<input type="date" value={draftTo} onChange={(event) => setDraftTo(event.target.value)} className="mt-1 w-full rounded-xl border border-[var(--tc-border)] bg-white px-3 py-2 dark:bg-[#0b1628]" /></label>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button type="button" onClick={() => { if (draftFrom && draftTo) { setFrom(draftFrom); setTo(draftTo); setShowCalendar(false); } }} className="rounded-xl bg-[var(--tc-primary)] px-3 py-2 text-xs font-black text-white">Aplicar</button>
                    <button type="button" onClick={() => { setFrom(""); setTo(""); setDraftFrom(""); setDraftTo(""); setShowCalendar(false); }} className="rounded-xl border border-[var(--tc-border)] px-3 py-2 text-xs font-black">Limpar</button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <section className="rounded-[30px] border border-[var(--tc-border)] bg-white/78 p-4 shadow-[0_18px_46px_rgba(1,24,72,.08)] dark:bg-white/[0.035]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-black tracking-[-.04em]">Mapa de contexto</h2>
              <p className="mt-1 text-sm text-[#64748b] dark:text-white/60">A mesma estrutura aparece de forma geral em todas as empresas ou individualmente ao selecionar uma empresa.</p>
            </div>
            <label className="w-full lg:max-w-md">
              <div className="flex w-full items-center gap-3 rounded-[20px] border border-[var(--tc-border)] bg-white/65 px-4 py-3 dark:bg-white/[0.04]">
                <FiSearch />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={mode === "company" ? "Buscar empresa" : "Buscar usuário, e-mail ou perfil"} className="w-full bg-transparent text-sm outline-none" />
              </div>
            </label>
          </div>
          <div className="mt-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex min-w-max gap-3">
              {mode === "company" ? (
                <>
                  <button type="button" onClick={() => setSelectedCompany(null)} className={selectedCompany === null ? contextCardSelected : contextCard}>
                    <RoundCompanyAvatar />
                    <span className="min-w-0"><b className="line-clamp-1">Todas as empresas</b><p className="text-sm text-[#64748b] dark:text-white/60">{companies.length} empresas · visão completa</p></span>
                  </button>
                  {shownCompanies.map((entry) => (
                    <button key={keyOf(entry)} type="button" onClick={() => setSelectedCompany(keyOf(entry))} className={selectedCompany === keyOf(entry) ? contextCardSelected : contextCard}>
                      <RoundCompanyAvatar company={entry} />
                      <span className="min-w-0"><b className="line-clamp-1">{entry.name}</b><p className="text-xs text-[#64748b] dark:text-white/60">{entry.releases.length} runs · {entry.passRate ?? "--"}% aprovação</p></span>
                    </button>
                  ))}
                  {filteredCompanies.length > shownCompanies.length ? <button type="button" onClick={() => setVisibleCards((value) => value + FIRST_ITEMS)} className={contextCard}><RoundCompanyAvatar /><span><b>Ver mais empresas</b><p className="text-sm text-[#64748b] dark:text-white/60">Carregar mais</p></span></button> : null}
                </>
              ) : (
                <>
                  <button type="button" onClick={() => setSelectedUser(null)} className={selectedUser === null ? contextCardSelected : contextCard}>
                    <RoundUserAvatar name="Todos os usuários" />
                    <span><b>Todos os usuários</b><p className="text-sm text-[#64748b] dark:text-white/60">Histórico geral</p></span>
                  </button>
                  {shownUsers.map((user) => {
                    const email = user.email?.trim() ?? user.id ?? "";
                    const selected = selectedUser === email;
                    const name = user.name?.trim() || nameFromEmail(email);
                    return (
                      <button key={email} type="button" onClick={() => setSelectedUser(email)} className={selected ? contextCardSelected : contextCard}>
                        <RoundUserAvatar src={avatarFromUser(user)} name={name} />
                        <span className="min-w-0"><b className="line-clamp-1">{name}</b><p className="truncate text-xs text-[#64748b] dark:text-white/60">{email}</p><small className="mt-1 inline-flex rounded-full bg-[rgba(1,24,72,.08)] px-2 py-0.5 text-[10px] font-black uppercase tracking-[.12em] text-[#011848] dark:bg-white/10 dark:text-white/70">{profileTag(user)}</small></span>
                      </button>
                    );
                  })}
                  {filteredUsers.length > shownUsers.length ? <button type="button" onClick={() => setVisibleCards((value) => value + FIRST_ITEMS)} className={contextCard}><RoundUserAvatar name="Ver mais usuários" /><span><b>Ver mais usuários</b><p className="text-sm text-[#64748b] dark:text-white/60">Carregar mais</p></span></button> : null}
                </>
              )}
            </div>
          </div>
        </section>

        <QualityControlOverviewBoard
          companies={companies}
          selectedCompany={company}
          audit={filteredEvents}
          defectsInPeriod={defectsInPeriod}
          adminUsers={adminUsers}
          runRows={runRows}
          stats={stats}
          planCount={planCount}
          testCaseCount={testCaseCount}
          passRate={passRate}
          selectedContextLabel={selectedContextLabel}
          periodLabel={periodLabel}
          mode={mode}
          selectedUser={selectedUser}
        />

        <div className={hasInsightCards ? "grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]" : "grid gap-6"}>
          <section className="min-w-0 rounded-[30px] border border-[var(--tc-border)] bg-white/78 p-5 shadow-[0_18px_46px_rgba(1,24,72,.08)] dark:bg-white/[0.035]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[.18em] text-[#64748b] dark:text-white/45">{selectedContextLabel} · {periodLabel}</p>
                <h2 className="mt-1 text-2xl font-black tracking-[-.05em]">Movimentações do período</h2>
                <p className="mt-1 max-w-3xl text-sm text-[#64748b] dark:text-white/60">Criação, mudança de status, runs, planos, testes, defeitos, suporte, perfis e usuários com ator e horário.</p>
              </div>
              <span className="rounded-full border border-[var(--tc-border)] px-3 py-2 text-xs font-black uppercase tracking-[.14em] text-[#64748b] dark:text-white/55">
                {loadingActivity ? "Carregando" : `${filteredEvents.length} eventos`}
              </span>
            </div>
            <div className="mt-5 space-y-0">
              {shownEvents.length ? (
                shownEvents.map((event, index) => {
                  const meta = eventKind(event);
                  const profile = event.actor_email ? actorProfiles[event.actor_email] : undefined;
                  const actorName = profile?.name ?? nameFromEmail(event.actor_email);
                  return (
                    <div key={event.id} className="relative flex gap-4 pb-6">
                      <div className="flex flex-col items-center">
                        <EventAvatar email={event.actor_email} profile={profile} />
                        {index < shownEvents.length - 1 ? <span className="mt-2 h-full min-h-10 w-px bg-[var(--tc-border)]" /> : null}
                      </div>
                      <div className="min-w-0 flex-1 rounded-3xl border border-[var(--tc-border)] bg-white/55 p-4 shadow-sm dark:bg-white/[0.025]">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`h-2.5 w-2.5 rounded-full ${meta.color}`} aria-hidden />
                          <b>{meta.title}</b>
                          <small className="ml-auto text-[#64748b] dark:text-white/50">{shortDateTime(event.created_at)}</small>
                        </div>
                        <p className="mt-1 text-sm text-[#64748b] dark:text-white/60">{eventDetail(event, actorName)}</p>
                        <p className="mt-2 text-sm font-black text-[#011848] dark:text-white">{event.entity_label ?? humanizeAction(event.action)}</p>
                        <small className="mt-2 block text-[#64748b] dark:text-white/50">Ação original: {humanizeAction(event.action)}</small>
                      </div>
                    </div>
                  );
                })
              ) : <p className="py-4 text-sm text-[#64748b] dark:text-white/60">Nenhuma ação encontrada para este contexto no período filtrado.</p>}
              {filteredEvents.length > shownEvents.length ? <button type="button" onClick={() => setVisibleEvents((value) => value + FIRST_EVENTS)} className="w-full rounded-2xl border border-[var(--tc-border)] px-4 py-3 text-sm font-black">Ver mais eventos</button> : null}
            </div>
          </section>

          {hasInsightCards ? (
            <aside className="flex flex-col gap-4 xl:sticky xl:top-4 xl:self-start">
              <section className="rounded-[28px] border border-[var(--tc-border)] bg-white/82 p-4 shadow-[0_18px_36px_rgba(1,24,72,.08)] dark:bg-white/[0.04]">
                <p className="text-[10px] font-black uppercase tracking-[.18em] text-[#64748b] dark:text-white/45">{selectedContextLabel}</p>
                <h2 className="mt-1 text-lg font-black tracking-[-.03em]">Resumo do filtro</h2>
                <p className="mt-1 text-sm text-[#64748b] dark:text-white/60">{contextExplanation}</p>
                <div className="mt-4 grid gap-3">
                  <div className="flex items-center justify-between rounded-2xl border border-[var(--tc-border)] px-3 py-3"><span className="flex items-center gap-2 text-sm font-semibold text-[#64748b] dark:text-white/60"><FiCheckCircle /> Aprovação</span><b className={passRate === null ? "text-[#64748b]" : statusTone(passRate)}>{passRate === null ? "--" : `${passRate}%`}</b></div>
                  <div className="flex items-center justify-between rounded-2xl border border-[var(--tc-border)] px-3 py-3"><span className="flex items-center gap-2 text-sm font-semibold text-[#64748b] dark:text-white/60"><FiTarget /> Casos avaliados</span><b>{testCaseCount}</b></div>
                  <div className="flex items-center justify-between rounded-2xl border border-[var(--tc-border)] px-3 py-3"><span className="flex items-center gap-2 text-sm font-semibold text-[#64748b] dark:text-white/60"><FiClock /> Período</span><b>{periodLabel}</b></div>
                </div>
              </section>
              <Pie title="Runs por status" contextLabel={selectedContextLabel} note={`Todas as runs encontradas em ${periodLabel}`} slices={[{ label: "Aprovados", value: stats?.pass ?? 0, color: "#22c55e" }, { label: "Reprovados", value: stats?.fail ?? 0, color: "#ef4444" }, { label: "Bloqueados", value: stats?.blocked ?? 0, color: "#f59e0b" }, { label: "Em andamento", value: stats?.notRun ?? 0, color: "#60a5fa" }]} />
              <Pie title="Defeitos" contextLabel={selectedContextLabel} note={`${linkedDefects} vinculados a runs · ${defectsInPeriod.length - linkedDefects} soltos`} slices={[{ label: "Com run", value: linkedDefects, color: "#8b5cf6" }, { label: "Soltos", value: defectsInPeriod.length - linkedDefects, color: "#ef4444" }]} />
            </aside>
          ) : null}
        </div>
      </div>
    </div>
  );
}
