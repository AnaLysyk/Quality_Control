"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  FiAlertTriangle,
  FiArrowUpRight,
  FiExternalLink,
  FiRefreshCw,
  FiSearch,
  FiShield,
  FiTrendingDown,
  FiTrendingUp,
} from "react-icons/fi";
import TicketsButton from "@/components/TicketsButton";
import { fetchApi } from "@/lib/api";
import { extractMessageFromJson, extractRequestIdFromJson, formatMessageWithRequestId, unwrapEnvelopeData } from "@/lib/apiEnvelope";
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
  origin?: "manual" | "automatico";
  companyName?: string | null;
  run_id?: string | number | null;
  url?: string;
};

type DefectsResponse = { items: DefectItem[]; total: number };
type AuditLogItem = { id: string; created_at: string; action: string; actor_email: string | null; entity_label: string | null; entity_type: string | null };
type RankingResponse = { companies: { slug: string; name: string; score: number; status: "healthy" | "attention" | "risk" }[] };
type AttentionItem = { id: string; title: string; detail: string; tone: "danger" | "warning" | "neutral"; href?: string };
type RankedCompanyRow = RankingResponse["companies"][number] & {
  position: number;
  passRate: number | null;
  alertCount: number | null;
  latestRunAt: string | null;
  trendSummary: string;
};

const GATE_META: Record<QualityGateStatus, { label: string; tone: "positive" | "warning" | "danger" | "neutral" }> = {
  approved: { label: "Saudavel", tone: "positive" },
  warning: { label: "Atencao", tone: "warning" },
  failed: { label: "Em risco", tone: "danger" },
  no_data: { label: "Sem dados", tone: "neutral" },
};

const DEFECT_LABELS: Record<string, string> = {
  fail: "Falha aberta",
  blocked: "Bloqueado",
  pending: "Pendente",
  done: "Concluido",
};

const RANKING_STATUS_META: Record<RankingResponse["companies"][number]["status"], { label: string; summary: string; tone: "positive" | "warning" | "danger" }> = {
  healthy: { label: "Elite", summary: "Operacao estavel e consistente", tone: "positive" },
  attention: { label: "Sob observacao", summary: "Oscilacao controlada na janela", tone: "warning" },
  risk: { label: "Pressao critica", summary: "Resposta prioritaria recomendada", tone: "danger" },
};

function normalizeText(value?: string | null) {
  return (value ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function formatDate(value?: string | null) {
  if (!value) return "--";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "--";
}

function formatShortDate(value?: string | null) {
  if (!value) return "--";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString("pt-BR", { dateStyle: "short" }) : "--";
}

function formatPercent(value?: number | null) {
  return value == null ? "--" : `${value}%`;
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

function CompanyMark({ name, logo, selected = false }: { name: string; logo?: string | null; selected?: boolean }) {
  const [failed, setFailed] = useState(false);
  const initials = getInitials(name);

  return (
    <div
      className={`flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-[18px] border text-sm font-black shadow-[0_14px_28px_rgba(15,23,42,0.08)] ${
        selected
          ? "border-[rgba(239,0,1,0.22)] bg-[linear-gradient(135deg,rgba(1,24,72,0.95)_0%,rgba(239,0,1,0.92)_100%)] text-white"
          : "border-[color:var(--tc-border)] bg-[linear-gradient(180deg,#ffffff_0%,#eef4ff_100%)] text-[color:var(--tc-primary)]"
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

function QuickCompanyStat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string | number;
  tone?: "default" | "accent";
}) {
  return (
    <div className="min-w-0 space-y-1">
      <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--tc-text-muted)]">
        {label}
      </div>
      <div
        className={`truncate text-[1.45rem] font-black leading-none ${
          tone === "accent" ? "text-[color:var(--tc-accent)]" : "text-[color:var(--tc-text-primary)]"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function QuickCompanyMeta({
  label,
  value,
  align = "left",
}: {
  label: string;
  value: string;
  align?: "left" | "right";
}) {
  return (
    <div className={`space-y-1 ${align === "right" ? "text-right" : ""}`}>
      <div className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[color:var(--tc-text-muted)]">{label}</div>
      <div className="text-[0.8rem] font-semibold text-[color:var(--tc-text-primary)]">{value}</div>
    </div>
  );
}

function totalStats(stats?: Stats | null) {
  if (!stats) return 0;
  return stats.pass + stats.fail + stats.blocked + stats.notRun;
}

function countRuns(company: CompanyRow, statuses: QualityGateStatus | QualityGateStatus[]) {
  const allowed = Array.isArray(statuses) ? statuses : [statuses];
  return company.releases.filter((release) => allowed.includes(release.gate.status)).length;
}

function hoursSince(value?: string | null) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? Math.round((Date.now() - time) / (1000 * 60 * 60)) : null;
}

function progressWidth(value: number, total: number) {
  return total > 0 ? Math.max(0, Math.min(100, Math.round((value / total) * 100))) : 0;
}

function formatTrend(summary?: { direction: "up" | "down" | "flat"; delta: number } | null) {
  if (!summary) return "Sem tendencia recente";
  if (summary.direction === "flat") return "Estavel na janela atual";
  const prefix = summary.direction === "up" ? "+" : "-";
  return `${prefix}${Math.abs(summary.delta)} pts na comparacao recente`;
}

function gateRank(status: QualityGateStatus) {
  if (status === "failed") return 0;
  if (status === "warning") return 1;
  if (status === "no_data") return 2;
  return 3;
}

function sortCompaniesForDecision(a: CompanyRow, b: CompanyRow) {
  const rankDiff = gateRank(a.gate.status) - gateRank(b.gate.status);
  if (rankDiff !== 0) return rankDiff;

  const alertsDiff = countRuns(b, ["failed", "warning"]) - countRuns(a, ["failed", "warning"]);
  if (alertsDiff !== 0) return alertsDiff;

  const aPass = a.passRate ?? -1;
  const bPass = b.passRate ?? -1;
  if (aPass !== bPass) return aPass - bPass;

  const aLast = new Date(a.latestRelease?.createdAt ?? 0).getTime();
  const bLast = new Date(b.latestRelease?.createdAt ?? 0).getTime();
  if (aLast !== bLast) return aLast - bLast;

  return a.name.localeCompare(b.name);
}

function getEventMeta(action: string) {
  const normalized = normalizeText(action);
  if (normalized.includes("permissions")) {
    return {
      label: "Permissoes",
      icon: FiShield,
      toneClass: "border-[rgba(1,24,72,0.14)] bg-[rgba(1,24,72,0.05)] text-[color:var(--tc-primary)]",
    };
  }
  if (normalized.includes("created")) {
    return {
      label: "Criado",
      icon: FiArrowUpRight,
      toneClass: "border-[rgba(16,185,129,0.2)] bg-[rgba(16,185,129,0.08)] text-[color:#047857]",
    };
  }
  if (normalized.includes("updated")) {
    return {
      label: "Atualizado",
      icon: FiRefreshCw,
      toneClass: "border-[rgba(245,158,11,0.22)] bg-[rgba(245,158,11,0.08)] text-[color:#b45309]",
    };
  }
  return {
    label: "Evento",
    icon: FiAlertTriangle,
    toneClass: "border-[color:var(--tc-border)] bg-[color:var(--tc-surface-2)] text-[color:var(--tc-text-primary)]",
  };
}

function matchCompanyDefect(item: DefectItem, company: CompanyRow | null) {
  if (!company) return true;
  const ref = normalizeText(item.companyName);
  const name = normalizeText(company.name);
  const slug = normalizeText(company.slug);
  return Boolean(ref) && (ref.includes(name) || (slug && ref.includes(slug)));
}

function buildCompanyAttention(company: CompanyRow | null, defects: DefectItem[]) {
  if (!company) return [] as AttentionItem[];
  const failCount = defects.filter((item) => item.status === "fail").length;
  const blockedCount = defects.filter((item) => item.status === "blocked").length;
  const staleHours = hoursSince(company.latestRelease?.createdAt);
  const items: AttentionItem[] = [];
  if (company.gate.status === "failed") items.push({ id: "gate", title: "Saude da empresa em risco", detail: "O pass rate e a distribuicao de falhas exigem acao imediata.", tone: "danger", href: "/admin/runs" });
  if (company.passRate != null && company.passRate < 85) items.push({ id: "pass-rate", title: "Pass rate abaixo do esperado", detail: `A empresa esta com ${company.passRate}% de aprovacao na janela atual.`, tone: "warning", href: "/admin/runs" });
  if (failCount > 0) items.push({ id: "fail", title: `${failCount} defeitos em falha`, detail: "Existem defeitos abertos com impacto direto no fluxo de qualidade.", tone: "danger", href: "/admin/defeitos" });
  if (blockedCount > 0) items.push({ id: "blocked", title: `${blockedCount} itens bloqueados`, detail: "Ha bloqueios impedindo fechamento rapido do ciclo de validacao.", tone: "warning", href: "/admin/defeitos" });
  if (staleHours != null && staleHours > 72) items.push({ id: "stale", title: "Sem execucao recente", detail: `A ultima execucao registrada foi ha ${staleHours}h.`, tone: "warning", href: "/admin/runs" });
  if (!company.releases.length) items.push({ id: "no-runs", title: "Sem runs monitoradas", detail: "Nenhuma release com telemetria de qualidade foi encontrada para esta empresa.", tone: "neutral" });
  return items.slice(0, 5);
}

function buildGlobalAttention(companies: CompanyRow[], defects: DefectItem[], overview: QualityOverviewResponse | null) {
  const riskCompanies = companies.filter((company) => company.gate.status === "failed").length;
  const warningCompanies = companies.filter((company) => company.gate.status === "warning").length;
  const staleCompanies = companies.filter((company) => (hoursSince(company.latestRelease?.createdAt) ?? 0) > 72).length;
  const failDefects = defects.filter((item) => item.status === "fail").length;
  const blockedDefects = defects.filter((item) => item.status === "blocked").length;
  const items: AttentionItem[] = [];
  if (riskCompanies > 0) items.push({ id: "risk-companies", title: `${riskCompanies} empresas em risco`, detail: "A visao global mostra empresas com qualidade fora da faixa saudavel.", tone: "danger", href: "/admin/runs" });
  if ((overview?.riskCount ?? 0) > 0) items.push({ id: "risk-releases", title: `${overview?.riskCount ?? 0} releases em risco`, detail: "Existem releases com comportamento sensivel na janela monitorada.", tone: "warning", href: "/admin/runs" });
  if (failDefects > 0) items.push({ id: "fail-defects", title: `${failDefects} defeitos em falha`, detail: "Itens em falha precisam de leitura imediata no backlog tecnico.", tone: "danger", href: "/admin/defeitos" });
  if (blockedDefects > 0) items.push({ id: "blocked-defects", title: `${blockedDefects} bloqueios ativos`, detail: "Os bloqueios atuais podem atrasar estabilizacao e aprovacao.", tone: "warning", href: "/admin/defeitos" });
  if (staleCompanies > 0) items.push({ id: "stale-companies", title: `${staleCompanies} empresas sem execucao recente`, detail: "Ha empresas sem telemetria recente na janela de decisao.", tone: "neutral", href: "/admin/runs" });
  if (warningCompanies > 0) items.push({ id: "warning-companies", title: `${warningCompanies} empresas em atencao`, detail: "Empresas com degradacao leve podem virar risco se nao forem tratadas.", tone: "neutral", href: "/admin/runs" });
  return items.slice(0, 5);
}

function attentionToneClass(tone: AttentionItem["tone"]) {
  if (tone === "danger") return "border-[rgba(239,0,1,0.18)] bg-[rgba(239,0,1,0.06)] text-[color:var(--tc-accent)]";
  if (tone === "warning") return "border-[rgba(245,158,11,0.24)] bg-[rgba(245,158,11,0.08)] text-[color:#b45309]";
  return "border-[color:var(--tc-border)] bg-[color:var(--tc-surface-2)] text-[color:var(--tc-text-primary)]";
}

export default function AdminHomePage() {
  const router = useRouter();
  const companyContextRef = useRef<HTMLElement | null>(null);
  const rankingSectionRef = useRef<HTMLElement | null>(null);
  const [overview, setOverview] = useState<QualityOverviewResponse | null>(null);
  const [defectsPayload, setDefectsPayload] = useState<DefectsResponse | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [ranking, setRanking] = useState<RankingResponse | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [loadingDefects, setLoadingDefects] = useState(true);
  const [loadingAudit, setLoadingAudit] = useState(true);
  const [loadingRanking, setLoadingRanking] = useState(true);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [defectsError, setDefectsError] = useState<string | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [rankingError, setRankingError] = useState<string | null>(null);
  const [selectedCompanySlug, setSelectedCompanySlug] = useState<string | null>(null);
  const [selectedRunSlug, setSelectedRunSlug] = useState<string | null>(null);
  const [lastViewedCompanySlug, setLastViewedCompanySlug] = useState<string | null>(null);
  const [companyQuery, setCompanyQuery] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const firstError = overviewError ?? defectsError ?? auditError ?? rankingError;

  useEffect(() => {
    let canceled = false;
    const loadOverview = async () => {
      setLoadingOverview(true);
      setOverviewError(null);
      try {
        const response = await fetchApi("/api/admin/quality/overview?period=30", { cache: "no-store" });
        if (response.status === 401) {
          router.replace("/login");
          return;
        }
        const raw = await response.json().catch(() => null);
        if (!response.ok) {
          const message = extractMessageFromJson(raw) || "Erro ao carregar dashboard de qualidade";
          const requestId = extractRequestIdFromJson(raw) || response.headers.get("x-request-id") || null;
          if (!canceled) setOverview(null);
          if (!canceled) setOverviewError(formatMessageWithRequestId(message, requestId));
          return;
        }
        if (!canceled) setOverview(unwrapEnvelopeData<QualityOverviewResponse>(raw) ?? null);
      } catch {
        if (!canceled) setOverview(null);
        if (!canceled) setOverviewError("Erro ao carregar dashboard de qualidade");
      } finally {
        if (!canceled) setLoadingOverview(false);
      }
    };
    void loadOverview();
    return () => {
      canceled = true;
    };
  }, [refreshKey, router]);

  useEffect(() => {
    let canceled = false;
    const loadDefects = async () => {
      setLoadingDefects(true);
      setDefectsError(null);
      try {
        const response = await fetchApi("/api/admin/defeitos", { cache: "no-store" });
        if (response.status === 401) {
          router.replace("/login");
          return;
        }
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
  }, [refreshKey, router]);

  useEffect(() => {
    let canceled = false;
    const loadAudit = async () => {
      setLoadingAudit(true);
      setAuditError(null);
      try {
        const response = await fetchApi("/api/admin/audit-logs?limit=12", { cache: "no-store" });
        if (response.status === 401) {
          router.replace("/login");
          return;
        }
        const raw = await response.json().catch(() => null);
        if (!response.ok) {
          if (!canceled) setAuditLogs([]);
          if (!canceled) setAuditError(extractMessageFromJson(raw) || "Erro ao carregar historico");
          return;
        }
        const payload = unwrapEnvelopeData<{ items?: AuditLogItem[] }>(raw) ?? null;
        if (!canceled) setAuditLogs(payload?.items ?? []);
      } catch {
        if (!canceled) setAuditLogs([]);
        if (!canceled) setAuditError("Erro ao carregar historico");
      } finally {
        if (!canceled) setLoadingAudit(false);
      }
    };
    void loadAudit();
    return () => {
      canceled = true;
    };
  }, [refreshKey, router]);

  useEffect(() => {
    let canceled = false;
    const loadRanking = async () => {
      setLoadingRanking(true);
      setRankingError(null);
      try {
        const response = await fetchApi("/api/admin/metrics/ranking", { cache: "no-store" });
        if (response.status === 401 || response.status === 403) {
          router.replace("/login");
          return;
        }
        const raw = await response.json().catch(() => null);
        if (!response.ok) {
          if (!canceled) setRanking(null);
          if (!canceled) setRankingError(extractMessageFromJson(raw) || "Erro ao carregar ranking");
          return;
        }
        if (!canceled) setRanking((unwrapEnvelopeData<RankingResponse>(raw) ?? raw) as RankingResponse);
      } catch {
        if (!canceled) setRanking(null);
        if (!canceled) setRankingError("Erro ao carregar ranking");
      } finally {
        if (!canceled) setLoadingRanking(false);
      }
    };
    void loadRanking();
    return () => {
      canceled = true;
    };
  }, [refreshKey, router]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("admin-quality:last-company");
      if (stored) setLastViewedCompanySlug(stored);
    } catch {
      // Ignore local storage issues on locked browsers.
    }
  }, []);

  const companies = useMemo(() => overview?.companies ?? [], [overview]);
  const filteredCompanies = useMemo(() => {
    const query = normalizeText(companyQuery);
    const unique = companies.filter((company, index, source) => source.findIndex((entry) => resolveCompanyKey(entry) === resolveCompanyKey(company)) === index);
    if (!query) return unique;
    return unique.filter((company) => normalizeText(`${company.name} ${company.slug ?? ""} ${company.id}`).includes(query));
  }, [companies, companyQuery]);
  const orderedCompanies = useMemo(() => [...filteredCompanies].sort(sortCompaniesForDecision), [filteredCompanies]);

  const selectedCompany = useMemo(() => {
    if (!selectedCompanySlug) return null;
    return companies.find((company) => resolveCompanyKey(company) === selectedCompanySlug) ?? null;
  }, [companies, selectedCompanySlug]);
  const lastViewedCompany = useMemo(
    () => (lastViewedCompanySlug ? companies.find((company) => resolveCompanyKey(company) === lastViewedCompanySlug) ?? null : null),
    [companies, lastViewedCompanySlug],
  );

  useEffect(() => {
    if (!selectedCompanySlug) return;
    setLastViewedCompanySlug(selectedCompanySlug);
    try {
      window.localStorage.setItem("admin-quality:last-company", selectedCompanySlug);
    } catch {
      // Ignore local storage issues on locked browsers.
    }
  }, [selectedCompanySlug]);

  useEffect(() => {
    if (!selectedCompany) {
      setSelectedRunSlug(null);
      return;
    }
    const firstRunSlug = selectedCompany.releases[0]?.slug ?? null;
    if (!selectedRunSlug || !selectedCompany.releases.some((release) => release.slug === selectedRunSlug)) {
      setSelectedRunSlug(firstRunSlug);
    }
  }, [selectedCompany, selectedRunSlug]);

  const selectedRun = useMemo(() => {
    if (!selectedCompany?.releases.length) return null;
    return selectedCompany.releases.find((release) => release.slug === selectedRunSlug) ?? selectedCompany.releases[0] ?? null;
  }, [selectedCompany, selectedRunSlug]);

  const selectedCompanyDefects = useMemo(() => (defectsPayload?.items ?? []).filter((item) => matchCompanyDefect(item, selectedCompany)), [defectsPayload?.items, selectedCompany]);
  const defectScope = useMemo(() => (selectedCompany ? selectedCompanyDefects : defectsPayload?.items ?? []), [defectsPayload?.items, selectedCompany, selectedCompanyDefects]);
  const relevantDefects = useMemo(
    () =>
      [...defectScope]
        .filter((item) => item.status !== "done")
        .sort((a, b) => {
          const priority = (status: string) => {
            if (status === "fail") return 0;
            if (status === "blocked") return 1;
            if (status === "pending") return 2;
            return 3;
          };
          const diff = priority(a.status) - priority(b.status);
          if (diff !== 0) return diff;
          return (a.companyName ?? a.title).localeCompare(b.companyName ?? b.title);
        })
        .slice(0, 3),
    [defectScope],
  );
  const criticalDefects = useMemo(() => selectedCompanyDefects.filter((item) => item.status === "fail" || item.status === "blocked").length, [selectedCompanyDefects]);
  const totalRuns = useMemo(() => companies.reduce((sum, company) => sum + company.releases.length, 0), [companies]);
  const companiesAtRisk = useMemo(() => companies.filter((company) => company.gate.status === "failed").length, [companies]);
  const companiesWithoutRecentRun = useMemo(() => companies.filter((company) => (hoursSince(company.latestRelease?.createdAt) ?? 0) > 72).length, [companies]);
  const companiesWithTelemetry = useMemo(() => overview?.coverage.withStats ?? companies.length, [companies.length, overview?.coverage.withStats]);
  const openDefects = useMemo(() => (defectsPayload?.items ?? []).filter((item) => item.status !== "done").length, [defectsPayload?.items]);
  const failingDefects = useMemo(() => (defectsPayload?.items ?? []).filter((item) => item.status === "fail").length, [defectsPayload?.items]);
  const blockedDefects = useMemo(() => defectScope.filter((item) => item.status === "blocked").length, [defectScope]);
  const mostCriticalCompany = useMemo(() => orderedCompanies[0] ?? null, [orderedCompanies]);
  const bestCompany = useMemo(
    () =>
      [...companies].sort((a, b) => {
        const gateDiff = gateRank(b.gate.status) - gateRank(a.gate.status);
        if (gateDiff !== 0) return gateDiff;
        const passDiff = (b.passRate ?? -1) - (a.passRate ?? -1);
        if (passDiff !== 0) return passDiff;
        return countRuns(a, ["failed", "warning"]) - countRuns(b, ["failed", "warning"]);
      })[0] ?? null,
    [companies],
  );
  const staleCompany = useMemo(
    () =>
      [...companies]
        .filter((company) => (hoursSince(company.latestRelease?.createdAt) ?? 0) > 72)
        .sort((a, b) => (hoursSince(b.latestRelease?.createdAt) ?? 0) - (hoursSince(a.latestRelease?.createdAt) ?? 0))[0] ?? null,
    [companies],
  );
  const selectedHistory = useMemo(() => {
    if (!selectedCompany) return auditLogs.slice(0, 6);
    const name = normalizeText(selectedCompany.name);
    const slug = normalizeText(selectedCompany.slug);
    const filtered = auditLogs.filter((item) => {
      const haystack = normalizeText(`${item.entity_label ?? ""} ${item.entity_type ?? ""}`);
      return (name && haystack.includes(name)) || (slug && haystack.includes(slug));
    });
    return (filtered.length ? filtered : auditLogs).slice(0, 6);
  }, [auditLogs, selectedCompany]);
  const attentionItems = useMemo(() => (selectedCompany ? buildCompanyAttention(selectedCompany, selectedCompanyDefects) : buildGlobalAttention(companies, defectsPayload?.items ?? [], overview)), [companies, defectsPayload?.items, overview, selectedCompany, selectedCompanyDefects]);
  const suggestedRunCompany = selectedCompany ?? mostCriticalCompany ?? null;
  const suggestedRun = useMemo(() => {
    if (!suggestedRunCompany) return null;
    return [...suggestedRunCompany.releases].sort((a, b) => {
      const gateDiff = gateRank(a.gate.status) - gateRank(b.gate.status);
      if (gateDiff !== 0) return gateDiff;
      const dateA = new Date(a.createdAt ?? a.created_at ?? 0).getTime();
      const dateB = new Date(b.createdAt ?? b.created_at ?? 0).getTime();
      return dateB - dateA;
    })[0] ?? null;
  }, [suggestedRunCompany]);

  const heroCards = [
    { id: "companies", label: "Cobertura com telemetria", value: companiesWithTelemetry, note: `${overview?.coverage.total ?? companies.length} empresas no escopo global` },
    { id: "runs", label: "Execucoes consolidadas", value: totalRuns, note: `Janela analitica de ${overview?.period ?? 30} dias` },
    { id: "pass-rate", label: "Taxa media de aprovacao", value: formatPercent(overview?.globalPassRate), note: formatTrend(overview?.trendSummary) },
    { id: "risk", label: "Gate critico por empresa", value: companiesAtRisk, note: `${companiesWithoutRecentRun} sem execucao acima de 72h` },
    { id: "defects", label: "Defeitos ativos", value: openDefects, note: `${failingDefects} com falha aberta` },
    { id: "releases", label: "Releases sob risco", value: overview?.riskCount ?? "--", note: `${overview?.warningCount ?? 0} em observacao` },
  ];
  const rankingRows = useMemo<RankedCompanyRow[]>(
    () =>
      (ranking?.companies ?? []).map((entry, index) => {
        const matchedCompany =
          companies.find((company) => normalizeText(company.slug) === normalizeText(entry.slug)) ??
          companies.find((company) => normalizeText(company.name) === normalizeText(entry.name)) ??
          null;

        return {
          ...entry,
          position: index + 1,
          passRate: matchedCompany?.passRate ?? null,
          alertCount: matchedCompany ? countRuns(matchedCompany, ["failed", "warning"]) : null,
          latestRunAt: matchedCompany?.latestRelease?.createdAt ?? null,
          trendSummary: matchedCompany ? formatTrend(matchedCompany.trend) : RANKING_STATUS_META[entry.status].summary,
        };
      }),
    [companies, ranking?.companies],
  );
  const focusRankingCompany = (slug: string, name: string) => {
    const match = companies.find((entry) => normalizeText(entry.slug) === normalizeText(slug) || normalizeText(entry.name) === normalizeText(name));
    if (!match) return;
    setSelectedCompanySlug(resolveCompanyKey(match));
    setSelectedRunSlug(match.releases[0]?.slug ?? null);
    companyContextRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const runInFocus = selectedRun ?? suggestedRun;
  const runInFocusStats = runInFocus?.stats ?? null;
  const runInFocusTotal = totalStats(runInFocusStats);
  const selectedRunBars = [
    { id: "pass", label: "Pass", value: runInFocusStats?.pass ?? 0, color: "bg-emerald-500" },
    { id: "fail", label: "Fail", value: runInFocusStats?.fail ?? 0, color: "bg-rose-500" },
    { id: "blocked", label: "Blocked", value: runInFocusStats?.blocked ?? 0, color: "bg-amber-500" },
    { id: "notRun", label: "Not run", value: runInFocusStats?.notRun ?? 0, color: "bg-slate-400" },
  ];

  return (
    <div className="min-h-screen bg-[color:var(--page-bg,#eef3fb)] text-[color:var(--tc-text-primary)]">
        <div className="tc-page-shell px-4 py-5 lg:px-8 lg:py-7">
          <section className="tc-hero-panel">
            <div className="tc-hero-grid">
              <div className="flex flex-col gap-5">
                <div className="tc-hero-copy">
                  <p className="tc-hero-kicker">Painel executivo</p>
                  <h1 className="tc-hero-title">Dashboard de qualidade</h1>
                  <p className="tc-hero-description max-w-[56rem] pt-1">
                    Selecione a empresa e visualize informacoes de execucao, entenda quais estao em modo de atencao e quais lideram em resolucao, menos ocorrencias e mais estabilidade operacional.
                  </p>
                  {loadingOverview ? <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/72">Atualizando dados do ambiente...</p> : null}
                  {firstError ? <p className="text-sm font-semibold text-white">{firstError}</p> : null}
                  <div className="mt-4 flex flex-wrap items-stretch gap-3">
                    <button
                      type="button"
                      onClick={() => setRefreshKey((value) => value + 1)}
                      className="inline-flex min-h-[3.85rem] min-w-[10.25rem] items-center gap-3 rounded-[18px] border border-white/16 bg-[linear-gradient(135deg,rgba(255,255,255,0.96)_0%,rgba(236,243,255,0.96)_100%)] px-4 py-3 text-[color:var(--tc-primary)] shadow-[0_16px_28px_rgba(1,24,72,0.16)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_34px_rgba(1,24,72,0.2)]"
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[linear-gradient(135deg,rgba(1,24,72,0.1)_0%,rgba(239,0,1,0.14)_100%)] text-[color:var(--tc-primary)]">
                        <FiRefreshCw size={15} className={loadingOverview ? "animate-spin" : ""} />
                      </span>
                      <span className="flex flex-col items-start text-left">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--tc-text-muted)]">Atualizar</span>
                        <span className="text-[0.92rem] font-extrabold">{loadingOverview ? "Atualizando..." : "Recarregar"}</span>
                      </span>
                    </button>

                    <div className="flex min-h-[3.85rem] min-w-[13rem] items-center gap-3 rounded-[18px] border border-white/16 bg-white/10 px-4 py-3 text-white shadow-[0_16px_28px_rgba(1,24,72,0.16)] backdrop-blur-sm">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,rgba(255,255,255,0.18)_0%,rgba(239,0,1,0.24)_100%)] text-white">
                        <FiShield size={16} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/72">Painel admin</div>
                        <div className="mt-1 truncate text-[0.92rem] font-bold text-white">{selectedCompany?.name ?? "Contexto global"}</div>
                        <div className="mt-1 text-[0.74rem] text-white/76">{selectedCompany ? "Empresa selecionada no dashboard" : "Leitura agregada do ambiente"}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="tc-hero-stat-grid">
                {heroCards.map((card) => (
                  <div key={card.id} className="tc-hero-stat">
                    <div className="tc-hero-stat-label">{card.label}</div>
                    <div className="tc-hero-stat-value">{card.value}</div>
                    <div className="tc-hero-stat-note">{card.note}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="tc-panel">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
              <div className="min-w-0 space-y-3">
                <div className="space-y-2">
                  <h2 className="text-[1.65rem] font-black tracking-[-0.04em] text-[color:var(--tc-text-primary)]">
                    Selecao rapida de empresa
                  </h2>
                  <p className="max-w-[40rem] text-[0.98rem] leading-7 text-[color:var(--tc-text-muted)]">
                    Busque por nome ou slug, troque o contexto ativo e siga no painel sem quebrar o fluxo.
                  </p>
                </div>
              </div>

              <label className="w-full max-w-[28rem]">
                <span className="sr-only">Buscar empresa</span>
                <div className="flex items-center gap-3 rounded-[20px] border border-[color:var(--tc-border)] bg-white px-4 py-3 shadow-[0_14px_30px_rgba(15,23,42,0.05)] transition focus-within:border-[rgba(239,0,1,0.28)] focus-within:ring-2 focus-within:ring-[rgba(239,0,1,0.10)]">
                  <span className="text-[color:var(--tc-text-muted)]">
                    <FiSearch size={15} />
                  </span>
                  <input
                    value={companyQuery}
                    onChange={(event) => setCompanyQuery(event.target.value)}
                    placeholder="Buscar empresa por nome ou slug"
                    className="w-full bg-transparent text-sm font-medium text-[color:var(--tc-text-primary)] outline-none placeholder:text-[color:var(--tc-text-muted)]"
                  />
                </div>
              </label>
            </div>
            <div className="mt-5 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex min-w-max gap-4">
                <button
                  type="button"
                  onClick={() => setSelectedCompanySlug(null)}
                  className={`group flex w-[75vw] min-w-[16rem] max-w-[18.25rem] sm:w-[18.25rem] shrink-0 flex-col gap-3 rounded-[24px] border p-4 text-left transition ${
                    selectedCompanySlug == null
                      ? "border-[rgba(1,24,72,0.14)] bg-[linear-gradient(180deg,#ffffff_0%,#eef4ff_100%)] shadow-[0_18px_35px_rgba(1,24,72,0.08)]"
                      : "border-[color:var(--tc-border)] bg-[color:var(--tc-surface)] hover:border-[rgba(239,0,1,0.18)]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[color:var(--tc-text-muted)]">Visao global</div>
                      <div className="text-[1rem] font-black tracking-[-0.03em] text-[color:var(--tc-text-primary)]">Ambiente inteiro</div>
                    </div>
                    <span className="tc-status-pill" data-tone="neutral"><span className="tc-status-dot" />Geral</span>
                  </div>
                  <p className="text-[0.82rem] leading-6 text-[color:var(--tc-text-muted)]">
                    Compare empresas e leia o ranking sem travar em um unico cliente.
                  </p>
                  <div className="grid grid-cols-2 gap-4 border-t border-[color:var(--tc-border)] pt-3">
                    <QuickCompanyStat label="Empresas" value={companies.length} />
                    <QuickCompanyStat label="Pass rate" value={formatPercent(overview?.globalPassRate)} />
                  </div>
                </button>
                {orderedCompanies.map((company) => {
                  const key = resolveCompanyKey(company);
                  const selected = key === selectedCompanySlug;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSelectedCompanySlug(key)}
                      aria-pressed={selected}
                      className={`group relative flex w-[75vw] min-w-[16rem] max-w-[18.5rem] sm:w-[18.5rem] shrink-0 flex-col gap-3 overflow-hidden rounded-[24px] border p-4 text-left transition ${
                        selected
                          ? "border-[rgba(239,0,1,0.28)] bg-[linear-gradient(180deg,#ffffff_0%,#eef4ff_100%)] shadow-[0_24px_44px_rgba(1,24,72,0.12)] ring-1 ring-[rgba(239,0,1,0.16)]"
                          : "border-[color:var(--tc-border)] bg-[color:var(--tc-surface)] hover:border-[rgba(239,0,1,0.18)]"
                      }`}
                    >
                      {selected ? <span className="absolute inset-y-0 left-0 w-1.5 bg-[linear-gradient(180deg,var(--tc-primary)_0%,var(--tc-accent)_100%)]" /> : null}
                      <div className="space-y-3">
                        <div className="flex min-w-0 items-start gap-3">
                          <CompanyMark name={company.name} logo={company.logo} selected={selected} />
                          <div className="min-w-0">
                            <div className="flex min-h-[3rem] items-center whitespace-normal break-words text-[1rem] font-black leading-5 tracking-[-0.03em] text-[color:var(--tc-text-primary)]">
                              {company.name}
                            </div>
                          </div>
                        </div>
                        <div className="flex justify-end">
                          <span className="tc-status-pill" data-tone={GATE_META[company.gate.status].tone}>
                            <span className="tc-status-dot" />
                            {GATE_META[company.gate.status].label}
                          </span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 border-t border-[color:var(--tc-border)] pt-3">
                        <QuickCompanyStat label="Pass rate" value={formatPercent(company.passRate)} tone={selected ? "accent" : "default"} />
                        <QuickCompanyStat label="Runs" value={company.releases.length} />
                      </div>
                      <div className="grid grid-cols-2 gap-4 border-t border-[color:var(--tc-border)] pt-3">
                        <QuickCompanyMeta label="Alertas" value={`${countRuns(company, ["failed", "warning"])} em alerta`} />
                        <QuickCompanyMeta label="Ultima execucao" value={formatShortDate(company.latestRelease?.createdAt)} align="right" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          <div className="grid items-stretch gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
            <section ref={companyContextRef} className="tc-panel flex h-full flex-col">
              {!selectedCompany ? (
                <div className="flex h-full flex-col gap-5">
                  <div className="flex flex-col gap-4 border-b border-[color:var(--tc-border)] pb-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-3">
                      <div className="flex h-16 w-16 items-center justify-center rounded-[24px] bg-[linear-gradient(135deg,var(--tc-primary)_0%,var(--tc-primary-dark)_60%,rgba(239,0,1,0.82)_180%)] text-white shadow-[0_18px_38px_rgba(1,24,72,0.18)]">
                        <FiShield size={24} />
                      </div>
                      <div className="space-y-2">
                        <p className="text-lg font-bold text-[color:var(--tc-text-primary)]">Radar automatico do ambiente</p>
                        <p className="max-w-2xl text-sm leading-6 text-[color:var(--tc-text-muted)]">
                          Mesmo sem empresa focada, o painel aponta o que merece leitura imediata: contexto mais critico, melhor operacao, ultima empresa aberta e acao global sugerida.
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {mostCriticalCompany ? (
                        <button type="button" onClick={() => focusRankingCompany(mostCriticalCompany.slug ?? "", mostCriticalCompany.name)} className="tc-button-primary">
                          Focar empresa critica
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => rankingSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
                        className="tc-button-secondary"
                      >
                        Ver ranking operacional
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="tc-panel-muted">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--tc-text-muted)]">Maior prioridade agora</div>
                      <div className="mt-3 text-lg font-black tracking-[-0.03em] text-[color:var(--tc-text-primary)]">{mostCriticalCompany?.name ?? "Sem empresa critica"}</div>
                      <div className="mt-2 text-sm text-[color:var(--tc-text-muted)]">
                        {mostCriticalCompany
                          ? `${countRuns(mostCriticalCompany, ["failed", "warning"])} alertas | ${formatPercent(mostCriticalCompany.passRate)} de aprovacao`
                          : "O ambiente nao exibiu empresa critica na janela atual."}
                      </div>
                    </div>
                    <div className="tc-panel-muted">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--tc-text-muted)]">Melhor score atual</div>
                      <div className="mt-3 text-lg font-black tracking-[-0.03em] text-[color:var(--tc-text-primary)]">{bestCompany?.name ?? "Sem referencia"}</div>
                      <div className="mt-2 text-sm text-[color:var(--tc-text-muted)]">
                        {bestCompany ? `${formatPercent(bestCompany.passRate)} de pass rate | ${GATE_META[bestCompany.gate.status].label}` : "Aguardando telemetria suficiente para ranking interno."}
                      </div>
                    </div>
                    <div className="tc-panel-muted">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--tc-text-muted)]">Ultimo contexto acessado</div>
                      <div className="mt-3 text-lg font-black tracking-[-0.03em] text-[color:var(--tc-text-primary)]">{lastViewedCompany?.name ?? "Nenhuma empresa recente"}</div>
                      <div className="mt-2 text-sm text-[color:var(--tc-text-muted)]">
                        {lastViewedCompany
                          ? `${formatShortDate(lastViewedCompany.latestRelease?.createdAt)} na ultima execucao | ${countRuns(lastViewedCompany, ["failed", "warning"])} alertas`
                          : "O dashboard ainda nao recebeu um foco manual recente."}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-1 flex-col rounded-[24px] border border-[color:var(--tc-border)] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-5 shadow-[0_14px_28px_rgba(15,23,42,0.04)]">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-2">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--tc-text-muted)]">Visao util sem clique</div>
                        <h3 className="text-[1.2rem] font-extrabold tracking-[-0.03em] text-[color:var(--tc-text-primary)]">Prioridades automaticas do ambiente</h3>
                        <p className="max-w-2xl text-sm leading-6 text-[color:var(--tc-text-muted)]">
                          Use o painel para decidir onde entrar primeiro, sem depender de selecionar empresa para ter uma leitura operacional inicial.
                        </p>
                      </div>
                      {staleCompany ? (
                        <button type="button" onClick={() => focusRankingCompany(staleCompany.slug ?? "", staleCompany.name)} className="tc-button-secondary">
                          Abrir empresa sem execucao recente
                        </button>
                      ) : null}
                    </div>
                    <div className="mt-4 flex-1 space-y-3">
                      {attentionItems.slice(0, 3).map((item) => (
                        <div key={item.id} className={`rounded-[20px] border px-4 py-4 ${attentionToneClass(item.tone)}`}>
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/70">
                              <FiAlertTriangle />
                            </div>
                            <div className="space-y-1">
                              <p className="text-sm font-bold">{item.title}</p>
                              <p className="text-sm leading-6 opacity-90">{item.detail}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex h-full flex-col gap-5">
                  <div className="flex flex-col gap-4 border-b border-[color:var(--tc-border)] pb-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex items-start gap-4">
                      <CompanyMark name={selectedCompany.name} logo={selectedCompany.logo} selected />
                      <div className="space-y-3">
                      <p className="tc-panel-kicker">Empresa selecionada</p>
                      <div className="flex flex-wrap items-center gap-3">
                        <h2 className="tc-panel-title">{selectedCompany.name}</h2>
                        <span className="tc-status-pill" data-tone={GATE_META[selectedCompany.gate.status].tone}><span className="tc-status-dot" />{GATE_META[selectedCompany.gate.status].label}</span>
                      </div>
                      <p className="tc-panel-description max-w-3xl">Monitorando saude operacional, distribuicao das runs, defeitos em aberto e sinais de degradacao na empresa selecionada.</p>
                      </div>
                    </div>
                    <div className="grid min-w-[16rem] gap-3 sm:grid-cols-2">
                      <div className="tc-panel-muted">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--tc-text-muted)]">Tendencia</div>
                        <div className="mt-2 flex items-center gap-2 text-base font-semibold text-[color:var(--tc-text-primary)]">{selectedCompany.trend.direction === "down" ? <FiTrendingDown className="text-[color:var(--tc-accent)]" /> : <FiTrendingUp className="text-emerald-600" />}{formatTrend(selectedCompany.trend)}</div>
                      </div>
                      <div className="tc-panel-muted">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--tc-text-muted)]">Ultima execucao</div>
                        <div className="mt-2 text-base font-semibold text-[color:var(--tc-text-primary)]">{formatDate(selectedCompany.latestRelease?.createdAt)}</div>
                      </div>
                    </div>
                  </div>
                  <div className="tc-data-grid">
                    <div className="tc-kv"><div className="tc-kv-label">Pass rate</div><div className="tc-kv-value">{formatPercent(selectedCompany.passRate)}</div><div className="tc-kv-note">Indicador principal de qualidade da empresa.</div></div>
                    <div className="tc-kv"><div className="tc-kv-label">Runs monitoradas</div><div className="tc-kv-value">{selectedCompany.releases.length}</div><div className="tc-kv-note">Execucoes consideradas na janela atual.</div></div>
                    <div className="tc-kv"><div className="tc-kv-label">Runs aprovadas</div><div className="tc-kv-value">{countRuns(selectedCompany, "approved")}</div><div className="tc-kv-note">Releases que permaneceram saudaveis.</div></div>
                    <div className="tc-kv"><div className="tc-kv-label">Runs falhadas</div><div className="tc-kv-value">{countRuns(selectedCompany, "failed")}</div><div className="tc-kv-note">Releases em risco alto ou falha aberta.</div></div>
                    <div className="tc-kv"><div className="tc-kv-label">Defeitos abertos</div><div className="tc-kv-value">{selectedCompanyDefects.filter((item) => item.status !== "done").length}</div><div className="tc-kv-note">Visao resumida dos itens que ainda exigem acao.</div></div>
                    <div className="tc-kv"><div className="tc-kv-label">Criticos e bloqueios</div><div className="tc-kv-value">{criticalDefects}</div><div className="tc-kv-note">Falhas ou bloqueios que travam o fluxo operacional.</div></div>
                    <div className="tc-kv"><div className="tc-kv-label">Releases em risco</div><div className="tc-kv-value">{countRuns(selectedCompany, ["failed", "warning"])}</div><div className="tc-kv-note">Soma de releases com status warning ou failed.</div></div>
                    <div className="tc-kv"><div className="tc-kv-label">Sem telemetria</div><div className="tc-kv-value">{countRuns(selectedCompany, "no_data")}</div><div className="tc-kv-note">Runs sem base suficiente para decisao automatica.</div></div>
                  </div>
                  <div className="grid gap-3 rounded-[24px] border border-[color:var(--tc-border)] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-4 shadow-[0_12px_24px_rgba(15,23,42,0.04)] lg:grid-cols-3">
                    <div className="space-y-1">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--tc-text-muted)]">Acao sugerida</div>
                      <div className="text-sm font-bold text-[color:var(--tc-text-primary)]">
                        {criticalDefects > 0 || selectedCompany.gate.status === "failed"
                          ? "Priorizar triagem tecnica imediata"
                          : countRuns(selectedCompany, ["warning"]) > 0
                            ? "Validar releases sob observacao"
                            : "Manter cadencia e monitorar contexto"}
                      </div>
                      <div className="text-sm leading-6 text-[color:var(--tc-text-muted)]">
                        {criticalDefects > 0 || selectedCompany.gate.status === "failed"
                          ? "Ha sinal de risco real na empresa e o bloco de defeitos precisa de leitura rapida."
                          : countRuns(selectedCompany, ["warning"]) > 0
                            ? "A empresa nao esta em falha aberta, mas ja mostra oscilacao que merece antecipacao."
                            : "Sem alertas relevantes na janela atual; foco em consistencia e ultima execucao."}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--tc-text-muted)]">Ponto sensivel</div>
                      <div className="text-sm font-bold text-[color:var(--tc-text-primary)]">
                        {(hoursSince(selectedCompany.latestRelease?.createdAt) ?? 0) > 72
                          ? "Execucao desatualizada"
                          : countRuns(selectedCompany, "no_data") > 0
                            ? "Runs sem telemetria completa"
                            : "Telemetria em dia"}
                      </div>
                      <div className="text-sm leading-6 text-[color:var(--tc-text-muted)]">
                        {(hoursSince(selectedCompany.latestRelease?.createdAt) ?? 0) > 72
                          ? `A ultima execucao valida ja passou de ${hoursSince(selectedCompany.latestRelease?.createdAt)}h.`
                          : countRuns(selectedCompany, "no_data") > 0
                            ? `${countRuns(selectedCompany, "no_data")} runs ainda nao entregam sinal suficiente para score confiavel.`
                            : "A cobertura atual permite leitura mais segura do pass rate e do ranking."}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--tc-text-muted)]">Melhor sinal</div>
                      <div className="text-sm font-bold text-[color:var(--tc-text-primary)]">
                        {countRuns(selectedCompany, "approved") > 0
                          ? `${countRuns(selectedCompany, "approved")} runs aprovadas`
                          : "Sem aprovacao recente"}
                      </div>
                      <div className="text-sm leading-6 text-[color:var(--tc-text-muted)]">
                        {countRuns(selectedCompany, "approved") > 0
                          ? "A operacao ja mostrou estabilidade suficiente para apoiar a tomada de decisao."
                          : "Se nao houver aprovacao recente, vale cruzar eventos e run em foco antes de agir."}
                      </div>
                    </div>
                  </div>
                  <div className="mt-auto flex flex-wrap gap-3 border-t border-[color:var(--tc-border)] pt-4">
                    <Link href={selectedCompany.slug ? `/empresas/${encodeURIComponent(selectedCompany.slug)}/home` : "/admin/clients"} className="tc-button-primary">
                      Abrir contexto da empresa
                    </Link>
                    <Link href="/admin/runs" className="tc-button-secondary">
                      Ver runs
                    </Link>
                    <Link href="/admin/defeitos" className="tc-button-secondary">
                      Ver defeitos
                    </Link>
                    <Link href="/admin/chamados" className="tc-button-secondary">
                      Abrir chamados
                    </Link>
                  </div>
                </div>
              )}
            </section>

            <div className="flex h-full flex-col gap-5">
              <section className="tc-panel">
                <div className="tc-panel-header">
                  <div className="space-y-2">
                    <p className="tc-panel-kicker">Atencao agora</p>
                    <h3 className="text-[1.35rem] font-extrabold tracking-[-0.03em] text-[color:var(--tc-text-primary)]">{selectedCompany ? `Prioridades de ${selectedCompany.name}` : "Prioridades do ambiente"}</h3>
                    <p className="tc-panel-description">Itens que merecem acao imediata para manter qualidade, estabilidade e cadencia de execucao.</p>
                  </div>
                </div>
                <div className="mt-5 space-y-3">
                  {attentionItems.length === 0 ? <div className="tc-empty-state">Nenhum alerta critico ativo agora. O ambiente esta estavel na leitura atual.</div> : attentionItems.map((item) => {
                    const content = (
                      <div className={`rounded-[22px] border px-4 py-4 ${attentionToneClass(item.tone)}`}>
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/70"><FiAlertTriangle /></div>
                          <div className="min-w-0 flex-1 space-y-1">
                            <p className="text-sm font-bold">{item.title}</p>
                            <p className="text-sm leading-6 opacity-90">{item.detail}</p>
                          </div>
                        </div>
                      </div>
                    );
                    return item.href ? <Link key={item.id} href={item.href}>{content}</Link> : <div key={item.id}>{content}</div>;
                  })}
                </div>
              </section>

              <section className="tc-panel">
                <div className="tc-panel-header">
                  <div className="space-y-2">
                    <p className="tc-panel-kicker">Eventos recentes</p>
                    <h3 className="text-[1.35rem] font-extrabold tracking-[-0.03em] text-[color:var(--tc-text-primary)]">Movimentos que impactam a saude</h3>
                    <p className="tc-panel-description">Historico curto do contexto atual para entender o que mudou antes de agir.</p>
                  </div>
                </div>
                  <div className="mt-5 space-y-3">
                  {loadingAudit ? (
                    <div className="tc-empty-state">Carregando historico...</div>
                  ) : selectedHistory.length === 0 ? (
                    <div className="tc-empty-state">Nenhum evento relevante encontrado nesta janela.</div>
                  ) : (
                    selectedHistory.map((item) => {
                      const meta = getEventMeta(item.action);
                      const Icon = meta.icon;
                      return (
                        <div key={item.id} className="rounded-[20px] border border-[color:var(--tc-border)] bg-[color:var(--tc-surface-2)] px-4 py-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-start gap-3">
                              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border ${meta.toneClass}`}>
                                <Icon size={15} />
                              </div>
                              <div className="min-w-0 space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] ${meta.toneClass}`}>
                                    {meta.label}
                                  </span>
                                  <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--tc-text-muted)]">
                                    {item.entity_type ?? "registro"}
                                  </span>
                                </div>
                                <div className="truncate text-sm font-semibold text-[color:var(--tc-text-primary)]">{item.entity_label ?? "Registro da plataforma"}</div>
                                <div className="text-xs text-[color:var(--tc-text-muted)]">Responsavel: {item.actor_email ?? "Sistema"}</div>
                              </div>
                            </div>
                            <div className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--tc-text-muted)]">
                              {formatDate(item.created_at)}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </section>
            </div>
          </div>

          <div className="grid items-stretch gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
            <section className="tc-panel flex h-full flex-col">
              <div className="tc-panel-header">
                <div className="space-y-2">
                  <p className="tc-panel-kicker">Defeitos abertos</p>
                  <h3 className="text-[1.35rem] font-extrabold tracking-[-0.03em] text-[color:var(--tc-text-primary)]">{selectedCompany ? `Defeitos relevantes de ${selectedCompany.name}` : "Resumo executivo de defeitos"}</h3>
                  <p className="tc-panel-description">Visao curta dos itens mais importantes para triagem, decisao e acompanhamento rapido.</p>
                </div>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="tc-panel-muted"><div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--tc-text-muted)]">Total aberto</div><div className="mt-2 text-3xl font-extrabold text-[color:var(--tc-text-primary)]">{defectScope.filter((item) => item.status !== "done").length}</div></div>
                <div className="tc-panel-muted"><div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--tc-text-muted)]">Falha aberta</div><div className="mt-2 text-3xl font-extrabold text-[color:var(--tc-accent)]">{defectScope.filter((item) => item.status === "fail").length}</div></div>
                <div className="tc-panel-muted"><div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--tc-text-muted)]">Bloqueados</div><div className="mt-2 text-3xl font-extrabold text-[color:#b45309]">{blockedDefects}</div></div>
              </div>
              <div className="mt-5 grid flex-1 gap-3">
                {loadingDefects ? (
                  <div className="tc-empty-state">Carregando defeitos...</div>
                ) : relevantDefects.length === 0 ? (
                  <div className="tc-empty-state flex min-h-[10.25rem] flex-1 items-center justify-center">
                    {selectedCompany
                      ? `Nenhum defeito relevante encontrado para ${selectedCompany.name}. O foco imediato segue na saude das runs e no historico recente.`
                      : "Nenhum defeito relevante no ambiente agora. Use o ranking ou o radar automatico para abrir a empresa que mais merece leitura."}
                  </div>
                ) : (
                  relevantDefects.map((defect) => (
                    <div key={defect.id} className="rounded-[22px] border border-[color:var(--tc-border)] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-4 shadow-[0_14px_28px_rgba(15,23,42,0.05)]">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="tc-status-pill" data-tone={defect.status === "fail" ? "danger" : defect.status === "blocked" ? "warning" : "neutral"}><span className="tc-status-dot" />{DEFECT_LABELS[defect.status] ?? defect.status}</span>
                            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--tc-text-muted)]">{defect.origin === "manual" ? "Manual" : "Qase"}</span>
                          </div>
                          <h4 className="text-base font-bold text-[color:var(--tc-text-primary)]">{defect.title}</h4>
                          <p className="text-sm text-[color:var(--tc-text-muted)]">Empresa: {defect.companyName ?? "Sem empresa vinculada"} | Run: {defect.run_id ?? "--"}</p>
                        </div>
                        {defect.url ? <Link href={defect.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--tc-accent)]">Ver caso<FiExternalLink size={14} /></Link> : null}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <div className="flex h-full flex-col gap-5">
              <section className="tc-panel flex h-full flex-col">
                <div className="tc-panel-header">
                  <div className="space-y-2">
                    <p className="tc-panel-kicker">Run em foco</p>
                    <h3 className="text-[1.35rem] font-extrabold tracking-[-0.03em] text-[color:var(--tc-text-primary)]">{runInFocus?.title ?? "Foco sugerido de execucao"}</h3>
                  </div>
                  {selectedCompany?.releases.length ? (
                    <select value={selectedRun?.slug ?? ""} onChange={(event) => setSelectedRunSlug(event.target.value || null)} className="rounded-full border border-[color:var(--tc-border)] bg-[color:var(--tc-surface-2)] px-4 py-2 text-sm font-semibold text-[color:var(--tc-text-primary)] outline-none" aria-label="Selecionar run em foco">
                      {selectedCompany.releases.map((release) => <option key={release.slug} value={release.slug ?? ""}>{release.title ?? release.slug}</option>)}
                    </select>
                  ) : null}
                </div>
                {!runInFocus ? (
                  <div className="mt-5 tc-empty-state flex min-h-[10.25rem] flex-1 items-center justify-center">
                    Nenhuma run relevante foi encontrada ainda. Use o trilho superior para abrir a empresa com telemetria ativa.
                  </div>
                ) : (
                  <div className="mt-5 flex flex-1 flex-col space-y-4">
                    <div className="rounded-[22px] border border-[color:var(--tc-border)] bg-[color:var(--tc-surface-2)] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--tc-text-muted)]">
                            {selectedCompany ? "Run atual" : `Sugestao para ${suggestedRunCompany?.name ?? "o ambiente"}`}
                          </div>
                          <div className="text-lg font-bold text-[color:var(--tc-text-primary)]">{runInFocus.title ?? runInFocus.slug}</div>
                          {!selectedCompany && suggestedRunCompany ? (
                            <p className="text-sm text-[color:var(--tc-text-muted)]">
                              {suggestedRunCompany.name} concentra {countRuns(suggestedRunCompany, ["failed", "warning"])} alertas e {formatPercent(suggestedRunCompany.passRate)} de pass rate.
                            </p>
                          ) : null}
                        </div>
                        <span className="tc-status-pill" data-tone={GATE_META[runInFocus.gate.status].tone}><span className="tc-status-dot" />{GATE_META[runInFocus.gate.status].label}</span>
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div className="tc-panel-muted"><div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--tc-text-muted)]">Pass rate</div><div className="mt-2 text-2xl font-extrabold text-[color:var(--tc-text-primary)]">{formatPercent(runInFocus.passRate)}</div></div>
                        <div className="tc-panel-muted"><div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--tc-text-muted)]">Data da execucao</div><div className="mt-2 text-base font-bold text-[color:var(--tc-text-primary)]">{formatDate(runInFocus.createdAt ?? runInFocus.created_at)}</div></div>
                      </div>
                    </div>
                    {!selectedCompany && suggestedRunCompany ? (
                      <button type="button" onClick={() => focusRankingCompany(suggestedRunCompany.slug ?? "", suggestedRunCompany.name)} className="tc-button-secondary">
                        Abrir contexto de {suggestedRunCompany.name}
                      </button>
                    ) : null}
                    <div className="space-y-3">
                      {selectedRunBars.map((bar) => (
                        <div key={bar.id} className="space-y-2">
                          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--tc-text-muted)]"><span>{bar.label}</span><span>{bar.value}</span></div>
                          <div className="h-2.5 rounded-full bg-[color:var(--tc-surface-2)]"><div className={`h-2.5 rounded-full ${bar.color}`} style={{ width: `${progressWidth(bar.value, Math.max(runInFocusTotal, 1))}%` }} /></div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>

            </div>
          </div>

          <section ref={rankingSectionRef} className="tc-panel">
            <div className="tc-panel-header">
              <div className="space-y-2">
                <p className="tc-panel-kicker">Ranking de qualidade por empresa</p>
                <h2 className="tc-panel-title">Comparativo operacional do ambiente</h2>
                <p className="tc-panel-description">Score, status, pass rate, alertas e ultima execucao para decidir rapidamente onde agir.</p>
              </div>
            </div>
            <div className="mt-6 space-y-5">
              {loadingRanking ? (
                <div className="tc-empty-state">Carregando ranking...</div>
              ) : rankingRows.length ? (
                <div className="overflow-x-auto overflow-hidden rounded-[28px] border border-[color:var(--tc-border)] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] shadow-[0_18px_38px_rgba(15,23,42,0.05)]">
                  <div className="min-w-[52rem] grid grid-cols-[4.75rem_minmax(0,1.8fr)_7rem_9rem_7rem_7rem_9rem_8rem] gap-3 border-b border-[color:var(--tc-border)] bg-[rgba(1,24,72,0.04)] px-5 py-4 text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--tc-text-muted)]">
                    <span>Pos.</span>
                    <span>Empresa</span>
                    <span>Score</span>
                    <span>Status</span>
                    <span>Pass rate</span>
                    <span>Alertas</span>
                    <span>Ultima execucao</span>
                    <span className="text-right">Acao</span>
                  </div>
                  <div className="divide-y divide-[color:var(--tc-border)]">
                    {rankingRows.map((company) => (
                      <div
                        key={`${company.slug}-${company.position}`}
                        className={`min-w-[52rem] grid grid-cols-[4.75rem_minmax(0,1.8fr)_7rem_9rem_7rem_7rem_9rem_8rem] items-center gap-3 px-5 py-4 transition hover:bg-[rgba(1,24,72,0.03)] ${
                          company.position <= 3 ? "bg-[rgba(1,24,72,0.015)]" : ""
                        } ${
                          selectedCompany && normalizeText(selectedCompany.name) === normalizeText(company.name)
                            ? "bg-[rgba(239,0,1,0.04)]"
                            : ""
                        }`}
                      >
                        <div className="flex items-center">
                          <div className={`flex h-10 w-10 items-center justify-center rounded-[16px] border text-sm font-black ${
                            company.position === 1
                              ? "border-[rgba(239,0,1,0.2)] bg-[rgba(239,0,1,0.08)] text-[color:var(--tc-accent)]"
                              : "border-[rgba(1,24,72,0.08)] bg-white text-[color:var(--tc-primary)]"
                          }`}>
                            #{company.position}
                          </div>
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-base font-bold text-[color:var(--tc-text-primary)]">{company.name}</div>
                          <div className="mt-1 truncate text-sm text-[color:var(--tc-text-muted)]">{company.trendSummary}</div>
                        </div>
                        <div className="text-[1.65rem] font-black tracking-[-0.04em] text-[color:var(--tc-text-primary)]">{company.score}</div>
                        <div>
                          <span className="tc-status-pill" data-tone={RANKING_STATUS_META[company.status].tone}>
                            <span className="tc-status-dot" />
                            {RANKING_STATUS_META[company.status].label}
                          </span>
                        </div>
                        <div className="text-sm font-semibold text-[color:var(--tc-text-primary)]">{formatPercent(company.passRate)}</div>
                        <div className="text-sm font-semibold text-[color:var(--tc-text-primary)]">
                          {typeof company.alertCount === "number" ? company.alertCount : "--"}
                        </div>
                        <div className="text-sm font-semibold text-[color:var(--tc-text-primary)]">{formatShortDate(company.latestRunAt)}</div>
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => focusRankingCompany(company.slug, company.name)}
                            className="inline-flex items-center gap-2 rounded-full border border-[rgba(1,24,72,0.08)] bg-white px-3 py-2 text-sm font-semibold text-[color:var(--tc-primary)] transition hover:border-[rgba(239,0,1,0.18)] hover:text-[color:var(--tc-accent)]"
                          >
                            Abrir contexto
                            <FiArrowUpRight size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="tc-empty-state">Nenhuma empresa encontrada no ranking.</div>
              )}
            </div>
          </section>
        </div>

        <div className="fixed bottom-6 right-6 z-40">
          <TicketsButton />
        </div>
      </div>
  );
}
