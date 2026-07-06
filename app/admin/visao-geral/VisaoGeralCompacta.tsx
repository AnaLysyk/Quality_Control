"use client";

import { useEffect, useMemo, useState } from "react";
import type { IconType } from "react-icons";
import {
  FiActivity,
  FiAlertTriangle,
  FiBriefcase,
  FiCalendar,
  FiClipboard,
  FiFilter,
  FiSearch,
  FiShield,
  FiUser,
  FiUsers,
} from "react-icons/fi";

import { fetchApi } from "@/lib/api";
import { unwrapEnvelopeData } from "@/lib/apiEnvelope";
import type { CompanyRow, Stats } from "@/lib/quality";
import { buildPieGradient } from "./pieChartUtils";

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

type AdminUserCompanyItem = {
  id?: string | null;
  name?: string | null;
  slug?: string | null;
  role?: string | null;
};

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
  companies?: AdminUserCompanyItem[];
};

type ActorProfile = { name: string; avatar: string | null };
type Mode = "company" | "user";
type UserKind = "all" | "company_user" | "testing_company_user" | "leader_tc" | "technical_support" | "empresa";
type Slice = { label: string; value: number; color: string };

const FIRST_ITEMS = 6;
const FIRST_EVENTS = 5;
const periods = [7, 30, 90] as const;
const USER_KIND_OPTIONS: Array<{ value: UserKind; label: string; description: string; requiresCompany?: boolean }> = [
  { value: "all", label: "Todos os tipos", description: "Lista geral de ações e usuários." },
  { value: "company_user", label: "Usuário empresarial", description: "Obrigatório selecionar empresa para ver usuários e dados do escopo.", requiresCompany: true },
  { value: "testing_company_user", label: "Usuário TC", description: "Visão geral por usuário TC, com opção de recortar por empresa." },
  { value: "leader_tc", label: "Líder TC", description: "Ações administrativas: empresas, usuários, vínculos, permissões e solicitações." },
  { value: "technical_support", label: "Suporte técnico", description: "Movimentações de chamados, comentários, status e ações técnicas." },
  { value: "empresa", label: "Perfil empresa", description: "Conta institucional da empresa selecionada.", requiresCompany: true },
];

const statCard =
  "rounded-[22px] border border-white/15 bg-white/10 p-4 text-white shadow-[0_18px_38px_rgba(1,24,72,.12)] backdrop-blur-sm ring-1 ring-white/5";
const contextCard =
  "group relative flex h-28 w-52 shrink-0 flex-col justify-between overflow-hidden rounded-3xl border border-[var(--tc-border)] bg-white/75 px-4 py-3 text-left transition hover:border-[rgba(239,0,1,.24)] hover:bg-white dark:bg-white/[0.03] dark:hover:bg-white/[0.06]";
const contextCardSelected =
  "group relative flex h-28 w-52 shrink-0 flex-col justify-between overflow-hidden rounded-3xl border border-[rgba(239,0,1,.55)] bg-white/90 px-4 py-3 text-left shadow-[inset_4px_0_0_var(--tc-accent),0_18px_32px_rgba(1,24,72,.10)] dark:bg-white/[0.05]";

function normalize(value?: string | null) {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function shortDate(value?: string | null) {
  if (!value) return "--";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString("pt-BR") : "--";
}

function total(stats?: Stats | null) {
  return stats ? stats.pass + stats.fail + stats.blocked + stats.notRun : 0;
}

function keyOf(company: CompanyRow) {
  return company.slug ?? company.id;
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
  const id = normalize(company.id);
  return Boolean((name && text.includes(name)) || (slug && text.includes(slug)) || (id && text.includes(id)));
}

function normalizeRole(value?: string | null): UserKind | null {
  const normalized = normalize(value).replace(/[\s-]+/g, "_");
  if (!normalized) return null;
  if (normalized.includes("technical_support") || normalized.includes("suporte")) return "technical_support";
  if (normalized.includes("leader_tc") || normalized.includes("lider_tc")) return "leader_tc";
  if (normalized.includes("testing_company_user") || normalized === "tc" || normalized.includes("usuario_tc")) return "testing_company_user";
  if (normalized.includes("company_user") || normalized.includes("usuario_empresa") || normalized.includes("empresarial")) return "company_user";
  if (normalized === "empresa" || normalized.includes("company_admin")) return "empresa";
  return null;
}

function userKindOf(user: AdminUser): UserKind {
  return normalizeRole(user.profile_kind) ?? normalizeRole(user.permission_role) ?? normalizeRole(user.role) ?? "testing_company_user";
}

function userKindLabel(kind: UserKind) {
  return USER_KIND_OPTIONS.find((option) => option.value === kind)?.label ?? "Tipo de usuário";
}

function userEmailOf(user: AdminUser) {
  return user.email?.trim() ?? user.id ?? "";
}

function collectUserCompanyKeys(user: AdminUser) {
  const keys = new Set<string>();
  const add = (value?: string | null) => {
    const key = normalize(value).trim();
    if (key) keys.add(key);
  };

  add(user.client_id);
  add(user.company_name);
  user.company_ids?.forEach(add);
  user.companyIds?.forEach(add);
  user.company_names?.forEach(add);
  user.companyNames?.forEach(add);
  user.companies?.forEach((company) => {
    add(company.id);
    add(company.slug);
    add(company.name);
  });

  return keys;
}

function companyKeys(company: CompanyRow | null) {
  const keys = new Set<string>();
  if (!company) return keys;
  [company.id, company.slug, company.name].forEach((value) => {
    const key = normalize(value).trim();
    if (key) keys.add(key);
  });
  return keys;
}

function userMatchesCompany(user: AdminUser, company: CompanyRow | null) {
  if (!company) return true;
  const userKeys = collectUserCompanyKeys(user);
  const selectedKeys = companyKeys(company);
  if (!selectedKeys.size) return true;
  for (const key of selectedKeys) {
    if (userKeys.has(key)) return true;
  }
  return false;
}

function supportRelevantAction(event: Audit) {
  const text = normalize(`${event.action} ${event.entity_type ?? ""} ${event.entity_label ?? ""}`);
  return /ticket|chamado|suporte|support|coment|comment|status|mover|move|moviment/.test(text);
}

function Pie({ title, slices, note }: { title: string; note: string; slices: Slice[] }) {
  const sum = slices.reduce((acc, slice) => acc + slice.value, 0);
  if (!sum) return null;

  return (
    <section className="rounded-[28px] border border-[var(--tc-border)] bg-white/60 p-4 dark:bg-white/[0.03]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black tracking-[-.04em]">{title}</h2>
          <p className="mt-1 text-sm text-[#64748b] dark:text-white/60">{note}</p>
        </div>
        <div className="relative h-32 w-32 rounded-full" style={{ background: buildPieGradient(slices) }}>
          <div className="absolute inset-8 flex items-center justify-center rounded-full bg-white text-sm font-black dark:bg-[#07111f]">
            {sum}
          </div>
        </div>
      </div>
      <div className="mt-4 grid gap-2">
        {slices.filter((slice) => slice.value > 0).map((slice) => (
          <div key={slice.label} className="flex justify-between rounded-2xl border border-[var(--tc-border)] bg-transparent px-3 py-2 text-sm">
            <span className="flex items-center gap-2 text-[#64748b] dark:text-white/60">
              <i className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: slice.color }} />
              {slice.label}
            </span>
            <b>{slice.value}</b>
          </div>
        ))}
      </div>
    </section>
  );
}

function eventKind(item: Audit) {
  const text = normalize(`${item.action} ${item.entity_type ?? ""} ${item.entity_label ?? ""}`);
  const action = humanizeAction(item.action);

  if (/defeito|defect|bug|falha/.test(text) && /create|created|criou|novo|open|opened|abert/.test(text)) return { title: "Defeito aberto", detail: "Registro de defeito criado no período filtrado.", color: "bg-rose-500" };
  if (/defeito|defect|bug|falha/.test(text) && /status|update|alter|resolved|closed|fech|conclu/.test(text)) return { title: "Status de defeito alterado", detail: "Defeito teve mudança de status ou atualização.", color: "bg-rose-500" };
  if (/run|execu/.test(text) && /finish|finished|closed|completed|finaliz|conclu/.test(text)) return { title: "Run finalizada", detail: "Execução encerrada dentro do período filtrado.", color: "bg-emerald-500" };
  if (/run|execu/.test(text) && /create|created|criou|novo|open|opened|abert/.test(text)) return { title: "Run criada", detail: "Nova execução criada no período filtrado.", color: "bg-violet-500" };
  if (/run|execu/.test(text) && /status|update|alter|andamento|progress/.test(text)) return { title: "Status da run alterado", detail: "Execução teve alteração de andamento ou status.", color: "bg-violet-500" };
  if (/plano|plan/.test(text) && /create|created|criou|novo/.test(text)) return { title: "Plano de teste criado", detail: "Novo plano de teste registrado no período.", color: "bg-emerald-500" };
  if (/plano|plan/.test(text)) return { title: "Plano de teste atualizado", detail: "Plano de teste teve alteração ou movimentação.", color: "bg-emerald-500" };
  if (/caso|case|teste|test/.test(text) && /finish|finished|finaliz|conclu|passed|failed|blocked|execut/.test(text)) return { title: "Teste finalizado", detail: "Caso de teste recebeu resultado de execução.", color: "bg-sky-500" };
  if (/caso|case|teste|test|repositorio/.test(text) && /create|created|criou|novo/.test(text)) return { title: "Caso de teste criado", detail: "Novo caso de teste registrado no repositório.", color: "bg-sky-500" };
  if (/ticket|chamado|suporte|support/.test(text) && /comment|coment/.test(text)) return { title: "Comentário em chamado", detail: "Chamado recebeu comentário ou retorno do suporte.", color: "bg-amber-500" };
  if (/ticket|chamado|suporte|support/.test(text) && /status|update|alter|mover|move|moviment/.test(text)) return { title: "Status do chamado movido", detail: "Suporte técnico movimentou status de chamado.", color: "bg-amber-500" };
  if (/ticket|chamado|suporte|support/.test(text)) return { title: "Chamado de suporte movimentado", detail: "Chamado ou solicitação recebeu ação no período.", color: "bg-amber-500" };
  if (/empresa|company|projeto|project/.test(text) && /create|created|criou|novo/.test(text)) return { title: "Empresa ou projeto criado", detail: "Cadastro institucional criado no período.", color: "bg-indigo-500" };
  if (/empresa|company|projeto|project/.test(text)) return { title: "Empresa ou projeto atualizado", detail: "Cadastro institucional recebeu alteração.", color: "bg-indigo-500" };
  if (/usuario|user|vincul|invite|convite|permission|permissao|perfil|role/.test(text)) return { title: "Usuário ou permissão alterada", detail: "Usuário, vínculo ou permissão teve atualização.", color: "bg-cyan-500" };
  if (/status|update|alter|mudou|troca/.test(text)) return { title: "Status atualizado", detail: "Item do sistema teve status ou dados alterados.", color: "bg-sky-500" };
  if (/delete|deleted|remove|removed|exclu|apag/.test(text)) return { title: "Exclusão realizada", detail: "Item foi removido ou desvinculado no período.", color: "bg-red-500" };
  if (/create|created|criou|novo|nova/.test(text)) return { title: "Criação registrada", detail: "Novo item criado no sistema.", color: "bg-emerald-500" };

  return { title: `Ação registrada: ${action || "sistema"}`, detail: "Ação do sistema sem categoria específica mapeada ainda.", color: "bg-slate-500" };
}

function StatCard({ icon: Icon, value, label }: { icon: IconType; value: string | number; label: string }) {
  return (
    <div className={statCard}>
      <Icon className="text-white/72" />
      <b className="mt-2 block text-2xl">{value}</b>
      <small className="font-semibold text-white/72">{label}</small>
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

export default function VisaoGeralCompacta() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [defects, setDefects] = useState<Defect[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [actorProfiles, setActorProfiles] = useState<Record<string, ActorProfile>>({});
  const [period, setPeriod] = useState<(typeof periods)[number]>(30);
  const [mode, setMode] = useState<Mode>("company");
  const [userKindFilter, setUserKindFilter] = useState<UserKind>("all");
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
    return () => { ok = false; };
  }, [effectivePeriod, from, hasRange, to]);

  useEffect(() => {
    let ok = true;
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
        });
    }, 500);
    return () => {
      ok = false;
      window.clearTimeout(id);
    };
  }, [effectivePeriod, from, hasRange, selectedCompany, to, visibleEvents]);

  useEffect(() => {
    let ok = true;
    const id = window.setTimeout(() => {
      const params = selectedCompany ? `?client_id=${encodeURIComponent(selectedCompany)}` : "";
      fetchApi(`/api/admin/users${params}`, { cache: "no-store" })
        .then((response) => response.json().then((json) => ({ response, json })).catch(() => ({ response, json: null })))
        .then(({ response, json }) => {
          if (!ok || !response.ok) return;
          const data = unwrapEnvelopeData<{ items?: AdminUser[] }>(json) ?? json;
          const items = Array.isArray(data?.items) ? data.items : [];
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
    }, mode === "user" ? 250 : 700);

    return () => {
      ok = false;
      window.clearTimeout(id);
    };
  }, [audit.length, mode, selectedCompany]);

  useEffect(() => {
    setVisibleCards(FIRST_ITEMS);
    setVisibleEvents(FIRST_EVENTS);
  }, [mode, query, selectedCompany, selectedUser, userKindFilter, effectivePeriod]);

  const companies = overview?.companies ?? [];
  const company = selectedCompany ? companies.find((entry) => keyOf(entry) === selectedCompany || entry.id === selectedCompany) ?? null : null;
  const selectedUserKind = USER_KIND_OPTIONS.find((option) => option.value === userKindFilter) ?? USER_KIND_OPTIONS[0];
  const requiresCompany = mode === "user" && selectedUserKind.requiresCompany === true;
  const missingRequiredCompany = requiresCompany && !company;
  const releases = company ? company.releases : companies.flatMap((entry) => entry.releases);
  const stats = company ? mergeStats(company.releases) : overview?.globalStats ?? null;
  const filteredCompanies = companies.filter((entry) => normalize(`${entry.name} ${entry.slug ?? ""}`).includes(normalize(query)));
  const shownCompanies = filteredCompanies.slice(0, visibleCards);
  const filteredUsers = adminUsers
    .filter((user) => userKindFilter === "all" || userKindOf(user) === userKindFilter)
    .filter((user) => !company || userMatchesCompany(user, company))
    .filter((user) => !missingRequiredCompany)
    .filter((user) => normalize(`${user.name ?? ""} ${user.email ?? ""} ${user.company_name ?? ""}`).includes(normalize(query)));
  const shownUsers = filteredUsers.slice(0, visibleCards);
  const scopedUserEmails = useMemo(() => new Set(filteredUsers.map(userEmailOf).filter(Boolean)), [filteredUsers]);
  const filteredEvents = audit
    .filter((event) => isInsidePeriod(event.created_at, effectivePeriod, from, to))
    .filter((event) => eventMatchesCompany(event, company))
    .filter((event) => !missingRequiredCompany)
    .filter((event) => !selectedUser || event.actor_email === selectedUser)
    .filter((event) => {
      if (mode !== "user" || selectedUser) return true;
      if (userKindFilter === "technical_support" && !supportRelevantAction(event)) return false;
      if (userKindFilter === "all" && !company) return true;
      return event.actor_email ? scopedUserEmails.has(event.actor_email) : false;
    });
  const shownEvents = filteredEvents.slice(0, visibleEvents);
  const linkedDefects = defects
    .filter((defect) => isInsidePeriod(defect.created_at ?? defect.updated_at, effectivePeriod, from, to))
    .filter((defect) => defect.run_id !== null && defect.run_id !== undefined && String(defect.run_id).trim()).length;
  const defectsInPeriod = defects.filter((defect) => isInsidePeriod(defect.created_at ?? defect.updated_at, effectivePeriod, from, to));
  const testCaseCount = total(stats);
  const planCount = company ? Math.max(0, new Set(company.releases.map((release) => release.project || release.app || release.qaseProject || release.title).filter(Boolean)).size) : overview?.projectRows?.length ?? 0;
  const hasInsightCards = total(stats) > 0 || defectsInPeriod.length > 0;
  const contextTitle = mode === "user"
    ? `${userKindLabel(userKindFilter)}${company ? ` · ${company.name}` : ""}`
    : company?.name ?? "Operação geral";

  return (
    <div className="text-[#011848] dark:text-white">
      <div className="flex flex-col gap-6 px-3 py-4 sm:px-4 lg:px-8">
        <section className="tc-hero-panel">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="tc-hero-title">Visão Geral</h1>
                <p className="mt-1 text-sm font-semibold text-white/70">
                  {contextTitle} · {hasRange ? `${shortDate(from)} até ${shortDate(to)}` : `últimos ${period} dias`}
                </p>
              </div>
              <div className="relative flex flex-wrap gap-2">
                {loading ? <span className="self-center text-xs font-black uppercase tracking-[.22em] text-white/70">Atualizando...</span> : null}
                <div className="flex gap-1 rounded-2xl border border-white/16 bg-white/10 p-1">
                  {periods.map((item) => (
                    <button key={item} type="button" onClick={() => { setPeriod(item); setFrom(""); setTo(""); }} className={!hasRange && period === item ? "rounded-xl bg-white px-3 py-2 text-xs font-black text-[#011848]" : "rounded-xl px-3 py-2 text-xs font-black text-white/75"}>
                      {item === 7 ? "Semana" : `${item} dias`}
                    </button>
                  ))}
                  <button type="button" onClick={() => setShowCalendar((value) => !value)} className={hasRange ? "rounded-xl bg-white px-3 py-2 text-xs font-black text-[#011848]" : "rounded-xl px-3 py-2 text-xs font-black text-white/75"}>
                    <FiCalendar className="inline" /> Período
                  </button>
                </div>
                {showCalendar ? (
                  <div className="absolute right-0 top-[calc(100%+.5rem)] z-30 w-80 rounded-3xl border border-white/16 bg-white p-4 text-[#011848] shadow-2xl dark:bg-[#07111f] dark:text-white">
                    <p className="text-xs font-black uppercase tracking-[.22em] text-[var(--tc-text-muted)]">Filtrar por período</p>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <label className="text-xs font-bold">De<input type="date" value={draftFrom} onChange={(event) => setDraftFrom(event.target.value)} className="mt-1 w-full rounded-xl border border-[var(--tc-border)] bg-white px-3 py-2 dark:bg-[#0b1628]" /></label>
                      <label className="text-xs font-bold">Até<input type="date" value={draftTo} onChange={(event) => setDraftTo(event.target.value)} className="mt-1 w-full rounded-xl border border-[var(--tc-border)] bg-white px-3 py-2 dark:bg-[#0b1628]" /></label>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button type="button" onClick={() => { if (draftFrom && draftTo) { setFrom(draftFrom); setTo(draftTo); setShowCalendar(false); } }} className="rounded-xl bg-[var(--tc-primary)] px-3 py-2 text-xs font-black text-white">Aplicar</button>
                      <button type="button" onClick={() => { setFrom(""); setTo(""); setDraftFrom(""); setDraftTo(""); }} className="rounded-xl border border-[var(--tc-border)] px-3 py-2 text-xs font-black">Limpar</button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
            <div className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-3 border-t border-white/12 pt-4 sm:grid-cols-5">
              <StatCard icon={FiActivity} value={releases.length} label="Runs" />
              <StatCard icon={FiClipboard} value={planCount} label="Planos de teste" />
              <StatCard icon={FiShield} value={testCaseCount} label="Casos de teste" />
              <StatCard icon={FiAlertTriangle} value={defectsInPeriod.length} label="Defeitos" />
              <StatCard icon={FiUsers} value={filteredEvents.length} label="Eventos" />
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => { setMode("company"); setSelectedUser(null); }} className={`tc-button-${mode === "company" ? "primary" : "secondary"}`}><FiBriefcase /> Empresa</button>
              <button type="button" onClick={() => { setMode("user"); setSelectedUser(null); }} className={`tc-button-${mode === "user" ? "primary" : "secondary"}`}><FiUsers /> Usuário</button>
            </div>

            {mode === "user" ? (
              <div className="grid gap-3 lg:grid-cols-[minmax(220px,300px)_minmax(220px,320px)_1fr]">
                <label className="flex items-center gap-2 rounded-[20px] border border-[var(--tc-border)] bg-white/45 px-4 py-3 dark:bg-white/[0.03]">
                  <FiFilter className="shrink-0" />
                  <select
                    value={userKindFilter}
                    onChange={(event) => {
                      setUserKindFilter(event.target.value as UserKind);
                      setSelectedUser(null);
                    }}
                    className="w-full bg-transparent text-sm font-black outline-none"
                    aria-label="Selecionar tipo de usuário"
                  >
                    {USER_KIND_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>

                <label className="flex items-center gap-2 rounded-[20px] border border-[var(--tc-border)] bg-white/45 px-4 py-3 dark:bg-white/[0.03]">
                  <FiBriefcase className="shrink-0" />
                  <select
                    value={selectedCompany ?? "all"}
                    onChange={(event) => {
                      setSelectedCompany(event.target.value === "all" ? null : event.target.value);
                      setSelectedUser(null);
                    }}
                    className="w-full bg-transparent text-sm font-black outline-none"
                    aria-label="Selecionar empresa para usuários"
                  >
                    <option value="all">{selectedUserKind.requiresCompany ? "Selecione uma empresa" : "Todas as empresas"}</option>
                    {companies.map((entry) => (
                      <option key={keyOf(entry)} value={keyOf(entry)}>{entry.name}</option>
                    ))}
                  </select>
                </label>

                <div className="rounded-[20px] border border-[var(--tc-border)] bg-white/45 px-4 py-3 text-sm font-semibold text-[#64748b] dark:bg-white/[0.03] dark:text-white/60">
                  {selectedUserKind.description}
                </div>
              </div>
            ) : null}

            <label className="w-full">
              <div className="flex w-full items-center gap-3 rounded-[20px] border border-[var(--tc-border)] bg-white/45 px-4 py-3 dark:bg-white/[0.03]">
                <FiSearch />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={mode === "company" ? "Buscar empresa" : "Buscar usuário"} className="w-full bg-transparent text-sm outline-none" />
              </div>
            </label>
          </div>

          {missingRequiredCompany ? (
            <div className="rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-100">
              Selecione uma empresa para visualizar usuários empresariais, perfil empresa e as métricas desse escopo.
            </div>
          ) : null}

          <div className="overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex min-w-max gap-3">
              {mode === "company" ? (
                <>
                  <button type="button" onClick={() => setSelectedCompany(null)} className={selectedCompany === null ? contextCardSelected : contextCard}>
                    <RoundCompanyAvatar />
                    <span className="min-w-0"><b className="line-clamp-1">Todas as empresas</b><p className="text-sm text-[#64748b] dark:text-white/60">{companies.length} empresas</p></span>
                  </button>
                  {shownCompanies.map((entry) => (
                    <button key={keyOf(entry)} type="button" onClick={() => setSelectedCompany(keyOf(entry))} className={selectedCompany === keyOf(entry) ? contextCardSelected : contextCard}>
                      <RoundCompanyAvatar company={entry} />
                      <span className="min-w-0"><b className="line-clamp-1">{entry.name}</b><p className="text-xs text-[#64748b] dark:text-white/60">{entry.releases.length} runs</p></span>
                    </button>
                  ))}
                  {filteredCompanies.length > shownCompanies.length ? <button type="button" onClick={() => setVisibleCards((value) => value + FIRST_ITEMS)} className={contextCard}><RoundCompanyAvatar /><span><b>Ver mais empresas</b><p className="text-sm text-[#64748b] dark:text-white/60">Carregar mais</p></span></button> : null}
                </>
              ) : (
                <>
                  <button type="button" onClick={() => setSelectedUser(null)} className={selectedUser === null ? contextCardSelected : contextCard}>
                    <RoundUserAvatar name={userKindLabel(userKindFilter)} />
                    <span><b>{userKindFilter === "all" ? "Todos os usuários" : userKindLabel(userKindFilter)}</b><p className="text-sm text-[#64748b] dark:text-white/60">{company?.name ?? "Histórico geral"}</p></span>
                  </button>
                  {shownUsers.map((user) => {
                    const email = userEmailOf(user);
                    const selected = selectedUser === email;
                    const name = user.name?.trim() || nameFromEmail(email);
                    return (
                      <button key={email} type="button" onClick={() => setSelectedUser(email)} className={selected ? contextCardSelected : contextCard}>
                        <RoundUserAvatar src={avatarFromUser(user)} name={name} />
                        <span className="min-w-0"><b className="line-clamp-1">{name}</b><p className="truncate text-xs text-[#64748b] dark:text-white/60">{userKindLabel(userKindOf(user))} · {email}</p></span>
                      </button>
                    );
                  })}
                  {filteredUsers.length > shownUsers.length ? <button type="button" onClick={() => setVisibleCards((value) => value + FIRST_ITEMS)} className={contextCard}><RoundUserAvatar name="Ver mais usuários" /><span><b>Ver mais usuários</b><p className="text-sm text-[#64748b] dark:text-white/60">Carregar mais</p></span></button> : null}
                </>
              )}
            </div>
          </div>
        </section>

        <div className={hasInsightCards ? "grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]" : "grid gap-6"}>
          <section className="min-w-0">
            <h2 className="text-xl font-black tracking-[-.04em]">Eventos recentes</h2>
            <p className="mt-1 text-sm text-[#64748b] dark:text-white/60">Exibindo ações do período filtrado: criação, status, runs, planos, testes, defeitos, suporte, usuários, vínculos, comentários e permissões.</p>
            <div className="mt-5 space-y-0">
              {shownEvents.length ? (
                shownEvents.map((event, index) => {
                  const meta = eventKind(event);
                  const profile = event.actor_email ? actorProfiles[event.actor_email] : undefined;
                  return (
                    <div key={event.id} className="relative flex gap-4 pb-6">
                      <div className="flex flex-col items-center">
                        <EventAvatar email={event.actor_email} profile={profile} />
                        {index < shownEvents.length - 1 ? <span className="mt-2 h-full min-h-10 w-px bg-[var(--tc-border)]" /> : null}
                      </div>
                      <div className="min-w-0 flex-1 pt-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <b>{meta.title}</b>
                          <span className={`h-2.5 w-2.5 rounded-full ${meta.color}`} aria-hidden />
                        </div>
                        <p className="mt-1 text-sm text-[#64748b] dark:text-white/60">{meta.detail}</p>
                        <p className="mt-2 text-sm text-[#64748b] dark:text-white/60">{event.entity_label ?? humanizeAction(event.action)}</p>
                        <small>{shortDate(event.created_at)} · {profile?.name ?? event.actor_email ?? "Sistema"}</small>
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
              <Pie title="Runs por status" note="Distribuição do contexto filtrado" slices={[{ label: "Aprovados", value: stats?.pass ?? 0, color: "#22c55e" }, { label: "Reprovados", value: stats?.fail ?? 0, color: "#ef4444" }, { label: "Bloqueados", value: stats?.blocked ?? 0, color: "#f59e0b" }, { label: "Em andamento", value: stats?.notRun ?? 0, color: "#60a5fa" }]} />
              <Pie title="Defeitos" note={`${linkedDefects} vinculados a runs · ${defectsInPeriod.length - linkedDefects} soltos`} slices={[{ label: "Com run", value: linkedDefects, color: "#8b5cf6" }, { label: "Soltos", value: defectsInPeriod.length - linkedDefects, color: "#ef4444" }]} />
            </aside>
          ) : null}
        </div>
      </div>
    </div>
  );
}
