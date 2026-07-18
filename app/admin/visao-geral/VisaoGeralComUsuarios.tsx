"use client";

import { useEffect, useMemo, useState } from "react";
import { FiActivity, FiAlertTriangle, FiBriefcase, FiCalendar, FiClipboard, FiFilter, FiSearch, FiShield, FiUser, FiUsers } from "react-icons/fi";
import type { IconType } from "react-icons";
import { fetchApi } from "@/backend/api";
import { unwrapEnvelopeData } from "@/backend/apiEnvelope";
import type { CompanyRow, Stats } from "@/backend/quality";

type Overview = { companies: CompanyRow[]; globalStats: Stats; projectRows?: Array<{ id: string; name: string }> };
type Audit = { id: string; created_at: string; actor_email: string | null; action: string; entity_label: string | null; entity_type?: string | null };
type Defect = { id: string; title: string; status: string; run_id?: string | number | null; created_at?: string | null; updated_at?: string | null };
type UserCompany = { id?: string | null; slug?: string | null; name?: string | null };
type AdminUser = {
  id?: string;
  name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
  avatarUrl?: string | null;
  image?: string | null;
  role?: string | null;
  permission_role?: string | null;
  profile_kind?: string | null;
  client_id?: string | null;
  company_name?: string | null;
  company_names?: string[];
  company_ids?: string[];
  companyNames?: string[];
  companyIds?: string[];
  companies?: UserCompany[];
};
type Mode = "company" | "user";
type UserType = "all" | "company_user" | "testing_company_user" | "leader_tc" | "technical_support" | "empresa";

const periods = [7, 30, 90] as const;
const FIRST_ITEMS = 6;
const FIRST_EVENTS = 5;
const userTypes: Array<{ value: UserType; label: string; help: string; requireCompany?: boolean }> = [
  { value: "all", label: "Todos os usuários", help: "Mostra a visão geral de todos os perfis." },
  { value: "company_user", label: "Usuário empresarial", help: "Lista somente usuários empresariais. Ao clicar em um usuário, a tela entra na empresa em que ele foi criado." },
  { value: "testing_company_user", label: "Usuário TC", help: "Lista usuários TC. Sem empresa, soma tudo que ele fez; com empresa, filtra o que ele fez naquela empresa." },
  { value: "leader_tc", label: "Líder TC", help: "Lista líderes TC e mostra ações administrativas, empresas, usuários, vínculos, permissões e solicitações." },
  { value: "technical_support", label: "Suporte técnico", help: "Lista suporte técnico e mostra tudo que ele movimentou: chamados, comentários, status e ações em módulos." },
  { value: "empresa", label: "Perfil empresa", help: "Mostra a conta institucional da empresa selecionada.", requireCompany: true },
];

const statCard = "rounded-[22px] border border-white/15 bg-white/10 p-4 text-white shadow-[0_18px_38px_rgba(1,24,72,.12)] backdrop-blur-sm ring-1 ring-white/5";
const contextCard = "group relative flex h-28 w-52 shrink-0 flex-col justify-between overflow-hidden rounded-3xl border border-[var(--tc-border)] bg-white/75 px-4 py-3 text-left transition hover:border-[rgba(239,0,1,.24)] hover:bg-white dark:bg-white/[0.03] dark:hover:bg-white/[0.06]";
const contextCardSelected = "group relative flex h-28 w-52 shrink-0 flex-col justify-between overflow-hidden rounded-3xl border border-[rgba(239,0,1,.55)] bg-white/90 px-4 py-3 text-left shadow-[inset_4px_0_0_var(--tc-accent),0_18px_32px_rgba(1,24,72,.10)] dark:bg-white/[0.05]";

function normalize(value?: string | null) {
  return (value ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}
function keyOf(company: CompanyRow) { return company.slug ?? company.id; }
function total(stats?: Stats | null) { return stats ? stats.pass + stats.fail + stats.blocked + stats.notRun : 0; }
function shortDate(value?: string | null) {
  if (!value) return "--";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString("pt-BR") : "--";
}
function daysBetween(start: string, end: string) {
  const a = new Date(`${start}T00:00:00`).getTime();
  const b = new Date(`${end}T23:59:59`).getTime();
  return Number.isFinite(a) && Number.isFinite(b) && b >= a ? Math.max(1, Math.ceil((b - a) / 86400000)) : 30;
}
function mergeStats(releases: CompanyRow["releases"]): Stats {
  return releases.reduce<Stats>((acc, item) => {
    if (!item.stats) return acc;
    acc.pass += item.stats.pass;
    acc.fail += item.stats.fail;
    acc.blocked += item.stats.blocked;
    acc.notRun += item.stats.notRun;
    return acc;
  }, { pass: 0, fail: 0, blocked: 0, notRun: 0 });
}
function nameFromEmail(email?: string | null) {
  if (!email) return "Sistema";
  return email.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}
function userEmail(user: AdminUser) { return user.email?.trim() ?? user.id ?? ""; }
function avatarFromUser(user?: AdminUser | null) { return user?.avatar_url ?? user?.avatarUrl ?? user?.image ?? null; }
function roleOf(user: AdminUser): UserType {
  const text = normalize(`${user.profile_kind ?? ""} ${user.permission_role ?? ""} ${user.role ?? ""}`).replace(/[\s-]+/g, "_");
  if (text.includes("technical_support") || text.includes("suporte")) return "technical_support";
  if (text.includes("leader_tc") || text.includes("lider_tc")) return "leader_tc";
  if (text.includes("company_user") || text.includes("usuario_empresa") || text.includes("empresarial")) return "company_user";
  if (text === "empresa" || text.includes("company_admin")) return "empresa";
  return "testing_company_user";
}
function roleLabel(role: UserType) { return userTypes.find((item) => item.value === role)?.label ?? "Usuário"; }
function companyKeys(company: CompanyRow | null) {
  return new Set([company?.id, company?.slug, company?.name].map((item) => normalize(item)).filter(Boolean));
}
function userCompanyKeys(user: AdminUser) {
  const values = [user.client_id, user.company_name, ...(user.company_ids ?? []), ...(user.companyIds ?? []), ...(user.company_names ?? []), ...(user.companyNames ?? [])];
  user.companies?.forEach((company) => values.push(company.id ?? null, company.slug ?? null, company.name ?? null));
  return new Set(values.map((item) => normalize(item)).filter(Boolean));
}
function userMatchesCompany(user: AdminUser, company: CompanyRow | null) {
  if (!company) return true;
  const selected = companyKeys(company);
  const userKeys = userCompanyKeys(user);
  for (const key of selected) if (userKeys.has(key)) return true;
  return false;
}
function firstCompanyForUser(user: AdminUser, companies: CompanyRow[]) {
  const keys = userCompanyKeys(user);
  return companies.find((company) => [...companyKeys(company)].some((key) => keys.has(key))) ?? null;
}
function eventText(event: Audit) { return normalize(`${event.action} ${event.entity_type ?? ""} ${event.entity_label ?? ""}`); }
function eventInPeriod(event: Audit, period: number, from: string, to: string) {
  const time = new Date(event.created_at).getTime();
  if (!Number.isFinite(time)) return false;
  if (from && to) return time >= new Date(`${from}T00:00:00`).getTime() && time <= new Date(`${to}T23:59:59`).getTime();
  return time >= Date.now() - period * 86400000;
}
function eventMatchesCompany(event: Audit, company: CompanyRow | null) {
  if (!company) return true;
  const text = eventText(event);
  return [...companyKeys(company)].some((key) => text.includes(key));
}
function eventKind(event: Audit) {
  const text = eventText(event);
  if (/ticket|chamado|suporte|support/.test(text) && /coment|comment/.test(text)) return ["Comentário em chamado", "Chamado recebeu comentário ou retorno.", "bg-amber-500"] as const;
  if (/ticket|chamado|suporte|support/.test(text)) return ["Chamado movimentado", "Chamado recebeu alteração de status ou ação.", "bg-amber-500"] as const;
  if (/empresa|company|projeto|project/.test(text)) return ["Empresa ou projeto atualizado", "Cadastro institucional recebeu ação.", "bg-indigo-500"] as const;
  if (/usuario|user|vincul|invite|convite|permission|permissao|perfil|role/.test(text)) return ["Usuário ou permissão alterada", "Usuário, vínculo ou permissão teve atualização.", "bg-cyan-500"] as const;
  if (/run|execu/.test(text)) return ["Run movimentada", "Execução criada, finalizada ou alterada.", "bg-violet-500"] as const;
  if (/plano|plan/.test(text)) return ["Plano de teste movimentado", "Plano criado ou atualizado.", "bg-emerald-500"] as const;
  if (/caso|case|teste|test|repositorio/.test(text)) return ["Caso de teste movimentado", "Caso criado, executado ou atualizado.", "bg-sky-500"] as const;
  if (/defeito|defect|bug|falha/.test(text)) return ["Defeito movimentado", "Defeito criado ou atualizado.", "bg-rose-500"] as const;
  return ["Ação registrada", "Ação do sistema no período filtrado.", "bg-slate-500"] as const;
}
function countBy(events: Audit[], pattern: RegExp) { return events.filter((event) => pattern.test(eventText(event))).length; }
function StatCard({ icon: Icon, value, label }: { icon: IconType; value: string | number; label: string }) {
  return <div className={statCard}><Icon className="text-white/72" /><b className="mt-2 block text-2xl">{value}</b><small className="font-semibold text-white/72">{label}</small></div>;
}
function RoundUserAvatar({ src, name, size = "md" }: { src?: string | null; name: string; size?: "sm" | "md" }) {
  const box = size === "sm" ? "h-10 w-10" : "h-12 w-12";
  return <div className={`${box} flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/70 bg-[#e8edf5] text-[#64748b] shadow-[0_10px_22px_rgba(1,24,72,.08)] ring-1 ring-black/5 dark:border-white/20 dark:bg-[#dce3ee]`}>
    {src ? <img src={src} alt={name} className="h-full w-full rounded-full object-cover" /> : <FiUser size={size === "sm" ? 18 : 21} strokeWidth={2.6} />}
  </div>;
}
function RoundCompanyAvatar({ company }: { company?: CompanyRow | null }) {
  return <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/70 bg-[#e8edf5] text-[#64748b] shadow-[0_10px_22px_rgba(1,24,72,.08)] ring-1 ring-black/5 dark:border-white/20 dark:bg-[#dce3ee]">
    {company?.logo ? <img src={company.logo} alt={company.name} className="h-full w-full rounded-full object-cover" /> : <FiBriefcase size={20} strokeWidth={2.4} />}
  </div>;
}

export default function VisaoGeralComUsuarios() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [defects, setDefects] = useState<Defect[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [period, setPeriod] = useState<(typeof periods)[number]>(30);
  const [mode, setMode] = useState<Mode>("company");
  const [userType, setUserType] = useState<UserType>("all");
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

  const hasRange = Boolean(from && to);
  const effectivePeriod = hasRange ? daysBetween(from, to) : period;
  const companies = overview?.companies ?? [];
  const company = selectedCompany ? companies.find((item) => keyOf(item) === selectedCompany || item.id === selectedCompany) ?? null : null;
  const selectedType = userTypes.find((item) => item.value === userType) ?? userTypes[0];

  useEffect(() => {
    let ok = true;
    setLoading(true);
    const params = new URLSearchParams({ period: String(effectivePeriod) });
    if (hasRange) { params.set("start", from); params.set("end", to); }
    fetchApi(`/api/admin/quality/overview?${params}`, { cache: "no-store" })
      .then((r) => r.json().then((json) => ({ r, json })).catch(() => ({ r, json: null })))
      .then(({ r, json }) => ok && setOverview(r.ok ? unwrapEnvelopeData<Overview>(json) ?? json : null))
      .catch(() => ok && setOverview(null))
      .finally(() => ok && setLoading(false));
    return () => { ok = false; };
  }, [effectivePeriod, from, hasRange, to]);

  useEffect(() => {
    let ok = true;
    const params = selectedCompany ? `?client_id=${encodeURIComponent(selectedCompany)}` : "";
    fetchApi(`/api/admin/users${params}`, { cache: "no-store" })
      .then((r) => r.json().then((json) => ({ r, json })).catch(() => ({ r, json: null })))
      .then(({ r, json }) => {
        if (!ok || !r.ok) return;
        const data = unwrapEnvelopeData<{ items?: AdminUser[] }>(json) ?? json;
        setUsers(Array.isArray(data?.items) ? data.items : []);
      })
      .catch(() => undefined);
    return () => { ok = false; };
  }, [selectedCompany]);

  useEffect(() => {
    let ok = true;
    const params = new URLSearchParams({ limit: String(Math.max(80, visibleEvents + FIRST_EVENTS)), period: String(effectivePeriod) });
    if (hasRange) { params.set("start", from); params.set("end", to); }
    Promise.all([
      fetchApi(`/api/admin/audit-logs?${params}`, { cache: "no-store" }),
      fetchApi(selectedCompany ? `/api/admin/defeitos?company=${encodeURIComponent(selectedCompany)}` : "/api/admin/defeitos", { cache: "no-store" }),
    ]).then(async ([a, d]) => {
      const auditJson = await a.json().catch(() => null);
      const defectJson = await d.json().catch(() => null);
      const auditData = a.ok ? unwrapEnvelopeData<{ items?: Audit[] }>(auditJson) ?? auditJson : null;
      const defectData = d.ok ? unwrapEnvelopeData<{ items?: Defect[] }>(defectJson) ?? defectJson : null;
      if (!ok) return;
      setAudit(Array.isArray(auditData?.items) ? auditData.items : []);
      setDefects(Array.isArray(defectData?.items) ? defectData.items : []);
    }).catch(() => { if (ok) { setAudit([]); setDefects([]); } });
    return () => { ok = false; };
  }, [effectivePeriod, from, hasRange, selectedCompany, to, visibleEvents]);

  useEffect(() => { setVisibleCards(FIRST_ITEMS); setVisibleEvents(FIRST_EVENTS); }, [mode, query, selectedCompany, selectedUser, userType, effectivePeriod]);

  const companyReleases = company ? company.releases : companies.flatMap((item) => item.releases);
  const stats = company ? mergeStats(company.releases) : overview?.globalStats ?? null;
  const scopedUsers = users
    .filter((user) => userType === "all" || roleOf(user) === userType)
    .filter((user) => !company || userMatchesCompany(user, company))
    .filter((user) => !(selectedType.requireCompany && !company))
    .filter((user) => normalize(`${user.name ?? ""} ${user.email ?? ""} ${user.company_name ?? ""} ${(user.company_names ?? []).join(" ")} ${(user.companyNames ?? []).join(" ")}`).includes(normalize(query)));
  const visibleUsers = scopedUsers.slice(0, visibleCards);
  const scopedEmails = useMemo(() => new Set(scopedUsers.map(userEmail).filter(Boolean)), [scopedUsers]);
  const scopedEvents = audit
    .filter((event) => eventInPeriod(event, effectivePeriod, from, to))
    .filter((event) => eventMatchesCompany(event, company))
    .filter((event) => !(selectedType.requireCompany && !company))
    .filter((event) => !selectedUser || event.actor_email === selectedUser)
    .filter((event) => {
      if (mode !== "user" || selectedUser) return true;
      if (userType === "all" && !company) return true;
      return event.actor_email ? scopedEmails.has(event.actor_email) : false;
    });
  const visibleEventsList = scopedEvents.slice(0, visibleEvents);
  const companyList = companies.filter((item) => normalize(`${item.name} ${item.slug ?? ""}`).includes(normalize(query))).slice(0, visibleCards);
  const defectsInPeriod = defects.filter((defect) => {
    const date = defect.created_at ?? defect.updated_at;
    return date ? new Date(date).getTime() >= Date.now() - effectivePeriod * 86400000 : false;
  });
  const userMetricMode = mode === "user" && (userType !== "all" || selectedUser || company);
  const title = mode === "user" ? `${selectedUser ? nameFromEmail(selectedUser) : roleLabel(userType)}${company ? ` · ${company.name}` : ""}` : company?.name ?? "Operação geral";
  const planCount = company ? new Set(company.releases.map((release) => release.project || release.app || release.qaseProject || release.title).filter(Boolean)).size : overview?.projectRows?.length ?? 0;

  function selectUser(user: AdminUser) {
    setSelectedUser(userEmail(user) || null);
    if (roleOf(user) === "company_user") {
      const userCompany = firstCompanyForUser(user, companies);
      if (userCompany) setSelectedCompany(keyOf(userCompany));
    }
  }

  return <div className="text-[#011848] dark:text-white"><div className="flex flex-col gap-6 px-3 py-4 sm:px-4 lg:px-8">
    <section className="tc-hero-panel"><div className="flex flex-col gap-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="tc-hero-title">Visão Geral</h1><p className="mt-1 text-sm font-semibold text-white/70">{title} · {hasRange ? `${shortDate(from)} até ${shortDate(to)}` : `últimos ${period} dias`}</p></div><div className="relative flex flex-wrap gap-2">{loading ? <span className="self-center text-xs font-black uppercase tracking-[.22em] text-white/70">Atualizando...</span> : null}<div className="flex gap-1 rounded-2xl border border-white/16 bg-white/10 p-1">{periods.map((item) => <button key={item} type="button" onClick={() => { setPeriod(item); setFrom(""); setTo(""); }} className={!hasRange && period === item ? "rounded-xl bg-white px-3 py-2 text-xs font-black text-[#011848]" : "rounded-xl px-3 py-2 text-xs font-black text-white/75"}>{item === 7 ? "Semana" : `${item} dias`}</button>)}<button type="button" onClick={() => setShowCalendar((value) => !value)} className={hasRange ? "rounded-xl bg-white px-3 py-2 text-xs font-black text-[#011848]" : "rounded-xl px-3 py-2 text-xs font-black text-white/75"}><FiCalendar className="inline" /> Período</button></div>{showCalendar ? <div className="absolute right-0 top-[calc(100%+.5rem)] z-30 w-80 rounded-3xl border border-white/16 bg-white p-4 text-[#011848] shadow-2xl dark:bg-[#07111f] dark:text-white"><p className="text-xs font-black uppercase tracking-[.22em] text-[var(--tc-text-muted)]">Filtrar por período</p><div className="mt-3 grid grid-cols-2 gap-3"><label className="text-xs font-bold">De<input type="date" value={draftFrom} onChange={(event) => setDraftFrom(event.target.value)} className="mt-1 w-full rounded-xl border border-[var(--tc-border)] bg-white px-3 py-2 dark:bg-[#0b1628]" /></label><label className="text-xs font-bold">Até<input type="date" value={draftTo} onChange={(event) => setDraftTo(event.target.value)} className="mt-1 w-full rounded-xl border border-[var(--tc-border)] bg-white px-3 py-2 dark:bg-[#0b1628]" /></label></div><div className="mt-3 flex gap-2"><button type="button" onClick={() => { if (draftFrom && draftTo) { setFrom(draftFrom); setTo(draftTo); setShowCalendar(false); } }} className="rounded-xl bg-[var(--tc-primary)] px-3 py-2 text-xs font-black text-white">Aplicar</button><button type="button" onClick={() => { setFrom(""); setTo(""); setDraftFrom(""); setDraftTo(""); }} className="rounded-xl border border-[var(--tc-border)] px-3 py-2 text-xs font-black">Limpar</button></div></div> : null}</div></div><div className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-3 border-t border-white/12 pt-4 sm:grid-cols-5"><StatCard icon={FiActivity} value={userMetricMode ? countBy(scopedEvents, /run|execu/) : companyReleases.length} label="Runs" /><StatCard icon={FiClipboard} value={userMetricMode ? countBy(scopedEvents, /plano|plan/) : planCount} label="Planos de teste" /><StatCard icon={FiShield} value={userMetricMode ? countBy(scopedEvents, /caso|case|teste|test/) : total(stats)} label="Casos de teste" /><StatCard icon={FiAlertTriangle} value={userMetricMode ? countBy(scopedEvents, /defeito|defect|bug|falha/) : defectsInPeriod.length} label="Defeitos" /><StatCard icon={FiUsers} value={scopedEvents.length} label="Eventos" /></div></div></section>

    <section className="space-y-4"><div className="flex flex-col gap-3"><div className="flex flex-wrap gap-2"><button type="button" onClick={() => { setMode("company"); setSelectedUser(null); }} className={`tc-button-${mode === "company" ? "primary" : "secondary"}`}><FiBriefcase /> Empresa</button><button type="button" onClick={() => { setMode("user"); setSelectedUser(null); }} className={`tc-button-${mode === "user" ? "primary" : "secondary"}`}><FiUsers /> Usuário</button></div>{mode === "user" ? <div className="rounded-[26px] border border-[var(--tc-border)] bg-white/50 p-3 dark:bg-white/[0.03]"><div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[.18em] text-[#64748b] dark:text-white/55"><FiFilter /> Filtros de usuários</div><div className="grid gap-3 lg:grid-cols-[minmax(240px,320px)_minmax(220px,320px)_1fr]"><label className="flex items-center gap-2 rounded-[20px] border border-[var(--tc-border)] bg-white px-4 py-3 dark:bg-[#07111f]"><FiUsers className="shrink-0" /><select value={userType} onChange={(event) => { const next = event.target.value as UserType; setUserType(next); setSelectedUser(null); if (next === "leader_tc" || next === "technical_support") setSelectedCompany(null); }} className="w-full bg-transparent text-sm font-black outline-none" aria-label="Selecionar tipo de usuário">{userTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label className="flex items-center gap-2 rounded-[20px] border border-[var(--tc-border)] bg-white px-4 py-3 dark:bg-[#07111f]"><FiBriefcase className="shrink-0" /><select value={selectedCompany ?? "all"} onChange={(event) => { setSelectedCompany(event.target.value === "all" ? null : event.target.value); setSelectedUser(null); }} className="w-full bg-transparent text-sm font-black outline-none" aria-label="Selecionar empresa"><option value="all">{selectedType.requireCompany ? "Selecione uma empresa" : "Todas as empresas"}</option>{companies.map((item) => <option key={keyOf(item)} value={keyOf(item)}>{item.name}</option>)}</select></label><div className="rounded-[20px] border border-[var(--tc-border)] bg-white px-4 py-3 text-sm font-semibold text-[#64748b] dark:bg-[#07111f] dark:text-white/60">{selectedType.help}</div></div></div> : null}<label className="w-full"><div className="flex w-full items-center gap-3 rounded-[20px] border border-[var(--tc-border)] bg-white/45 px-4 py-3 dark:bg-white/[0.03]"><FiSearch /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={mode === "company" ? "Buscar empresa" : "Buscar usuário"} className="w-full bg-transparent text-sm outline-none" /></div></label></div>{selectedType.requireCompany && mode === "user" && !company ? <div className="rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-100">Selecione uma empresa para visualizar esse perfil e suas métricas.</div> : null}<div className="overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"><div className="flex min-w-max gap-3">{mode === "company" ? <><button type="button" onClick={() => setSelectedCompany(null)} className={selectedCompany === null ? contextCardSelected : contextCard}><RoundCompanyAvatar /><span className="min-w-0"><b className="line-clamp-1">Todas as empresas</b><p className="text-sm text-[#64748b] dark:text-white/60">{companies.length} empresas</p></span></button>{companyList.map((item) => <button key={keyOf(item)} type="button" onClick={() => setSelectedCompany(keyOf(item))} className={selectedCompany === keyOf(item) ? contextCardSelected : contextCard}><RoundCompanyAvatar company={item} /><span className="min-w-0"><b className="line-clamp-1">{item.name}</b><p className="text-xs text-[#64748b] dark:text-white/60">{item.releases.length} runs</p></span></button>)}</> : <><button type="button" onClick={() => setSelectedUser(null)} className={selectedUser === null ? contextCardSelected : contextCard}><RoundUserAvatar name={roleLabel(userType)} /><span><b>{roleLabel(userType)}</b><p className="text-sm text-[#64748b] dark:text-white/60">{company?.name ?? "Histórico geral"}</p></span></button>{visibleUsers.map((user) => { const email = userEmail(user); const name = user.name?.trim() || nameFromEmail(email); const userCompany = user.company_name ?? user.company_names?.[0] ?? user.companyNames?.[0] ?? user.companies?.[0]?.name ?? "Sem empresa fixa"; return <button key={email} type="button" onClick={() => selectUser(user)} className={selectedUser === email ? contextCardSelected : contextCard}><RoundUserAvatar src={avatarFromUser(user)} name={name} /><span className="min-w-0"><b className="line-clamp-1">{name}</b><p className="truncate text-xs text-[#64748b] dark:text-white/60">{roleLabel(roleOf(user))} · {userCompany}</p></span></button>; })}{scopedUsers.length > visibleUsers.length ? <button type="button" onClick={() => setVisibleCards((value) => value + FIRST_ITEMS)} className={contextCard}><RoundUserAvatar name="Ver mais usuários" /><span><b>Ver mais usuários</b><p className="text-sm text-[#64748b] dark:text-white/60">Carregar mais</p></span></button> : null}</>}</div></div></section>

    <div className="grid gap-6"><section className="min-w-0"><h2 className="text-xl font-black tracking-[-.04em]">Eventos recentes</h2><p className="mt-1 text-sm text-[#64748b] dark:text-white/60">Exibindo ações do período filtrado: criação, status, runs, planos, testes, defeitos, suporte, usuários, vínculos, comentários e permissões.</p><div className="mt-5 space-y-0">{visibleEventsList.length ? visibleEventsList.map((event, index) => { const [eventTitle, detail, color] = eventKind(event); return <div key={event.id} className="relative flex gap-4 pb-6"><div className="flex flex-col items-center"><RoundUserAvatar name={nameFromEmail(event.actor_email)} size="sm" />{index < visibleEventsList.length - 1 ? <span className="mt-2 h-full min-h-10 w-px bg-[var(--tc-border)]" /> : null}</div><div className="min-w-0 flex-1 pt-1"><div className="flex flex-wrap items-center gap-2"><b>{eventTitle}</b><span className={`h-2.5 w-2.5 rounded-full ${color}`} aria-hidden /></div><p className="mt-1 text-sm text-[#64748b] dark:text-white/60">{detail}</p><p className="mt-2 text-sm text-[#64748b] dark:text-white/60">{event.entity_label ?? event.action}</p><small>{shortDate(event.created_at)} · {event.actor_email ?? "Sistema"}</small></div></div>; }) : <p className="py-4 text-sm text-[#64748b] dark:text-white/60">Nenhuma ação encontrada para este contexto no período filtrado.</p>}{scopedEvents.length > visibleEventsList.length ? <button type="button" onClick={() => setVisibleEvents((value) => value + FIRST_EVENTS)} className="w-full rounded-2xl border border-[var(--tc-border)] px-4 py-3 text-sm font-black">Ver mais eventos</button> : null}</div></section></div>
  </div></div>;
}
