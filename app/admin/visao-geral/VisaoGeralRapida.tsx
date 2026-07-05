"use client";

import { useEffect, useMemo, useState } from "react";
import {
  FiActivity,
  FiAlertTriangle,
  FiBarChart2,
  FiBriefcase,
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiSearch,
  FiShield,
  FiUsers,
  FiZap,
} from "react-icons/fi";
import UserAvatar from "@/components/UserAvatar";
import { fetchApi } from "@/lib/api";
import { unwrapEnvelopeData } from "@/lib/apiEnvelope";
import type { CompanyRow, Stats } from "@/lib/quality";

type Overview = {
  companies: CompanyRow[];
  releaseCount: number;
  globalStats: Stats;
  globalPassRate: number | null;
  averageApprovalTimeLabel?: string | null;
  runExecutionsByCompany?: Array<{
    slug: string | null;
    name: string;
    runCount: number;
    runsAtRisk: number;
    activeDefects: number;
    averageApprovalTimeLabel?: string | null;
    latestRunAt?: string | null;
    latestRunTitle?: string | null;
  }>;
  activeDefectCount?: number;
};

type Audit = {
  id: string;
  created_at: string;
  actor_email: string | null;
  entity_label: string | null;
  entity_type?: string | null;
  action: string;
};

type AdminUser = {
  id: string;
  name?: string | null;
  email: string;
  avatar_url?: string | null;
  avatarUrl?: string | null;
  permission_role?: string | null;
  role?: string | null;
  profile_kind?: string | null;
  user_origin?: string | null;
};

type Mode = "company" | "user";
type UserCard = { id: string; name: string; email: string; src: string | null; tag: "Testing Company" | "Empresarial"; moves: number; latest: string | null };
type MetricCard = { id: string; label: string; value: string | number; note: string; icon: typeof FiBarChart2; tone: string };

const periods = [7, 30, 90] as const;
const pageShellClass = "min-h-screen bg-white text-[var(--tc-text-primary)] dark:bg-[#07111f] dark:text-white";
const selectedCardClass = "relative flex w-[78vw] min-w-56 max-w-72 shrink-0 flex-col gap-3 overflow-hidden rounded-3xl border border-[rgba(239,0,1,.28)] bg-[linear-gradient(180deg,#ffffff_0%,#f7faff_100%)] p-4 text-left text-[#011848] shadow-[0_24px_44px_rgba(1,24,72,.12)] ring-1 ring-[rgba(239,0,1,.16)] transition dark:bg-[linear-gradient(180deg,#0f1b30_0%,#13213a_100%)] dark:text-white dark:shadow-[0_24px_44px_rgba(0,0,0,.28)] dark:ring-white/10";
const idleCardClass = "relative flex w-[78vw] min-w-56 max-w-72 shrink-0 flex-col gap-3 overflow-hidden rounded-3xl border border-[var(--tc-border)] bg-white p-4 text-left text-[#011848] transition hover:border-[rgba(239,0,1,.18)] hover:bg-[#f8fbff] hover:shadow-[0_18px_35px_rgba(1,24,72,.08)] dark:bg-[#0b1628] dark:text-white dark:hover:bg-[#101f35]";
const periodActiveClass = "rounded-xl bg-white px-3 py-2 text-xs font-black text-[#011848] shadow-[0_8px_18px_rgba(1,24,72,.16)] ring-1 ring-white/70 transition dark:bg-[#07111f] dark:text-white dark:ring-white/14";
const periodIdleClass = "rounded-xl px-3 py-2 text-xs font-black text-white/78 transition hover:bg-white/12 hover:text-white";

const normalize = (v?: string | null) => (v ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const pct = (v?: number | null) => (v == null ? "--" : `${v}%`);
const shortDate = (v?: string | null) => {
  if (!v) return "--";
  const d = new Date(v);
  return Number.isFinite(d.getTime()) ? d.toLocaleDateString("pt-BR") : "--";
};
const dateTime = (v?: string | null) => {
  if (!v) return "--";
  const d = new Date(v);
  return Number.isFinite(d.getTime()) ? d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "--";
};
const sumStats = (s?: Stats | null) => (s ? s.pass + s.fail + s.blocked + s.notRun : 0);
const mergeStats = (releases: CompanyRow["releases"]) => releases.reduce<Stats>((a, r) => {
  if (!r.stats) return a;
  a.pass += r.stats.pass;
  a.fail += r.stats.fail;
  a.blocked += r.stats.blocked;
  a.notRun += r.stats.notRun;
  return a;
}, { pass: 0, fail: 0, blocked: 0, notRun: 0 });
const keyOf = (c: CompanyRow) => c.slug ?? c.id;
const initials = (v?: string | null) => (v ?? "QC").split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "QC";
const nameFromEmail = (email: string) => email.split("@")[0]?.replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) || email;
const tagOf = (u: Partial<AdminUser> & { email: string }): UserCard["tag"] => normalize(`${u.email} ${u.permission_role ?? ""} ${u.role ?? ""} ${u.profile_kind ?? ""} ${u.user_origin ?? ""}`).match(/company_user|empresa|client_company/) ? "Empresarial" : "Testing Company";

function rangeDays(start: string, end: string) {
  const startTime = new Date(`${start}T00:00:00`).getTime();
  const endTime = new Date(`${end}T23:59:59`).getTime();
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime < startTime) return 30;
  return Math.max(1, Math.ceil((endTime - startTime) / 86_400_000));
}

function inRange(value: string | null | undefined, start: string, end: string) {
  if (!start || !end || !value) return true;
  const time = new Date(value).getTime();
  const startTime = new Date(`${start}T00:00:00`).getTime();
  const endTime = new Date(`${end}T23:59:59`).getTime();
  return Number.isFinite(time) && time >= startTime && time <= endTime;
}

function SelectedStrip() {
  return <span className="absolute inset-y-0 left-0 w-1.5 bg-[linear-gradient(180deg,var(--tc-primary)_0%,var(--tc-accent)_100%)]" aria-hidden />;
}

function Metric({ card }: { card: MetricCard }) {
  const Icon = card.icon;
  return (
    <div className={`rounded-[22px] border px-4 py-3 text-white shadow-[0_18px_38px_rgba(1,24,72,.14)] ${card.tone}`}>
      <div className="flex items-center gap-2 text-[0.62rem] font-black uppercase tracking-[0.22em] text-white/78"><Icon size={14} />{card.label}</div>
      <div className="mt-2 text-2xl font-black leading-none">{card.value}</div>
      <div className="mt-1 text-xs font-semibold leading-5 text-white/72">{card.note}</div>
    </div>
  );
}

function CompanyMark({ company, selected }: { company: CompanyRow; selected: boolean }) {
  return <div className={`flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-[18px] border text-sm font-black shadow-[0_14px_28px_rgba(15,23,42,.08)] ${selected ? "border-[rgba(239,0,1,.22)] bg-[linear-gradient(135deg,rgba(1,24,72,.95)_0%,rgba(239,0,1,.92)_100%)] text-white" : "border-[var(--tc-border)] bg-[linear-gradient(180deg,#ffffff_0%,#eef3ff_100%)] text-[#011848] dark:bg-[linear-gradient(180deg,#101d32_0%,#162742_100%)] dark:text-white"}`}>{company.logo ? <img src={company.logo} alt={`Logo ${company.name}`} className="h-full w-full object-cover" /> : initials(company.name)}</div>;
}

function UserMark({ user, selected }: { user: UserCard; selected: boolean }) {
  return <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] border p-1 shadow-[0_14px_28px_rgba(15,23,42,.08)] ${selected ? "border-[rgba(239,0,1,.22)] bg-[linear-gradient(135deg,rgba(1,24,72,.95)_0%,rgba(239,0,1,.92)_100%)]" : "border-[var(--tc-border)] bg-[linear-gradient(180deg,#ffffff_0%,#eef3ff_100%)] dark:bg-[linear-gradient(180deg,#101d32_0%,#162742_100%)]"}`}><UserAvatar src={user.src} name={user.name} size="sm" frameClassName="border-white/70 shadow-none" fallbackClassName="text-[.7rem] tracking-[.12em]" /></div>;
}

function eventLabel(item: Audit) {
  const text = normalize(`${item.action} ${item.entity_type ?? ""} ${item.entity_label ?? ""}`);
  if (/status|mudou|alterou|updated|update/.test(text)) return { title: "Status atualizado", tone: "bg-sky-500", icon: FiZap };
  if (/run|execu/.test(text)) return { title: "Execução movimentada", tone: "bg-violet-500", icon: FiActivity };
  if (/defeito|defect|bug|falha/.test(text)) return { title: "Defeito movimentado", tone: "bg-rose-500", icon: FiAlertTriangle };
  if (/plano|plan|caso|case|repositorio/.test(text)) return { title: "Teste criado ou atualizado", tone: "bg-emerald-500", icon: FiCheckCircle };
  if (/create|criou|created|novo|nova/.test(text)) return { title: "Criação registrada", tone: "bg-amber-500", icon: FiCalendar };
  return { title: "Movimentação registrada", tone: "bg-slate-500", icon: FiClock };
}

function isMeaningfulEvent(item: Audit) {
  const text = normalize(`${item.action} ${item.entity_type ?? ""} ${item.entity_label ?? ""}`);
  if (!text.trim()) return false;
  if (/usuario|user|perfil|profile/.test(text) && /create|created|criou|novo/.test(text)) return false;
  return /status|mudou|alterou|updated|update|run|execu|defeito|defect|bug|falha|plano|plan|caso|case|repositorio|create|criou|created|novo|nova/.test(text);
}

export default function VisaoGeralRapida() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [period, setPeriod] = useState<(typeof periods)[number]>(30);
  const [mode, setMode] = useState<Mode>("company");
  const [companyKey, setCompanyKey] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [appliedStart, setAppliedStart] = useState("");
  const [appliedEnd, setAppliedEnd] = useState("");
  const [eventLimit, setEventLimit] = useState(6);

  const hasCustomRange = Boolean(appliedStart && appliedEnd);
  const effectivePeriod = hasCustomRange ? rangeDays(appliedStart, appliedEnd) : period;
  const periodLabel = hasCustomRange ? `${shortDate(appliedStart)} até ${shortDate(appliedEnd)}` : period === 7 ? "última semana" : `últimos ${period} dias`;

  useEffect(() => {
    let ok = true;
    setLoading(true);
    const params = new URLSearchParams();
    params.set("period", String(effectivePeriod));
    if (hasCustomRange) {
      params.set("start", appliedStart);
      params.set("end", appliedEnd);
    }
    fetchApi(`/api/admin/quality/overview?${params.toString()}`, { cache: "no-store" })
      .then((r) => r.json().then((j) => ({ r, j })).catch(() => ({ r, j: null })))
      .then(({ r, j }) => ok && setOverview(r.ok ? unwrapEnvelopeData<Overview>(j) ?? j ?? null : null))
      .catch(() => ok && setOverview(null))
      .finally(() => ok && setLoading(false));
    return () => { ok = false; };
  }, [appliedEnd, appliedStart, effectivePeriod, hasCustomRange]);

  useEffect(() => {
    setEventLimit(6);
  }, [appliedEnd, appliedStart, companyKey, mode, period, userEmail]);

  useEffect(() => {
    let ok = true;
    const id = window.setTimeout(() => {
      setDetailsLoading(true);
      const params = new URLSearchParams({ limit: String(Math.max(eventLimit, 8)) });
      if (hasCustomRange) {
        params.set("start", appliedStart);
        params.set("end", appliedEnd);
      }
      fetchApi(`/api/admin/audit-logs?${params.toString()}`, { cache: "no-store" })
        .then((r) => r.json().then((j) => ({ r, j })).catch(() => ({ r, j: null })))
        .then(({ r, j }) => {
          const data = r.ok ? unwrapEnvelopeData<{ items?: Audit[] }>(j) ?? j : null;
          if (ok) setAudit(Array.isArray(data?.items) ? data.items : []);
        })
        .catch(() => ok && setAudit([]))
        .finally(() => ok && setDetailsLoading(false));
    }, 520);
    return () => { ok = false; window.clearTimeout(id); };
  }, [appliedEnd, appliedStart, eventLimit, hasCustomRange]);

  useEffect(() => {
    if (mode !== "user" || adminUsers.length) return;
    let ok = true;
    const id = window.setTimeout(() => {
      setDetailsLoading(true);
      fetchApi("/api/admin/users", { cache: "no-store" })
        .then((r) => r.json().then((j) => ({ r, j })).catch(() => ({ r, j: null })))
        .then(({ r, j }) => {
          const data = r.ok ? unwrapEnvelopeData<{ items?: AdminUser[] }>(j) ?? j : null;
          if (ok) setAdminUsers(Array.isArray(data?.items) ? data.items : []);
        })
        .catch(() => ok && setAdminUsers([]))
        .finally(() => ok && setDetailsLoading(false));
    }, 250);
    return () => { ok = false; window.clearTimeout(id); };
  }, [adminUsers.length, mode]);

  const companies = overview?.companies ?? [];
  const selectedCompany = companyKey ? companies.find((c) => keyOf(c) === companyKey) ?? null : null;
  const stats = selectedCompany ? mergeStats(selectedCompany.releases) : overview?.globalStats ?? null;
  const total = sumStats(stats);
  const passRate = total ? Math.round(((stats?.pass ?? 0) / total) * 100) : overview?.globalPassRate ?? null;
  const scopedReleases = selectedCompany ? selectedCompany.releases : companies.flatMap((c) => c.releases);
  const latestRun = [...scopedReleases].sort((a, b) => ((b as { createdAtValue?: number }).createdAtValue ?? 0) - ((a as { createdAtValue?: number }).createdAtValue ?? 0))[0] ?? null;
  const selectedRunSummary = selectedCompany ? overview?.runExecutionsByCompany?.find((item) => item.slug === selectedCompany.slug || item.name === selectedCompany.name) ?? null : null;

  const auditByEmail = useMemo(() => {
    const map = new Map<string, { moves: number; latest: string | null }>();
    audit.forEach((a) => {
      const email = a.actor_email?.trim();
      if (!email) return;
      const item = map.get(email) ?? { moves: 0, latest: null };
      item.moves += 1;
      if (!item.latest || new Date(a.created_at).getTime() > new Date(item.latest).getTime()) item.latest = a.created_at;
      map.set(email, item);
    });
    return map;
  }, [audit]);

  const users = useMemo<UserCard[]>(() => {
    const map = new Map<string, UserCard>();
    adminUsers.forEach((u) => {
      const email = u.email?.trim();
      if (!email) return;
      const move = auditByEmail.get(email);
      map.set(email, { id: u.id || email, name: u.name?.trim() || nameFromEmail(email), email, src: u.avatar_url ?? u.avatarUrl ?? null, tag: tagOf({ ...u, email }), moves: move?.moves ?? 0, latest: move?.latest ?? null });
    });
    auditByEmail.forEach((move, email) => { if (!map.has(email)) map.set(email, { id: email, name: nameFromEmail(email), email, src: null, tag: tagOf({ email }), moves: move.moves, latest: move.latest }); });
    return [...map.values()].sort((a, b) => b.moves - a.moves || a.name.localeCompare(b.name));
  }, [adminUsers, auditByEmail]);

  const selectedUser = userEmail ? users.find((u) => u.email === userEmail) ?? null : null;
  const filteredCompanies = companies.filter((c) => normalize(`${c.name} ${c.slug ?? ""}`).includes(normalize(query)));
  const filteredUsers = users.filter((u) => normalize(`${u.name} ${u.email} ${u.tag}`).includes(normalize(query)));
  const scopedAudit = audit
    .filter((a) => !selectedUser || a.actor_email === selectedUser.email)
    .filter((a) => inRange(a.created_at, appliedStart, appliedEnd))
    .filter(isMeaningfulEvent);
  const visibleAudit = scopedAudit.slice(0, eventLimit);

  const cards: MetricCard[] = [
    scopedReleases.length ? { id: "runs", label: "Runs", value: selectedCompany ? selectedCompany.releases.length : overview?.releaseCount ?? 0, note: "criadas no contexto", icon: FiActivity, tone: "bg-[linear-gradient(135deg,#011848_0%,#1d4ed8_100%)]" } : null,
    total ? { id: "cases", label: "Casos", value: total, note: "registrados nas execuções", icon: FiBarChart2, tone: "bg-[linear-gradient(135deg,#0f766e_0%,#14b8a6_100%)]" } : null,
    passRate != null ? { id: "pass", label: "Aprovação", value: pct(passRate), note: "média do período", icon: FiShield, tone: "bg-[linear-gradient(135deg,#166534_0%,#22c55e_100%)]" } : null,
    stats?.fail ? { id: "fail", label: "Falhas", value: stats.fail, note: "casos com falha", icon: FiAlertTriangle, tone: "bg-[linear-gradient(135deg,#991b1b_0%,#ef4444_100%)]" } : null,
    stats?.blocked ? { id: "blocked", label: "Bloqueados", value: stats.blocked, note: "casos bloqueados", icon: FiAlertTriangle, tone: "bg-[linear-gradient(135deg,#92400e_0%,#f59e0b_100%)]" } : null,
    scopedAudit.length ? { id: "actions", label: "Ações", value: scopedAudit.length, note: "eventos filtrados", icon: FiUsers, tone: "bg-[linear-gradient(135deg,#6d28d9_0%,#a855f7_100%)]" } : null,
  ].filter(Boolean) as MetricCard[];

  function applyCalendar() {
    if (!startDate || !endDate) return;
    setAppliedStart(startDate);
    setAppliedEnd(endDate);
    setShowCalendar(false);
  }

  function clearCalendar() {
    setStartDate("");
    setEndDate("");
    setAppliedStart("");
    setAppliedEnd("");
    setShowCalendar(false);
  }

  return <div className={pageShellClass}><div className="flex w-full flex-col gap-4 px-3 py-4 sm:px-4 lg:px-8">
    <section className="tc-hero-panel"><div className="flex flex-col gap-4"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><img src={process.env.NEXT_PUBLIC_MENU_LOGO || "/images/tc.png"} alt="Logo" className="h-12 w-12 rounded-2xl border border-white/20 object-contain p-1" /><div><h1 className="tc-hero-title">Visão Geral</h1><p className="mt-1 text-sm font-semibold text-white/72">{selectedCompany?.name ?? selectedUser?.name ?? "Operação geral"} · {periodLabel}</p></div></div><div className="flex flex-wrap items-center gap-2">{(loading || detailsLoading) ? <span className="text-xs font-black uppercase tracking-[.22em] text-white/70">Atualizando...</span> : null}<div className="flex gap-1 rounded-2xl border border-white/16 bg-white/10 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,.12)] dark:bg-[#07111f]/70">{periods.map((p) => <button key={p} type="button" onClick={() => { setPeriod(p); setAppliedStart(""); setAppliedEnd(""); }} className={!hasCustomRange && period === p ? periodActiveClass : periodIdleClass}>{p === 7 ? "Semana" : `${p} dias`}</button>)}<button type="button" onClick={() => setShowCalendar((value) => !value)} className={hasCustomRange ? periodActiveClass : periodIdleClass}><FiCalendar className="inline" /> Período</button></div>{showCalendar ? <div className="absolute right-8 top-28 z-30 w-80 rounded-3xl border border-white/16 bg-white p-4 text-[#011848] shadow-2xl dark:bg-[#07111f] dark:text-white"><p className="text-xs font-black uppercase tracking-[.22em] text-[var(--tc-text-muted)] dark:text-white/58">Filtrar por período</p><div className="mt-3 grid grid-cols-2 gap-3"><label className="text-xs font-bold">De<input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1 w-full rounded-xl border border-[var(--tc-border)] bg-white px-3 py-2 text-sm text-[#011848] outline-none dark:bg-[#0b1628] dark:text-white" /></label><label className="text-xs font-bold">Até<input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="mt-1 w-full rounded-xl border border-[var(--tc-border)] bg-white px-3 py-2 text-sm text-[#011848] outline-none dark:bg-[#0b1628] dark:text-white" /></label></div><div className="mt-3 flex gap-2"><button type="button" onClick={applyCalendar} className="rounded-xl bg-[var(--tc-primary)] px-3 py-2 text-xs font-black text-white">Aplicar</button><button type="button" onClick={clearCalendar} className="rounded-xl border border-[var(--tc-border)] px-3 py-2 text-xs font-black">Limpar</button></div></div> : null}</div></div>{cards.length ? <div className="grid grid-cols-2 gap-3 border-t border-white/12 pt-4 sm:grid-cols-3 lg:grid-cols-6">{cards.map((card) => <Metric key={card.id} card={card} />)}</div> : <div className="rounded-2xl border border-white/14 bg-white/10 px-4 py-3 text-sm font-semibold text-white/80">Nenhuma movimentação encontrada para este contexto no período.</div>}</div></section>

    <section className="tc-panel"><div className="flex flex-col gap-4"><div><h2 className="text-[1.45rem] font-black tracking-[-.04em] text-[#011848] dark:text-white">Selecionar contexto</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-[#4b5563] dark:text-white/68">Escolha empresa ou usuário. O resumo abre rápido; eventos e usuários carregam depois e só aparecem quando há movimentação real.</p><div className="mt-3 flex gap-2"><button type="button" onClick={() => { setMode("company"); setUserEmail(null); }} className={`tc-button-${mode === "company" ? "primary" : "secondary"}`}><FiBriefcase />Empresa</button><button type="button" onClick={() => { setMode("user"); setCompanyKey(null); }} className={`tc-button-${mode === "user" ? "primary" : "secondary"}`}><FiUsers />Usuário</button></div></div><label className="w-full"><div className="flex w-full items-center gap-3 rounded-[20px] border border-[var(--tc-border)] bg-white px-4 py-3 text-[#011848] dark:bg-[#07111f] dark:text-white"><FiSearch className="text-[var(--tc-text-muted)]" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={mode === "company" ? "Buscar empresa" : "Buscar usuário"} className="w-full bg-transparent text-sm outline-none placeholder:text-slate-500 dark:placeholder:text-white/38" /></div></label></div><div className="mt-5 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"><div className="flex min-w-max gap-3 sm:gap-4">{mode === "company" ? <><button type="button" onClick={() => setCompanyKey(null)} className={companyKey === null ? selectedCardClass : idleCardClass}>{companyKey === null ? <SelectedStrip /> : null}<span className="text-[10px] font-black uppercase tracking-[.2em] text-[var(--tc-text-muted)] dark:text-white/52">Selecionado</span><strong>Todas as empresas</strong><p className="text-sm text-[#4b5563] dark:text-white/64">Todas as empresas liberadas.</p><div className="grid grid-cols-2 gap-3 border-t border-[var(--tc-border)] pt-3"><span>Empresas: {companies.length}</span><span>Runs: {overview?.releaseCount ?? 0}</span></div></button>{filteredCompanies.map((c) => { const k = keyOf(c); const s = companyKey === k; return <button key={k} type="button" onClick={() => setCompanyKey(k)} className={s ? selectedCardClass : idleCardClass}>{s ? <SelectedStrip /> : null}<div className="flex gap-3"><CompanyMark company={c} selected={s} /><div><strong>{c.name}</strong><p className="text-xs text-[#4b5563] dark:text-white/60">{c.gate.status === "no_data" ? "Sem dados" : "Com movimentação"}</p></div></div><div className="grid grid-cols-2 gap-3 border-t border-[var(--tc-border)] pt-3"><span>Runs: {c.releases.length}</span><span>Aprovação: {pct(c.passRate)}</span></div></button>; })}</> : <><button type="button" onClick={() => setUserEmail(null)} className={userEmail === null ? selectedCardClass : idleCardClass}>{userEmail === null ? <SelectedStrip /> : null}<span className="text-[10px] font-black uppercase tracking-[.2em] text-[var(--tc-text-muted)] dark:text-white/52">Selecionado</span><strong>Todos os usuários</strong><p className="text-sm text-[#4b5563] dark:text-white/64">Usuários TC e empresariais.</p><div className="grid grid-cols-2 gap-3 border-t border-[var(--tc-border)] pt-3"><span>Usuários: {users.length}</span><span>Ações: {audit.length}</span></div></button>{filteredUsers.map((u) => { const s = userEmail === u.email; return <button key={u.email} type="button" onClick={() => setUserEmail(u.email)} className={s ? selectedCardClass : idleCardClass}>{s ? <SelectedStrip /> : null}<div className="flex min-w-0 gap-3"><UserMark user={u} selected={s} /><div className="min-w-0"><strong className="line-clamp-1">{u.name}</strong><p className="truncate text-xs text-[#4b5563] dark:text-white/60">{u.email}</p><span className="tc-status-pill mt-2" data-tone="neutral"><span className="tc-status-dot" />{u.tag}</span></div></div><div className="grid grid-cols-2 gap-3 border-t border-[var(--tc-border)] pt-3"><span>Ações: {u.moves}</span><span>Última: {shortDate(u.latest)}</span></div></button>; })}</>}</div></div></section>

    <div className="grid gap-4 xl:grid-cols-[minmax(0,0.85fr)_minmax(360px,1.15fr)]">{latestRun ? <section className="tc-panel"><h2 className="text-xl font-black tracking-[-.04em] text-[#011848] dark:text-white">Última run do período</h2><p className="mt-1 text-sm text-[#4b5563] dark:text-white/60">{(latestRun as { title?: string }).title ?? "Run sem título"} · {shortDate((latestRun as { createdAt?: string; created_at?: string }).createdAt ?? (latestRun as { created_at?: string }).created_at)}</p><div className="mt-4 grid gap-3 sm:grid-cols-2">{[["Aprovadas", stats?.pass ?? 0, "bg-emerald-500"], ["Falhadas", stats?.fail ?? 0, "bg-rose-500"], ["Bloqueadas", stats?.blocked ?? 0, "bg-amber-500"], ["Não executadas", stats?.notRun ?? 0, "bg-slate-400"]].filter(([, v]) => Number(v) > 0).map(([l, v, c]) => <div key={String(l)} className="tc-panel-muted"><div className="flex justify-between text-sm font-black text-[#011848] dark:text-white"><span>{l}</span><span>{v}</span></div><div className="mt-3 h-2 rounded-full bg-slate-100 dark:bg-[#07111f]"><div className={`h-2 rounded-full ${c}`} style={{ width: total ? `${Math.round((Number(v) / total) * 100)}%` : "0%" }} /></div></div>)}</div>{selectedRunSummary?.averageApprovalTimeLabel ? <div className="mt-4 rounded-2xl border border-[var(--tc-border)] bg-white p-3 text-sm font-semibold text-[#011848] dark:bg-[#0b1628] dark:text-white">Tempo médio: {selectedRunSummary.averageApprovalTimeLabel}</div> : null}</section> : null}<section className="tc-panel"><div className="flex items-start justify-between gap-3"><div><h2 className="text-xl font-black tracking-[-.04em] text-[#011848] dark:text-white">Eventos recentes</h2><p className="mt-1 text-sm text-[#4b5563] dark:text-white/60">Linha do tempo do que realmente aconteceu no contexto.</p></div>{detailsLoading ? <span className="rounded-full border border-[var(--tc-border)] px-3 py-1 text-xs font-black text-[#4b5563] dark:text-white/60">Carregando</span> : null}</div><div className="mt-5 space-y-4">{visibleAudit.length ? visibleAudit.map((item) => { const meta = eventLabel(item); const Icon = meta.icon; return <div key={item.id} className="relative flex gap-3"><div className="flex flex-col items-center"><span className={`flex h-9 w-9 items-center justify-center rounded-2xl text-white shadow-lg ${meta.tone}`}><Icon size={15} /></span><span className="mt-2 h-full min-h-8 w-px bg-[var(--tc-border)]" /></div><div className="min-w-0 flex-1 rounded-3xl border border-[var(--tc-border)] bg-white p-4 text-[#011848] shadow-[0_14px_30px_rgba(1,24,72,.06)] dark:bg-[#0b1628] dark:text-white"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-black">{meta.title}</p><span className="text-xs font-bold text-[#4b5563] dark:text-white/56">{dateTime(item.created_at)}</span></div><p className="mt-1 text-sm leading-6 text-[#4b5563] dark:text-white/68">{item.entity_label ?? item.action}</p><p className="mt-2 text-xs font-semibold text-[#64748b] dark:text-white/44">{item.actor_email ?? "Sistema"}</p></div></div>; }) : <p className="rounded-2xl border border-[var(--tc-border)] bg-white p-4 text-sm font-semibold text-[#4b5563] dark:bg-[#0b1628] dark:text-white/60">Nenhum evento encontrado para este contexto no período.</p>}{scopedAudit.length > visibleAudit.length ? <button type="button" onClick={() => setEventLimit((value) => value + 6)} className="w-full rounded-2xl border border-[var(--tc-border)] bg-white px-4 py-3 text-sm font-black text-[#011848] transition hover:bg-[#f8fbff] dark:bg-[#07111f] dark:text-white dark:hover:bg-[#0e1a2b]">Ver mais eventos</button> : null}</div></section></div>
  </div></div>;
}
