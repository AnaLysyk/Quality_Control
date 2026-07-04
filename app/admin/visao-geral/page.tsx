"use client";

import { useEffect, useMemo, useState } from "react";
import {
  FiActivity,
  FiAlertTriangle,
  FiArrowUpRight,
  FiBarChart2,
  FiBriefcase,
  FiCalendar,
  FiClock,
  FiRefreshCw,
  FiSearch,
  FiShield,
  FiUsers,
  FiX,
} from "react-icons/fi";

import { fetchApi } from "@/lib/api";
import {
  extractMessageFromJson,
  extractRequestIdFromJson,
  formatMessageWithRequestId,
  unwrapEnvelopeData,
} from "@/lib/apiEnvelope";
import type { CompanyRow, QualityGateStatus, Stats } from "@/lib/quality";

type QualityOverviewResponse = {
  companies: CompanyRow[];
  period: number;
  coverage: { total: number; withStats: number; percent: number };
  releaseCount: number;
  globalStats: Stats;
  globalPassRate: number | null;
  passRateTone: "good" | "warn" | "neutral";
  gateCounts: Record<string, number>;
  riskCount: number;
  warningCount: number;
  trendPoints: { label: string; value: number | null; total: number }[];
  trendSummary: { direction: "up" | "down" | "flat"; delta: number };
  policy: Record<string, number>;
};

type DefectItem = {
  id: string;
  title: string;
  status: string;
  severity?: string;
  origin?: "manual" | "automatico";
  companyName?: string | null;
  companySlug?: string | null;
  run_id?: string | number | null;
  url?: string;
  createdBy?: string | null;
  created_at?: string;
  updated_at?: string;
  closedAt?: string | null;
};

type DefectsResponse = { items: DefectItem[]; total: number };

type AuditLogItem = {
  id: string;
  created_at: string;
  action: string;
  actor_email: string | null;
  entity_label: string | null;
  entity_type: string | null;
};

type RankingResponse = {
  companies: { slug: string; name: string; score: number; status: "healthy" | "attention" | "risk" }[];
};

type ContextMode = "company" | "user";
type UserFilter = "all" | "tc" | "company";
type ViewMode = "context" | "compare";
type PeriodPreset = 7 | 30 | 90;

type UserOption = {
  id: string;
  name: string;
  email: string;
  tag: "Testing Company" | "Empresarial";
  movements: number;
  latestAt: string | null;
};

type MetricCard = {
  id: string;
  label: string;
  value: string | number;
  note: string;
  icon: typeof FiBarChart2;
};

const PERIOD_OPTIONS: Array<{ value: PeriodPreset; label: string }> = [
  { value: 7, label: "Semana" },
  { value: 30, label: "30 dias" },
  { value: 90, label: "90 dias" },
];

const DEFECT_STATUS_LABEL: Record<string, string> = {
  fail: "Em falha",
  failed: "Em falha",
  blocked: "Bloqueado",
  pending: "Aguardando teste",
  open: "Aberto",
  opened: "Aberto",
  in_progress: "Em andamento",
  progress: "Em andamento",
  done: "Concluído",
  closed: "Concluído",
  resolved: "Resolvido",
};

const GATE_META: Record<QualityGateStatus, { label: string; tone: "positive" | "warning" | "danger" | "neutral" }> = {
  approved: { label: "Saudável", tone: "positive" },
  warning: { label: "Atenção", tone: "warning" },
  failed: { label: "Em risco", tone: "danger" },
  no_data: { label: "Sem dados", tone: "neutral" },
};

const RANKING_STATUS_META: Record<RankingResponse["companies"][number]["status"], { label: string; tone: "positive" | "warning" | "danger" }> = {
  healthy: { label: "Saudável", tone: "positive" },
  attention: { label: "Atenção", tone: "warning" },
  risk: { label: "Em risco", tone: "danger" },
};

function normalizeText(value?: string | null) {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function formatDate(value?: string | null) {
  if (!value) return "--";
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
    : "--";
}

function formatShortDate(value?: string | null) {
  if (!value) return "--";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString("pt-BR", { dateStyle: "short" }) : "--";
}

function formatPercent(value?: number | null) {
  return value == null ? "--" : `${value}%`;
}

function totalStats(stats?: Stats | null) {
  if (!stats) return 0;
  return stats.pass + stats.fail + stats.blocked + stats.notRun;
}

function mergeStats(releases: CompanyRow["releases"]): Stats {
  return releases.reduce<Stats>(
    (acc, release) => {
      const stats = release.stats;
      if (!stats) return acc;
      acc.pass += stats.pass;
      acc.fail += stats.fail;
      acc.blocked += stats.blocked;
      acc.notRun += stats.notRun;
      return acc;
    },
    { pass: 0, fail: 0, blocked: 0, notRun: 0 },
  );
}

function resolveCompanyKey(company: { id: string; slug?: string | null }) {
  return company.slug ?? company.id;
}

function getInitials(value?: string | null) {
  const source = (value ?? "").trim();
  if (!source) return "QC";
  const parts = source.split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((part) => part.slice(0, 1).toUpperCase()).join("") || "QC";
}

function countRuns(company: CompanyRow, statuses: QualityGateStatus | QualityGateStatus[]) {
  const allowed = Array.isArray(statuses) ? statuses : [statuses];
  return company.releases.filter((release) => allowed.includes(release.gate.status)).length;
}

function defectStatusLabel(status?: string | null) {
  const key = normalizeText(status).replace(/\s+/g, "_");
  return DEFECT_STATUS_LABEL[key] ?? status ?? "status";
}

function defectIsActive(defect: DefectItem) {
  const status = normalizeText(defect.status).replace(/\s+/g, "_");
  return !["done", "closed", "resolved", "concluido", "concluído"].includes(status);
}

function matchCompanyDefect(item: DefectItem, company: CompanyRow | null) {
  if (!company) return true;
  const ref = normalizeText(item.companyName);
  const itemSlug = normalizeText(item.companySlug);
  const name = normalizeText(company.name);
  const slug = normalizeText(company.slug);
  return Boolean(ref || itemSlug) && ((ref && name && ref.includes(name)) || (ref && slug && ref.includes(slug)) || (slug && itemSlug === slug));
}

function matchUserDefect(item: DefectItem, user: UserOption | null) {
  if (!user) return true;
  const author = normalizeText(item.createdBy);
  const title = normalizeText(item.title);
  const email = normalizeText(user.email);
  const name = normalizeText(user.name);
  return Boolean(author || title) && ((author && (author.includes(email) || author.includes(name))) || title.includes(email) || title.includes(name));
}

function releaseMatchesUser(release: CompanyRow["releases"][number], user: UserOption | null) {
  if (!user) return true;
  const haystack = normalizeText([release.assignees?.join(" "), release.assigneeNames?.join(" "), release.title, release.summary].filter(Boolean).join(" "));
  const email = normalizeText(user.email);
  const name = normalizeText(user.name);
  return haystack.includes(email) || haystack.includes(name);
}

function buildUserName(email: string) {
  const local = email.split("@")[0] ?? email;
  return local
    .replace(/[._-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ") || email;
}

function resolveUserTag(email: string): UserOption["tag"] {
  const normalized = normalizeText(email);
  return normalized.includes("testing") || normalized.includes("tc") || normalized.includes("paulalysyk")
    ? "Testing Company"
    : "Empresarial";
}

function dateOnly(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function daysBetween(start: string, end: string) {
  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T23:59:59`);
  if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime())) return 30;
  const diff = Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
  return Math.max(1, Math.min(365, diff));
}

function CompanyMark({ name, logo, selected = false }: { name: string; logo?: string | null; selected?: boolean }) {
  const [failed, setFailed] = useState(false);
  const initials = getInitials(name);

  return (
    <div
      className={`flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-[18px] border text-sm font-black shadow-[0_14px_28px_rgba(15,23,42,0.08)] ${
        selected
          ? "border-[rgba(239,0,1,0.22)] bg-[linear-gradient(135deg,rgba(1,24,72,0.95)_0%,rgba(239,0,1,0.92)_100%)] text-white"
          : "border-[var(--tc-border)] bg-[linear-gradient(180deg,var(--tc-surface)_0%,var(--tc-surface-2)_100%)] text-[var(--tc-primary)] dark:text-[var(--tc-text-primary)]"
      }`}
    >
      {logo && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt={`Logo da empresa ${name}`} className="h-full w-full object-cover" onError={() => setFailed(true)} />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
}

function UserMark({ name, selected = false }: { name: string; selected?: boolean }) {
  return (
    <div
      className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] border text-sm font-black shadow-[0_14px_28px_rgba(15,23,42,0.08)] ${
        selected
          ? "border-[rgba(239,0,1,0.22)] bg-[linear-gradient(135deg,rgba(1,24,72,0.95)_0%,rgba(239,0,1,0.92)_100%)] text-white"
          : "border-[var(--tc-border)] bg-[linear-gradient(180deg,var(--tc-surface)_0%,var(--tc-surface-2)_100%)] text-[var(--tc-primary)] dark:text-[var(--tc-text-primary)]"
      }`}
    >
      {getInitials(name)}
    </div>
  );
}

function MetricCardView({ card }: { card: MetricCard }) {
  const Icon = card.icon;
  return (
    <div className="tc-hero-stat">
      <div className="flex items-center gap-2">
        <Icon className="text-white/70" size={14} />
        <div className="tc-hero-stat-label">{card.label}</div>
      </div>
      <div className="tc-hero-stat-value">{card.value}</div>
      <div className="tc-hero-stat-note">{card.note}</div>
    </div>
  );
}

function QuickStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="min-w-0 space-y-1">
      <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--tc-text-muted)]">{label}</div>
      <div className="truncate text-[1.35rem] font-black leading-none text-[var(--tc-text-primary)]">{value}</div>
    </div>
  );
}

export default function VisaoGeralPage() {
  const [overview, setOverview] = useState<QualityOverviewResponse | null>(null);
  const [selectedScopedOverview, setSelectedScopedOverview] = useState<QualityOverviewResponse | null>(null);
  const [defectsPayload, setDefectsPayload] = useState<DefectsResponse | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [ranking, setRanking] = useState<RankingResponse | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [loadingDefects, setLoadingDefects] = useState(true);
  const [loadingAudit, setLoadingAudit] = useState(true);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [defectsError, setDefectsError] = useState<string | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [rankingError, setRankingError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [period, setPeriod] = useState<PeriodPreset>(30);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [showCustomPeriod, setShowCustomPeriod] = useState(false);
  const [contextMode, setContextMode] = useState<ContextMode>("company");
  const [viewMode, setViewMode] = useState<ViewMode>("context");
  const [userFilter, setUserFilter] = useState<UserFilter>("all");
  const [selectedCompanySlug, setSelectedCompanySlug] = useState<string | null>(null);
  const [selectedUserEmail, setSelectedUserEmail] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selectedDefect, setSelectedDefect] = useState<DefectItem | null>(null);

  const effectivePeriod = customStart && customEnd ? daysBetween(customStart, customEnd) : period;
  const periodLabel = customStart && customEnd ? `${formatShortDate(customStart)} até ${formatShortDate(customEnd)}` : `últimos ${period} dias`;
  const firstError = overviewError ?? defectsError ?? auditError ?? rankingError;

  useEffect(() => {
    let canceled = false;
    const loadOverview = async () => {
      setLoadingOverview(true);
      setOverviewError(null);
      try {
        const response = await fetchApi(`/api/admin/quality/overview?period=${effectivePeriod}`, { cache: "no-store" });
        const raw = await response.json().catch(() => null);
        if (!response.ok) {
          const message = extractMessageFromJson(raw) || "Erro ao carregar Visão Geral";
          const requestId = extractRequestIdFromJson(raw) || response.headers.get("x-request-id") || null;
          if (!canceled) setOverview(null);
          if (!canceled) setOverviewError(formatMessageWithRequestId(message, requestId));
          return;
        }
        if (!canceled) setOverview(unwrapEnvelopeData<QualityOverviewResponse>(raw) ?? null);
      } catch {
        if (!canceled) setOverview(null);
        if (!canceled) setOverviewError("Erro ao carregar Visão Geral");
      } finally {
        if (!canceled) setLoadingOverview(false);
      }
    };
    void loadOverview();
    return () => {
      canceled = true;
    };
  }, [effectivePeriod, refreshKey]);

  useEffect(() => {
    let canceled = false;
    if (!selectedCompanySlug) {
      setSelectedScopedOverview(null);
      return () => {
        canceled = true;
      };
    }

    const loadSelectedOverview = async () => {
      try {
        const response = await fetchApi(`/api/admin/quality/overview?period=${effectivePeriod}&company=${encodeURIComponent(selectedCompanySlug)}`, {
          cache: "no-store",
        });
        const raw = await response.json().catch(() => null);
        if (!response.ok) {
          if (!canceled) setSelectedScopedOverview(null);
          return;
        }
        if (!canceled) setSelectedScopedOverview(unwrapEnvelopeData<QualityOverviewResponse>(raw) ?? null);
      } catch {
        if (!canceled) setSelectedScopedOverview(null);
      }
    };
    void loadSelectedOverview();
    return () => {
      canceled = true;
    };
  }, [effectivePeriod, refreshKey, selectedCompanySlug]);

  useEffect(() => {
    let canceled = false;
    const loadDefects = async () => {
      setLoadingDefects(true);
      setDefectsError(null);
      try {
        const defectsUrl = selectedCompanySlug ? `/api/admin/defeitos?company=${encodeURIComponent(selectedCompanySlug)}` : "/api/admin/defeitos";
        const response = await fetchApi(defectsUrl, { cache: "no-store" });
        const raw = await response.json().catch(() => null);
        if (!response.ok) {
          if (!canceled) setDefectsPayload(null);
          if (!canceled) setDefectsError(extractMessageFromJson(raw) || "Erro ao carregar defeitos");
          return;
        }
        if (!canceled) setDefectsPayload(unwrapEnvelopeData<DefectsResponse>(raw) ?? null);
      } catch {
        if (!canceled) setDefectsPayload(null);
        if (!canceled) setDefectsError("Erro ao carregar defeitos");
      } finally {
        if (!canceled) setLoadingDefects(false);
      }
    };
    void loadDefects();
    return () => {
      canceled = true;
    };
  }, [refreshKey, selectedCompanySlug]);

  useEffect(() => {
    let canceled = false;
    const loadAudit = async () => {
      setLoadingAudit(true);
      setAuditError(null);
      try {
        const response = await fetchApi("/api/admin/audit-logs?limit=80", { cache: "no-store" });
        const raw = await response.json().catch(() => null);
        if (!response.ok) {
          if (!canceled) setAuditLogs([]);
          if (!canceled) setAuditError(extractMessageFromJson(raw) || "Erro ao carregar movimentações");
          return;
        }
        const payload = unwrapEnvelopeData<{ items?: AuditLogItem[] }>(raw) ?? null;
        if (!canceled) setAuditLogs(payload?.items ?? []);
      } catch {
        if (!canceled) setAuditLogs([]);
        if (!canceled) setAuditError("Erro ao carregar movimentações");
      } finally {
        if (!canceled) setLoadingAudit(false);
      }
    };
    void loadAudit();
    return () => {
      canceled = true;
    };
  }, [refreshKey]);

  useEffect(() => {
    let canceled = false;
    const loadRanking = async () => {
      setRankingError(null);
      try {
        const response = await fetchApi("/api/admin/metrics/ranking", { cache: "no-store" });
        const raw = await response.json().catch(() => null);
        if (!response.ok) {
          if (!canceled) setRanking(null);
          if (!canceled) setRankingError(extractMessageFromJson(raw) || "Erro ao carregar comparativo");
          return;
        }
        if (!canceled) setRanking((unwrapEnvelopeData<RankingResponse>(raw) ?? raw) as RankingResponse);
      } catch {
        if (!canceled) setRanking(null);
        if (!canceled) setRankingError("Erro ao carregar comparativo");
      }
    };
    void loadRanking();
    return () => {
      canceled = true;
    };
  }, [refreshKey]);

  const companies = useMemo(() => overview?.companies ?? [], [overview]);
  const selectedCompany = useMemo(
    () => (selectedCompanySlug ? companies.find((company) => resolveCompanyKey(company) === selectedCompanySlug) ?? null : null),
    [companies, selectedCompanySlug],
  );

  const users = useMemo<UserOption[]>(() => {
    const map = new Map<string, UserOption>();
    for (const log of auditLogs) {
      const email = log.actor_email?.trim();
      if (!email) continue;
      const current = map.get(email);
      if (current) {
        current.movements += 1;
        if (!current.latestAt || new Date(log.created_at).getTime() > new Date(current.latestAt).getTime()) current.latestAt = log.created_at;
        continue;
      }
      map.set(email, {
        id: email,
        email,
        name: buildUserName(email),
        tag: resolveUserTag(email),
        movements: 1,
        latestAt: log.created_at,
      });
    }
    return [...map.values()].sort((a, b) => b.movements - a.movements || a.name.localeCompare(b.name));
  }, [auditLogs]);

  const filteredCompanies = useMemo(() => {
    const normalizedQuery = normalizeText(query);
    const unique = companies.filter((company, index, source) => source.findIndex((entry) => resolveCompanyKey(entry) === resolveCompanyKey(company)) === index);
    if (contextMode !== "company" || !normalizedQuery) return unique;
    return unique.filter((company) => normalizeText(`${company.name} ${company.slug ?? ""} ${company.id}`).includes(normalizedQuery));
  }, [companies, contextMode, query]);

  const filteredUsers = useMemo(() => {
    const normalizedQuery = normalizeText(query);
    return users.filter((user) => {
      const matchesType = userFilter === "all" || (userFilter === "tc" ? user.tag === "Testing Company" : user.tag === "Empresarial");
      const matchesQuery = !normalizedQuery || normalizeText(`${user.name} ${user.email}`).includes(normalizedQuery);
      return matchesType && matchesQuery;
    });
  }, [query, userFilter, users]);

  const selectedUser = selectedUserEmail ? users.find((user) => user.email === selectedUserEmail) ?? null : null;
  const scopedCompanies = selectedCompany ? [selectedCompany] : companies;
  const scopedReleasesBase = scopedCompanies.flatMap((company) => company.releases);
  const scopedReleases = scopedReleasesBase.filter((release) => releaseMatchesUser(release, selectedUser));
  const scopedStats = selectedUser ? mergeStats(scopedReleases) : selectedCompany ? mergeStats(selectedCompany.releases) : overview?.globalStats ?? null;
  const scopedCaseTotal = totalStats(scopedStats);
  const scopedRunTotal = selectedUser ? scopedReleases.length : selectedCompany ? selectedScopedOverview?.releaseCount ?? selectedCompany.releases.length : overview?.releaseCount ?? scopedReleases.length;
  const passRate = selectedUser
    ? scopedCaseTotal > 0
      ? Math.round(((scopedStats?.pass ?? 0) / scopedCaseTotal) * 100)
      : null
    : selectedCompany
      ? selectedScopedOverview?.globalPassRate ?? selectedCompany.passRate
      : overview?.globalPassRate ?? null;

  const allDefects = defectsPayload?.items ?? [];
  const scopedDefects = allDefects.filter((defect) => matchCompanyDefect(defect, selectedCompany) && matchUserDefect(defect, selectedUser));
  const activeDefects = scopedDefects.filter(defectIsActive);
  const failingOrBlockedDefects = scopedDefects.filter((defect) => ["fail", "failed", "blocked"].includes(normalizeText(defect.status)));

  const scopedAuditLogs = useMemo(() => {
    const base = selectedUser ? auditLogs.filter((log) => log.actor_email === selectedUser.email) : auditLogs;
    const companyFiltered = !selectedCompany
      ? base
      : base.filter((log) => {
          const haystack = normalizeText(`${log.entity_label ?? ""} ${log.entity_type ?? ""}`);
          const companyName = normalizeText(selectedCompany.name);
          const companySlug = normalizeText(selectedCompany.slug);
          return (companyName && haystack.includes(companyName)) || (companySlug && haystack.includes(companySlug));
        });
    return companyFiltered.slice(0, 12);
  }, [auditLogs, selectedCompany, selectedUser]);

  const actionCounts = useMemo(() => {
    const counts = { cases: 0, plans: 0, tickets: 0, deleted: 0 };
    for (const log of scopedAuditLogs) {
      const text = normalizeText(`${log.action} ${log.entity_type} ${log.entity_label}`);
      if (text.includes("case") || text.includes("caso")) counts.cases += 1;
      if (text.includes("plan") || text.includes("plano")) counts.plans += 1;
      if (text.includes("ticket") || text.includes("support") || text.includes("chamado")) counts.tickets += 1;
      if (text.includes("delete") || text.includes("exclu")) counts.deleted += 1;
    }
    return counts;
  }, [scopedAuditLogs]);

  const timelineDays = useMemo(() => {
    const map = new Map<string, AuditLogItem[]>();
    for (const item of scopedAuditLogs) {
      const key = dateOnly(item.created_at);
      if (!key) continue;
      map.set(key, [...(map.get(key) ?? []), item]);
    }
    return [...map.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 7)
      .map(([date, items]) => ({ date, items }));
  }, [scopedAuditLogs]);

  const runStatusData = [
    { id: "pass", label: "Aprovadas", value: scopedStats?.pass ?? 0, className: "bg-emerald-500" },
    { id: "fail", label: "Falhadas", value: scopedStats?.fail ?? 0, className: "bg-rose-500" },
    { id: "blocked", label: "Bloqueadas", value: scopedStats?.blocked ?? 0, className: "bg-amber-500" },
    { id: "notRun", label: "Não executadas", value: scopedStats?.notRun ?? 0, className: "bg-slate-400" },
  ];
  const runStatusTotal = runStatusData.reduce((sum, item) => sum + item.value, 0);

  const metricCards = useMemo<MetricCard[]>(() => {
    const cards: Array<MetricCard & { visible: boolean }> = [
      {
        id: "cases",
        label: "Casos no período",
        value: scopedCaseTotal,
        note: `casos registrados nas execuções em ${periodLabel}`,
        icon: FiBarChart2,
        visible: scopedCaseTotal > 0,
      },
      {
        id: "runs",
        label: "Runs criadas",
        value: scopedRunTotal,
        note: `runs no contexto selecionado em ${periodLabel}`,
        icon: FiActivity,
        visible: scopedRunTotal > 0,
      },
      {
        id: "passRate",
        label: "Taxa média de aprovação",
        value: formatPercent(passRate),
        note: "calculada pelas execuções do período",
        icon: FiBarChart2,
        visible: passRate != null,
      },
      {
        id: "defects",
        label: "Defeitos abertos",
        value: activeDefects.length,
        note: "defeitos ainda ativos no contexto atual",
        icon: FiAlertTriangle,
        visible: activeDefects.length > 0,
      },
      {
        id: "actions",
        label: "Ações executadas",
        value: scopedAuditLogs.length,
        note: "movimentações recentes registradas no período",
        icon: FiUsers,
        visible: scopedAuditLogs.length > 0,
      },
      {
        id: "plans",
        label: "Planos/casos criados",
        value: actionCounts.plans + actionCounts.cases,
        note: "derivado das movimentações registradas",
        icon: FiCalendar,
        visible: actionCounts.plans + actionCounts.cases > 0,
      },
    ];
    return cards.filter((card) => card.visible);
  }, [actionCounts.cases, actionCounts.plans, activeDefects.length, passRate, periodLabel, scopedAuditLogs.length, scopedCaseTotal, scopedRunTotal]);

  const attentionItems = useMemo(() => {
    const items: Array<{ id: string; title: string; detail: string; tone: "danger" | "warning" | "neutral" }> = [];
    const failedRuns = scopedCompanies.reduce((sum, company) => sum + countRuns(company, "failed"), 0);
    const warningRuns = scopedCompanies.reduce((sum, company) => sum + countRuns(company, "warning"), 0);
    if (failedRuns > 0) items.push({ id: "failed-runs", title: `${failedRuns} runs falhadas`, detail: "Há execução com falha no contexto selecionado.", tone: "danger" });
    if (warningRuns > 0) items.push({ id: "warning-runs", title: `${warningRuns} runs em atenção`, detail: "Há execução com sinal de risco no período.", tone: "warning" });
    if (failingOrBlockedDefects.length > 0) items.push({ id: "defects", title: `${failingOrBlockedDefects.length} defeitos críticos`, detail: "Falhas ou bloqueios precisam de leitura.", tone: "danger" });
    return items;
  }, [failingOrBlockedDefects.length, scopedCompanies]);

  const rankedCompanies = useMemo(() => {
    const rows = ranking?.companies ?? [];
    return rows
      .map((entry) => {
        const matchedCompany =
          companies.find((company) => normalizeText(company.slug) === normalizeText(entry.slug)) ??
          companies.find((company) => normalizeText(company.name) === normalizeText(entry.name)) ??
          null;
        const failedRuns = matchedCompany ? countRuns(matchedCompany, "failed") : 0;
        const openRuns = matchedCompany ? matchedCompany.releases.length : 0;
        const statusMeta = RANKING_STATUS_META[entry.status] ?? { label: "Sem dados", tone: "neutral" as const };
        return {
          ...entry,
          failedRuns,
          openRuns,
          passRate: matchedCompany?.passRate ?? null,
          latestRunAt: matchedCompany?.latestRelease?.createdAt ?? null,
          statusLabel: statusMeta.label,
          statusTone: statusMeta.tone,
        };
      })
      .sort((a, b) => b.failedRuns - a.failedRuns || b.openRuns - a.openRuns || a.name.localeCompare(b.name))
      .slice(0, 12);
  }, [companies, ranking?.companies]);

  function clearContext() {
    setSelectedCompanySlug(null);
    setSelectedUserEmail(null);
    setQuery("");
  }

  function applyCustomPeriod() {
    if (!customStart || !customEnd) return;
    setShowCustomPeriod(false);
    setRefreshKey((value) => value + 1);
  }

  function clearCustomPeriod() {
    setCustomStart("");
    setCustomEnd("");
    setShowCustomPeriod(false);
    setRefreshKey((value) => value + 1);
  }

  return (
    <div className="min-h-screen bg-(--page-bg,#eef3fb) text-[var(--tc-text-primary)]">
      <div className="w-full flex flex-col gap-4 px-3 py-4 sm:px-4 sm:py-5 lg:px-8 lg:py-7">
        <section className="tc-hero-panel">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={process.env.NEXT_PUBLIC_MENU_LOGO || "/images/tc.png"} alt="Logo" className="h-12 w-12 rounded-2xl border border-white/20 object-contain p-1 backdrop-blur-sm" />
                <div>
                  <h1 className="tc-hero-title">Visão Geral</h1>
                  <p className="mt-1 text-sm font-semibold text-white/72">
                    {selectedCompany ? selectedCompany.name : selectedUser ? selectedUser.name : "Operação geral"} · {periodLabel}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-stretch gap-3">
                {loadingOverview ? <p className="self-center text-xs font-semibold uppercase tracking-[0.24em] text-white/72">Atualizando...</p> : null}
                {firstError ? <p className="self-center text-sm font-semibold text-white">{firstError}</p> : null}
                <div className="relative">
                  <div className="flex items-center gap-1 rounded-2xl border border-white/14 bg-white/10 p-1 text-white backdrop-blur-sm">
                    {PERIOD_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          setPeriod(option.value);
                          setCustomStart("");
                          setCustomEnd("");
                        }}
                        className={`rounded-xl px-3 py-2 text-xs font-black transition ${period === option.value && !customStart ? "bg-white text-[var(--tc-primary)]" : "text-white/72 hover:text-white"}`}
                      >
                        {option.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setShowCustomPeriod((value) => !value)}
                      className={`rounded-xl px-3 py-2 text-xs font-black transition ${customStart && customEnd ? "bg-white text-[var(--tc-primary)]" : "text-white/72 hover:text-white"}`}
                    >
                      Calendário
                    </button>
                  </div>
                  {showCustomPeriod ? (
                    <div className="absolute right-0 top-[calc(100%+0.5rem)] z-20 w-80 rounded-3xl border border-white/14 bg-slate-950/95 p-4 text-white shadow-2xl backdrop-blur">
                      <p className="text-xs font-black uppercase tracking-[0.22em] text-white/58">Selecionar período</p>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <label className="text-xs font-bold text-white/68">
                          Início
                          <input type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} className="mt-1 w-full rounded-xl border border-white/12 bg-white/10 px-3 py-2 text-sm text-white outline-none" />
                        </label>
                        <label className="text-xs font-bold text-white/68">
                          Fim
                          <input type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} className="mt-1 w-full rounded-xl border border-white/12 bg-white/10 px-3 py-2 text-sm text-white outline-none" />
                        </label>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button type="button" onClick={applyCustomPeriod} className="rounded-xl bg-white px-3 py-2 text-xs font-black text-slate-950">Aplicar</button>
                        <button type="button" onClick={clearCustomPeriod} className="rounded-xl border border-white/14 px-3 py-2 text-xs font-black text-white/75">Limpar</button>
                      </div>
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => setRefreshKey((value) => value + 1)}
                  className="inline-flex min-h-12 items-center gap-3 rounded-[18px] border border-white/16 bg-white px-4 py-3 text-[var(--tc-primary)] shadow-[0_16px_28px_rgba(1,24,72,0.16)] transition hover:-translate-y-0.5"
                >
                  <FiRefreshCw size={15} className={loadingOverview ? "animate-spin" : ""} />
                  <span className="text-sm font-extrabold">Recarregar</span>
                </button>
              </div>
            </div>
            <div className="border-t border-white/12 pt-4">
              {metricCards.length > 0 ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                  {metricCards.map((card) => <MetricCardView key={card.id} card={card} />)}
                </div>
              ) : (
                <div className="rounded-2xl border border-white/14 bg-white/10 px-4 py-4 text-sm font-semibold text-white/78">
                  Sem movimentação no período selecionado. Altere o período ou selecione outra empresa/usuário.
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="tc-panel dashboard-print-hidden">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0 space-y-3">
              <div className="space-y-2">
                <h2 className="text-[1.3rem] font-black tracking-[-0.04em] text-[var(--tc-text-primary)] sm:text-[1.65rem]">Selecionar contexto</h2>
                <p className="max-w-180 text-[0.98rem] leading-7 text-[var(--tc-text-muted)]">
                  Escolha a leitura por empresa ou por usuário. O padrão é últimos 30 dias; use o calendário para selecionar um período específico.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setContextMode("company");
                    setSelectedUserEmail(null);
                    setQuery("");
                  }}
                  className={`tc-button-${contextMode === "company" ? "primary" : "secondary"}`}
                >
                  <FiBriefcase /> Empresa
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setContextMode("user");
                    setSelectedCompanySlug(null);
                    setQuery("");
                  }}
                  className={`tc-button-${contextMode === "user" ? "primary" : "secondary"}`}
                >
                  <FiUsers /> Usuário
                </button>
                {(selectedCompany || selectedUser) ? (
                  <button type="button" onClick={clearContext} className="tc-button-secondary">
                    <FiX /> Limpar seleção
                  </button>
                ) : null}
                <button type="button" onClick={() => setViewMode(viewMode === "context" ? "compare" : "context")} className="tc-button-secondary">
                  <FiBarChart2 /> {viewMode === "context" ? "Comparativo" : "Contexto"}
                </button>
              </div>
            </div>

            <label className="w-full max-w-md">
              <span className="sr-only">Buscar contexto</span>
              <div className="flex items-center gap-3 rounded-[20px] border border-[var(--tc-border)] bg-[var(--tc-surface)] px-4 py-3 shadow-[0_14px_30px_rgba(15,23,42,0.05)] transition focus-within:border-[rgba(239,0,1,0.28)] focus-within:ring-2 focus-within:ring-[rgba(239,0,1,0.10)]">
                <span className="text-[var(--tc-text-muted)]"><FiSearch size={15} /></span>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={contextMode === "company" ? "Buscar empresa" : "Buscar usuário"}
                  className="w-full bg-transparent text-sm font-medium text-[var(--tc-text-primary)] outline-none placeholder:text-[var(--tc-text-muted)]"
                />
              </div>
            </label>
          </div>

          {contextMode === "user" ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {[
                { value: "all", label: "Todos" },
                { value: "tc", label: "Testing Company" },
                { value: "company", label: "Empresarial" },
              ].map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setUserFilter(item.value as UserFilter)}
                  className={`rounded-full border px-3 py-2 text-xs font-black uppercase tracking-[0.12em] transition ${
                    userFilter === item.value
                      ? "border-[var(--tc-accent)] bg-[var(--tc-accent)] text-white"
                      : "border-[var(--tc-border)] bg-[var(--tc-surface)] text-[var(--tc-text-muted)]"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ) : null}

          <div className="mt-5 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex min-w-max gap-3 sm:gap-4">
              {contextMode === "company" ? (
                <>
                  <button
                    type="button"
                    onClick={() => setSelectedCompanySlug(null)}
                    className={`group flex w-[78vw] min-w-56 max-w-73 shrink-0 flex-col gap-3 rounded-3xl border p-4 text-left transition ${
                      selectedCompanySlug == null ? "border-[rgba(1,24,72,0.14)] bg-[linear-gradient(180deg,var(--tc-surface)_0%,var(--tc-surface-2)_100%)] shadow-[0_18px_35px_rgba(1,24,72,0.08)]" : "border-[var(--tc-border)] bg-[var(--tc-surface)]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--tc-text-muted)]">Visão geral</div>
                        <div className="text-[1rem] font-black tracking-[-0.03em] text-[var(--tc-text-primary)]">Todas as empresas</div>
                      </div>
                      <span className="tc-status-pill" data-tone="neutral"><span className="tc-status-dot" />Geral</span>
                    </div>
                    <p className="text-[0.82rem] leading-6 text-[var(--tc-text-muted)]">Mostra movimentações, runs e defeitos de todas as empresas liberadas.</p>
                    <div className="grid grid-cols-2 gap-4 border-t border-[var(--tc-border)] pt-3">
                      <QuickStat label="Empresas" value={companies.length} />
                      <QuickStat label="Runs" value={overview?.releaseCount ?? 0} />
                    </div>
                  </button>
                  {filteredCompanies.map((company) => {
                    const key = resolveCompanyKey(company);
                    const selected = key === selectedCompanySlug;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setSelectedCompanySlug(key)}
                        aria-pressed={selected}
                        className={`group relative flex w-[78vw] min-w-56 max-w-74 shrink-0 flex-col gap-3 overflow-hidden rounded-3xl border p-4 text-left transition ${
                          selected
                            ? "border-[rgba(239,0,1,0.28)] bg-[linear-gradient(180deg,var(--tc-surface)_0%,var(--tc-surface-2)_100%)] shadow-[0_24px_44px_rgba(1,24,72,0.12)] ring-1 ring-[rgba(239,0,1,0.16)]"
                            : "border-[var(--tc-border)] bg-[var(--tc-surface)] hover:border-[rgba(239,0,1,0.18)]"
                        }`}
                      >
                        {selected ? <span className="absolute inset-y-0 left-0 w-1.5 bg-[linear-gradient(180deg,var(--tc-primary)_0%,var(--tc-accent)_100%)]" /> : null}
                        <div className="flex min-w-0 items-start gap-3">
                          <CompanyMark name={company.name} logo={company.logo} selected={selected} />
                          <div className="min-w-0 flex-1">
                            <div className="line-clamp-2 text-[1rem] font-black leading-5 tracking-[-0.03em] text-[var(--tc-text-primary)]">{company.name}</div>
                            <div className="mt-2"><span className="tc-status-pill" data-tone={GATE_META[company.gate.status].tone}><span className="tc-status-dot" />{GATE_META[company.gate.status].label}</span></div>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 border-t border-[var(--tc-border)] pt-3">
                          <QuickStat label="Runs" value={company.releases.length} />
                          <QuickStat label="Defeitos" value={countRuns(company, ["failed", "warning"])} />
                        </div>
                        <div className="grid grid-cols-2 gap-4 border-t border-[var(--tc-border)] pt-3 text-xs text-[var(--tc-text-muted)]">
                          <span>Pass rate: {formatPercent(company.passRate)}</span>
                          <span className="text-right">Última: {formatShortDate(company.latestRelease?.createdAt)}</span>
                        </div>
                      </button>
                    );
                  })}
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setSelectedUserEmail(null)}
                    className={`group flex w-[78vw] min-w-56 max-w-73 shrink-0 flex-col gap-3 rounded-3xl border p-4 text-left transition ${
                      selectedUserEmail == null ? "border-[rgba(1,24,72,0.14)] bg-[linear-gradient(180deg,var(--tc-surface)_0%,var(--tc-surface-2)_100%)] shadow-[0_18px_35px_rgba(1,24,72,0.08)]" : "border-[var(--tc-border)] bg-[var(--tc-surface)]"
                    }`}
                  >
                    <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--tc-text-muted)]">Visão geral</div>
                    <div className="text-[1rem] font-black tracking-[-0.03em] text-[var(--tc-text-primary)]">Todos os usuários</div>
                    <p className="text-[0.82rem] leading-6 text-[var(--tc-text-muted)]">Mostra movimentações de todos os usuários com registro no período.</p>
                    <div className="grid grid-cols-2 gap-4 border-t border-[var(--tc-border)] pt-3">
                      <QuickStat label="Usuários" value={users.length} />
                      <QuickStat label="Ações" value={auditLogs.length} />
                    </div>
                  </button>
                  {filteredUsers.map((item) => {
                    const selected = selectedUserEmail === item.email;
                    return (
                      <button
                        key={item.email}
                        type="button"
                        onClick={() => setSelectedUserEmail(item.email)}
                        className={`group relative flex w-[78vw] min-w-56 max-w-74 shrink-0 flex-col gap-3 overflow-hidden rounded-3xl border p-4 text-left transition ${
                          selected
                            ? "border-[rgba(239,0,1,0.28)] bg-[linear-gradient(180deg,var(--tc-surface)_0%,var(--tc-surface-2)_100%)] shadow-[0_24px_44px_rgba(1,24,72,0.12)] ring-1 ring-[rgba(239,0,1,0.16)]"
                            : "border-[var(--tc-border)] bg-[var(--tc-surface)] hover:border-[rgba(239,0,1,0.18)]"
                        }`}
                      >
                        {selected ? <span className="absolute inset-y-0 left-0 w-1.5 bg-[linear-gradient(180deg,var(--tc-primary)_0%,var(--tc-accent)_100%)]" /> : null}
                        <div className="flex min-w-0 items-start gap-3">
                          <UserMark name={item.name} selected={selected} />
                          <div className="min-w-0 flex-1">
                            <div className="line-clamp-2 text-[1rem] font-black leading-5 tracking-[-0.03em] text-[var(--tc-text-primary)]">{item.name}</div>
                            <div className="mt-2"><span className="tc-status-pill" data-tone="neutral"><span className="tc-status-dot" />{item.tag}</span></div>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 border-t border-[var(--tc-border)] pt-3">
                          <QuickStat label="Ações" value={item.movements} />
                          <QuickStat label="Última" value={formatShortDate(item.latestAt)} />
                        </div>
                      </button>
                    );
                  })}
                </>
              )}
            </div>
          </div>
        </section>

        {viewMode === "context" ? (
          <div className="grid items-stretch gap-3 sm:gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
            <section className="tc-panel flex h-full flex-col gap-5">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--tc-border)] pb-5">
                <div>
                  <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-[linear-gradient(135deg,var(--tc-primary)_0%,var(--tc-primary-dark)_60%,rgba(239,0,1,0.82)_180%)] text-white shadow-[0_18px_38px_rgba(1,24,72,0.18)]">
                    <FiShield size={22} />
                  </div>
                  <h2 className="mt-4 text-xl font-black tracking-[-0.04em] text-[var(--tc-text-primary)]">Atenção agora</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--tc-text-muted)]">
                    Só aparece quando houver run, defeito ou bloqueio real no contexto selecionado.
                  </p>
                </div>
              </div>

              {attentionItems.length > 0 ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {attentionItems.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-[rgba(239,0,1,0.18)] bg-[rgba(239,0,1,0.06)] p-4">
                      <div className="flex items-start gap-3">
                        <FiAlertTriangle className="mt-1 text-[var(--tc-accent)]" />
                        <div>
                          <p className="font-black text-[var(--tc-text-primary)]">{item.title}</p>
                          <p className="mt-1 text-sm leading-6 text-[var(--tc-text-muted)]">{item.detail}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-[var(--tc-border)] bg-[var(--tc-surface-2)] p-4 text-sm font-semibold text-[var(--tc-text-muted)]">
                  Não há atenção crítica para este contexto no período selecionado.
                </div>
              )}

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="tc-panel-muted">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="font-black text-[var(--tc-text-primary)]">Runs por status</h3>
                      <p className="mt-1 text-sm text-[var(--tc-text-muted)]">Distribuição dos casos executados no período.</p>
                    </div>
                    <FiActivity className="text-[var(--tc-accent)]" />
                  </div>
                  {runStatusTotal > 0 ? (
                    <div className="mt-4 space-y-3">
                      {runStatusData.map((item) => (
                        <div key={item.id}>
                          <div className="mb-1 flex justify-between text-xs font-bold text-[var(--tc-text-muted)]">
                            <span>{item.label}</span>
                            <span>{item.value}</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-[var(--tc-surface)]">
                            <div className={`h-full rounded-full ${item.className}`} style={{ width: `${Math.round((item.value / runStatusTotal) * 100)}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-4 text-sm font-semibold text-[var(--tc-text-muted)]">Sem runs com distribuição no período.</p>
                  )}
                </div>

                <div className="tc-panel-muted">
                  <h3 className="font-black text-[var(--tc-text-primary)]">Defeitos no período</h3>
                  <p className="mt-1 text-sm text-[var(--tc-text-muted)]">Clique em um defeito para ver detalhes.</p>
                  {activeDefects.length > 0 ? (
                    <div className="mt-4 space-y-2">
                      {activeDefects.slice(0, 5).map((defect) => (
                        <button key={defect.id} type="button" onClick={() => setSelectedDefect(defect)} className="w-full rounded-2xl border border-[var(--tc-border)] bg-[var(--tc-surface)] p-3 text-left transition hover:border-[rgba(239,0,1,0.25)]">
                          <div className="flex items-center justify-between gap-3">
                            <span className="line-clamp-1 text-sm font-black text-[var(--tc-text-primary)]">{defect.title}</span>
                            <span className="text-xs font-bold text-[var(--tc-accent)]">{defectStatusLabel(defect.status)}</span>
                          </div>
                          <p className="mt-1 text-xs text-[var(--tc-text-muted)]">{defect.companyName ?? selectedCompany?.name ?? "Contexto geral"}</p>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-4 text-sm font-semibold text-[var(--tc-text-muted)]">Sem defeitos ativos para este contexto.</p>
                  )}
                </div>

                <div className="tc-panel-muted lg:col-span-2">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="font-black text-[var(--tc-text-primary)]">Calendário do período</h3>
                      <p className="mt-1 text-sm text-[var(--tc-text-muted)]">Linha do tempo curta do que aconteceu por dia.</p>
                    </div>
                    <FiClock className="text-[var(--tc-accent)]" />
                  </div>
                  {timelineDays.length > 0 ? (
                    <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {timelineDays.map((day) => (
                        <div key={day.date} className="rounded-2xl border border-[var(--tc-border)] bg-[var(--tc-surface)] p-3">
                          <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--tc-text-muted)]">{formatShortDate(day.date)}</p>
                          <p className="mt-2 text-lg font-black text-[var(--tc-text-primary)]">{day.items.length} ações</p>
                          <p className="mt-1 line-clamp-2 text-xs text-[var(--tc-text-muted)]">{day.items[0]?.entity_label ?? day.items[0]?.action ?? "Movimentação registrada"}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-4 text-sm font-semibold text-[var(--tc-text-muted)]">Sem linha do tempo para o período selecionado.</p>
                  )}
                </div>
              </div>
            </section>

            <section className="tc-panel flex h-full flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black tracking-[-0.04em] text-[var(--tc-text-primary)]">Eventos recentes</h2>
                  <p className="mt-1 text-sm leading-6 text-[var(--tc-text-muted)]">Movimentações do contexto selecionado.</p>
                </div>
                <FiCalendar className="text-[var(--tc-accent)]" />
              </div>
              {loadingAudit ? <p className="text-sm font-semibold text-[var(--tc-text-muted)]">Carregando movimentações...</p> : null}
              {scopedAuditLogs.length > 0 ? (
                <div className="space-y-3">
                  {scopedAuditLogs.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-[var(--tc-border)] bg-[var(--tc-surface-2)] p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-black text-[var(--tc-text-primary)]">{item.entity_label ?? item.action}</p>
                          <p className="mt-1 text-xs text-[var(--tc-text-muted)]">{item.entity_type ?? "evento"} · {item.actor_email ?? "Sistema"}</p>
                        </div>
                        <span className="shrink-0 text-xs font-bold text-[var(--tc-text-muted)]">{formatDate(item.created_at)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-[var(--tc-border)] bg-[var(--tc-surface-2)] p-4 text-sm font-semibold text-[var(--tc-text-muted)]">
                  Não há movimentações para este usuário/empresa no período selecionado.
                </div>
              )}
            </section>
          </div>
        ) : (
          <section className="tc-panel">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black tracking-[-0.04em] text-[var(--tc-text-primary)]">Comparativo operacional</h2>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--tc-text-muted)]">
                  Ranking para decidir onde agir primeiro. Ordenado por runs falhadas, runs abertas e score.
                </p>
              </div>
              <button type="button" onClick={() => setViewMode("context")} className="tc-button-secondary">Voltar ao contexto</button>
            </div>
            <div className="mt-5 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-[0.16em] text-[var(--tc-text-muted)]">
                  <tr>
                    <th className="px-3 py-3">Empresa</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3">Runs falhadas</th>
                    <th className="px-3 py-3">Runs abertas</th>
                    <th className="px-3 py-3">Pass rate</th>
                    <th className="px-3 py-3">Última execução</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--tc-border)]">
                  {rankedCompanies.map((row) => (
                    <tr key={row.slug} className="align-top">
                      <td className="px-3 py-3 font-black text-[var(--tc-text-primary)]">{row.name}</td>
                      <td className="px-3 py-3"><span className="tc-status-pill" data-tone={row.statusTone}><span className="tc-status-dot" />{row.statusLabel}</span></td>
                      <td className="px-3 py-3 text-[var(--tc-text-muted)]">{row.failedRuns}</td>
                      <td className="px-3 py-3 text-[var(--tc-text-muted)]">{row.openRuns}</td>
                      <td className="px-3 py-3 text-[var(--tc-text-muted)]">{formatPercent(row.passRate)}</td>
                      <td className="px-3 py-3 text-[var(--tc-text-muted)]">{formatShortDate(row.latestRunAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rankedCompanies.length === 0 ? <p className="py-6 text-sm font-semibold text-[var(--tc-text-muted)]">Sem dados para comparação no período.</p> : null}
            </div>
          </section>
        )}
      </div>

      {selectedDefect ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="w-full max-w-lg rounded-3xl border border-[var(--tc-border)] bg-[var(--tc-surface)] p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--tc-accent)]">Defeito</p>
                <h3 className="mt-2 text-xl font-black text-[var(--tc-text-primary)]">{selectedDefect.title}</h3>
              </div>
              <button type="button" onClick={() => setSelectedDefect(null)} className="rounded-full border border-[var(--tc-border)] p-2 text-[var(--tc-text-muted)]"><FiX /></button>
            </div>
            <div className="mt-4 grid gap-3 text-sm text-[var(--tc-text-muted)]">
              <p><strong>Status:</strong> {defectStatusLabel(selectedDefect.status)}</p>
              <p><strong>Empresa:</strong> {selectedDefect.companyName ?? selectedCompany?.name ?? "--"}</p>
              <p><strong>Origem:</strong> {selectedDefect.origin ?? "--"}</p>
              <p><strong>Run:</strong> {selectedDefect.run_id ?? "--"}</p>
              <p><strong>Criado por:</strong> {selectedDefect.createdBy ?? "--"}</p>
              <p><strong>Criado em:</strong> {formatDate(selectedDefect.created_at)}</p>
              <p><strong>Atualizado em:</strong> {formatDate(selectedDefect.updated_at)}</p>
            </div>
            {selectedDefect.url ? (
              <a href={selectedDefect.url} className="mt-5 inline-flex items-center gap-2 text-sm font-black text-[var(--tc-accent)]" target="_blank" rel="noreferrer">
                Abrir detalhe <FiArrowUpRight />
              </a>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
