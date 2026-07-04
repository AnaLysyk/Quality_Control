"use client";

import { useEffect, useMemo, useState } from "react";
import { FiActivity, FiBarChart2, FiBriefcase, FiRefreshCw, FiSearch, FiShield, FiUsers } from "react-icons/fi";
import UserAvatar from "@/components/UserAvatar";
import { fetchApi } from "@/lib/api";
import { unwrapEnvelopeData } from "@/lib/apiEnvelope";
import type { CompanyRow, Stats } from "@/lib/quality";

type Overview = { companies: CompanyRow[]; releaseCount: number; globalStats: Stats; globalPassRate: number | null };
type Audit = { id: string; created_at: string; actor_email: string | null; entity_label: string | null; action: string };
type AdminUser = { id: string; name?: string | null; email: string; avatar_url?: string | null; avatarUrl?: string | null; permission_role?: string | null; role?: string | null; profile_kind?: string | null; user_origin?: string | null };
type Mode = "company" | "user";
type UserCard = { id: string; name: string; email: string; src: string | null; tag: "Testing Company" | "Empresarial"; moves: number; latest: string | null };

const periods = [7, 30, 90] as const;
const pageShellClass = "min-h-screen bg-white text-[var(--tc-text-primary)] dark:bg-[#07111f] dark:text-white";
const selectedCardClass = "relative flex w-[78vw] min-w-56 max-w-72 shrink-0 flex-col gap-3 overflow-hidden rounded-3xl border border-[rgba(239,0,1,.28)] bg-[linear-gradient(180deg,#ffffff_0%,#f7faff_100%)] p-4 text-left text-[#011848] shadow-[0_24px_44px_rgba(1,24,72,.12)] ring-1 ring-[rgba(239,0,1,.16)] transition dark:bg-[linear-gradient(180deg,#0f1b30_0%,#13213a_100%)] dark:text-white dark:shadow-[0_24px_44px_rgba(0,0,0,.28)] dark:ring-white/10";
const idleCardClass = "relative flex w-[78vw] min-w-56 max-w-72 shrink-0 flex-col gap-3 overflow-hidden rounded-3xl border border-[var(--tc-border)] bg-white p-4 text-left text-[#011848] transition hover:border-[rgba(239,0,1,.18)] hover:bg-[#f8fbff] hover:shadow-[0_18px_35px_rgba(1,24,72,.08)] dark:bg-[#0b1628] dark:text-white dark:hover:bg-[#101f35]";
const periodActiveClass = "rounded-xl bg-white px-3 py-2 text-xs font-black text-[#011848] shadow-[0_8px_18px_rgba(1,24,72,.16)] ring-1 ring-white/70 transition dark:bg-[#07111f] dark:text-white dark:ring-white/14";
const periodIdleClass = "rounded-xl px-3 py-2 text-xs font-black text-white/78 transition hover:bg-white/12 hover:text-white";
const refreshButtonClass = "inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white px-4 py-3 text-sm font-black text-[#011848] shadow-[0_12px_24px_rgba(1,24,72,.16)] transition hover:-translate-y-0.5 hover:bg-[#f8fbff] dark:border-white/12 dark:bg-[#07111f] dark:text-white dark:hover:bg-[#0e1a2b]";
const normalize = (v?: string | null) => (v ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const pct = (v?: number | null) => (v == null ? "--" : `${v}%`);
const shortDate = (v?: string | null) => {
  if (!v) return "--";
  const d = new Date(v);
  return Number.isFinite(d.getTime()) ? d.toLocaleDateString("pt-BR") : "--";
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

function SelectedStrip() {
  return <span className="absolute inset-y-0 left-0 w-1.5 bg-[linear-gradient(180deg,var(--tc-primary)_0%,var(--tc-accent)_100%)]" aria-hidden />;
}

function Metric({ label, value, note, icon: Icon }: { label: string; value: string | number; note: string; icon: typeof FiBarChart2 }) {
  return <div className="tc-hero-stat"><div className="flex items-center gap-2"><Icon className="text-white/70" size={14} /><div className="tc-hero-stat-label">{label}</div></div><div className="tc-hero-stat-value">{value}</div><div className="tc-hero-stat-note">{note}</div></div>;
}

function CompanyMark({ company, selected }: { company: CompanyRow; selected: boolean }) {
  return <div className={`flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-[18px] border text-sm font-black shadow-[0_14px_28px_rgba(15,23,42,.08)] ${selected ? "border-[rgba(239,0,1,.22)] bg-[linear-gradient(135deg,rgba(1,24,72,.95)_0%,rgba(239,0,1,.92)_100%)] text-white" : "border-[var(--tc-border)] bg-[linear-gradient(180deg,#ffffff_0%,#eef3ff_100%)] text-[#011848] dark:bg-[linear-gradient(180deg,#101d32_0%,#162742_100%)] dark:text-white"}`}>{company.logo ? <img src={company.logo} alt={`Logo ${company.name}`} className="h-full w-full object-cover" /> : initials(company.name)}</div>;
}

function UserMark({ user, selected }: { user: UserCard; selected: boolean }) {
  return <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] border p-1 shadow-[0_14px_28px_rgba(15,23,42,.08)] ${selected ? "border-[rgba(239,0,1,.22)] bg-[linear-gradient(135deg,rgba(1,24,72,.95)_0%,rgba(239,0,1,.92)_100%)]" : "border-[var(--tc-border)] bg-[linear-gradient(180deg,#ffffff_0%,#eef3ff_100%)] dark:bg-[linear-gradient(180deg,#101d32_0%,#162742_100%)]"}`}><UserAvatar src={user.src} name={user.name} size="sm" frameClassName="border-white/70 shadow-none" fallbackClassName="text-[.7rem] tracking-[.12em]" /></div>;
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
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);

  useEffect(() => {
    let ok = true;
    setLoading(true);
    fetchApi(`/api/admin/quality/overview?period=${period}`, { cache: "no-store" })
      .then((r) => r.json().then((j) => ({ r, j })).catch(() => ({ r, j: null })))
      .then(({ r, j }) => ok && setOverview(r.ok ? unwrapEnvelopeData<Overview>(j) ?? j ?? null : null))
      .catch(() => ok && setOverview(null))
      .finally(() => ok && setLoading(false));
    return () => { ok = false; };
  }, [period, refresh]);

  useEffect(() => {
    let ok = true;
    const id = window.setTimeout(() => {
      setDetailsLoading(true);
      fetchApi("/api/admin/audit-logs?limit=40", { cache: "no-store" })
        .then((r) => r.json().then((j) => ({ r, j })).catch(() => ({ r, j: null })))
        .then(({ r, j }) => {
          const data = r.ok ? unwrapEnvelopeData<{ items?: Audit[] }>(j) ?? j : null;
          if (ok) setAudit(Array.isArray(data?.items) ? data.items : []);
        })
        .catch(() => ok && setAudit([]))
        .finally(() => ok && setDetailsLoading(false));
    }, 350);
    return () => { ok = false; window.clearTimeout(id); };
  }, [refresh]);

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
  const scopedCompanies = selectedCompany ? [selectedCompany] : companies;
  const stats = selectedCompany ? mergeStats(selectedCompany.releases) : overview?.globalStats ?? null;
  const total = sumStats(stats);
  const passRate = total ? Math.round(((stats?.pass ?? 0) / total) * 100) : overview?.globalPassRate ?? null;

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
  const scopedAudit = selectedUser ? audit.filter((a) => a.actor_email === selectedUser.email).slice(0, 10) : audit.slice(0, 10);

  return <div className={pageShellClass}><div className="flex w-full flex-col gap-4 px-3 py-4 sm:px-4 lg:px-8">
    <section className="tc-hero-panel"><div className="flex flex-col gap-4"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><img src={process.env.NEXT_PUBLIC_MENU_LOGO || "/images/tc.png"} alt="Logo" className="h-12 w-12 rounded-2xl border border-white/20 object-contain p-1" /><div><h1 className="tc-hero-title">Visão Geral</h1><p className="mt-1 text-sm font-semibold text-white/72">{selectedCompany?.name ?? selectedUser?.name ?? "Operação geral"} · últimos {period} dias</p></div></div><div className="flex flex-wrap items-center gap-2">{(loading || detailsLoading) ? <span className="text-xs font-black uppercase tracking-[.22em] text-white/70">Atualizando...</span> : null}<div className="flex gap-1 rounded-2xl border border-white/16 bg-white/10 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,.12)] dark:bg-[#07111f]/70">{periods.map((p) => <button key={p} type="button" onClick={() => setPeriod(p)} className={period === p ? periodActiveClass : periodIdleClass}>{p === 7 ? "Semana" : `${p} dias`}</button>)}</div><button type="button" onClick={() => setRefresh((v) => v + 1)} className={refreshButtonClass}><FiRefreshCw className={loading ? "animate-spin" : ""} />Recarregar</button></div></div><div className="grid grid-cols-2 gap-3 border-t border-white/12 pt-4 sm:grid-cols-3 lg:grid-cols-6"><Metric label="Runs" value={selectedCompany ? selectedCompany.releases.length : overview?.releaseCount ?? 0} note="criadas no contexto" icon={FiActivity} /><Metric label="Casos" value={total} note="registrados nas execuções" icon={FiBarChart2} /><Metric label="Aprovação" value={pct(passRate)} note="média do período" icon={FiShield} /><Metric label="Falhas" value={stats?.fail ?? 0} note="casos com falha" icon={FiBarChart2} /><Metric label="Bloqueados" value={stats?.blocked ?? 0} note="casos bloqueados" icon={FiBarChart2} /><Metric label="Ações" value={scopedAudit.length} note="eventos recentes" icon={FiUsers} /></div></div></section>
    <section className="tc-panel"><div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between"><div><h2 className="text-[1.45rem] font-black tracking-[-.04em] text-[#011848] dark:text-white">Selecionar contexto</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[#4b5563] dark:text-white/68">A tela ficou mais leve: o resumo carrega primeiro; usuários, fotos e eventos entram depois.</p><div className="mt-3 flex gap-2"><button type="button" onClick={() => { setMode("company"); setUserEmail(null); }} className={`tc-button-${mode === "company" ? "primary" : "secondary"}`}><FiBriefcase />Empresa</button><button type="button" onClick={() => { setMode("user"); setCompanyKey(null); }} className={`tc-button-${mode === "user" ? "primary" : "secondary"}`}><FiUsers />Usuário</button></div></div><label className="w-full max-w-md"><div className="flex items-center gap-3 rounded-[20px] border border-[var(--tc-border)] bg-white px-4 py-3 text-[#011848] dark:bg-[#07111f] dark:text-white"><FiSearch className="text-[var(--tc-text-muted)]" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={mode === "company" ? "Buscar empresa" : "Buscar usuário"} className="w-full bg-transparent text-sm outline-none placeholder:text-slate-500 dark:placeholder:text-white/38" /></div></label></div><div className="mt-5 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"><div className="flex min-w-max gap-3 sm:gap-4">{mode === "company" ? <><button type="button" onClick={() => setCompanyKey(null)} className={companyKey === null ? selectedCardClass : idleCardClass}>{companyKey === null ? <SelectedStrip /> : null}<span className="text-[10px] font-black uppercase tracking-[.2em] text-[var(--tc-text-muted)] dark:text-white/52">Selecionado</span><strong>Todas as empresas</strong><p className="text-sm text-[#4b5563] dark:text-white/64">Todas as empresas liberadas.</p><div className="grid grid-cols-2 gap-3 border-t border-[var(--tc-border)] pt-3"><span>Empresas: {companies.length}</span><span>Runs: {overview?.releaseCount ?? 0}</span></div></button>{filteredCompanies.map((c) => { const k = keyOf(c); const s = companyKey === k; return <button key={k} type="button" onClick={() => setCompanyKey(k)} className={s ? selectedCardClass : idleCardClass}>{s ? <SelectedStrip /> : null}<div className="flex gap-3"><CompanyMark company={c} selected={s} /><div><strong>{c.name}</strong><p className="text-xs text-[#4b5563] dark:text-white/60">{c.gate.status === "no_data" ? "Sem dados" : "Com movimentação"}</p></div></div><div className="grid grid-cols-2 gap-3 border-t border-[var(--tc-border)] pt-3"><span>Runs: {c.releases.length}</span><span>Aprovação: {pct(c.passRate)}</span></div></button>; })}</> : <><button type="button" onClick={() => setUserEmail(null)} className={userEmail === null ? selectedCardClass : idleCardClass}>{userEmail === null ? <SelectedStrip /> : null}<span className="text-[10px] font-black uppercase tracking-[.2em] text-[var(--tc-text-muted)] dark:text-white/52">Selecionado</span><strong>Todos os usuários</strong><p className="text-sm text-[#4b5563] dark:text-white/64">Usuários TC e empresariais.</p><div className="grid grid-cols-2 gap-3 border-t border-[var(--tc-border)] pt-3"><span>Usuários: {users.length}</span><span>Ações: {audit.length}</span></div></button>{filteredUsers.map((u) => { const s = userEmail === u.email; return <button key={u.email} type="button" onClick={() => setUserEmail(u.email)} className={s ? selectedCardClass : idleCardClass}>{s ? <SelectedStrip /> : null}<div className="flex min-w-0 gap-3"><UserMark user={u} selected={s} /><div className="min-w-0"><strong className="line-clamp-1">{u.name}</strong><p className="truncate text-xs text-[#4b5563] dark:text-white/60">{u.email}</p><span className="tc-status-pill mt-2" data-tone="neutral"><span className="tc-status-dot" />{u.tag}</span></div></div><div className="grid grid-cols-2 gap-3 border-t border-[var(--tc-border)] pt-3"><span>Ações: {u.moves}</span><span>Última: {shortDate(u.latest)}</span></div></button>; })}</>}</div></div></section>
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,.85fr)]"><section className="tc-panel"><h2 className="text-xl font-black tracking-[-.04em] text-[#011848] dark:text-white">Runs por status</h2><div className="mt-4 grid gap-3 sm:grid-cols-2">{[["Aprovadas", stats?.pass ?? 0, "bg-emerald-500"], ["Falhadas", stats?.fail ?? 0, "bg-rose-500"], ["Bloqueadas", stats?.blocked ?? 0, "bg-amber-500"], ["Não executadas", stats?.notRun ?? 0, "bg-slate-400"]].map(([l, v, c]) => <div key={String(l)} className="tc-panel-muted"><div className="flex justify-between text-sm font-black text-[#011848] dark:text-white"><span>{l}</span><span>{v}</span></div><div className="mt-3 h-2 rounded-full bg-slate-100 dark:bg-[#07111f]"><div className={`h-2 rounded-full ${c}`} style={{ width: total ? `${Math.round((Number(v) / total) * 100)}%` : "0%" }} /></div></div>)}</div></section><section className="tc-panel"><h2 className="text-xl font-black tracking-[-.04em] text-[#011848] dark:text-white">Eventos recentes</h2><div className="mt-4 space-y-3">{scopedAudit.length ? scopedAudit.map((a) => <div key={a.id} className="rounded-2xl border border-[var(--tc-border)] bg-white p-3 text-[#011848] dark:bg-[#0b1628] dark:text-white"><p className="text-sm font-black">{a.entity_label ?? a.action}</p><p className="mt-1 text-xs text-[#4b5563] dark:text-white/60">{a.actor_email ?? "Sistema"} · {shortDate(a.created_at)}</p></div>) : <p className="text-sm font-semibold text-[#4b5563] dark:text-white/60">Sem movimentações para este contexto no período.</p>}</div></section></div>
  </div></div>;
}
