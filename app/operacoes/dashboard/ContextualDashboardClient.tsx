"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  FiCheckCircle,
  FiClock,
  FiCompass,
  FiFilter,
  FiRefreshCw,
  FiSave,
  FiSearch,
  FiSliders,
  FiX,
  FiZap,
} from "react-icons/fi";

import { useAuthUser } from "@/hooks/useAuthUser";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { fetchApi } from "@/backend/api";
import { resolveDashboardContext } from "@/backend/dashboard/context";
import {
  DEFAULT_CONTEXTUAL_DASHBOARD_FILTERS,
  buildDashboardAggregate,
  buildDashboardInsights,
  composeDashboardWidgets,
  filterDashboardSignals,
  getContextualStatusOptions,
  isRiskSignal,
  isWithoutOwner,
  normalizeDashboardModule,
  resolveSignalModule,
  type ContextualDashboardFilters,
  type DashboardAggregate,
  type DashboardBucket,
  type DashboardCompanyOption,
  type DashboardInsight,
  type DashboardModule,
  type DashboardPeriodPreset,
  type DashboardSignal,
  type DashboardSignalPriority,
  type DashboardSignalSeverity,
  type DashboardSignalStatus,
  type DashboardViewMode,
  type DashboardWidgetDefinition,
} from "@/backend/dashboard/contextual";
import { normalizeLegacyRole, SYSTEM_ROLES } from "@/backend/auth/roles";

type DashboardPayload = {
  period?: string;
  periodFrom?: string;
  periodTo?: string;
  companies?: DashboardCompanyOption[];
  signals?: DashboardSignal[];
  history?: Array<{ id: string; title: string; companyName: string; module: string; updatedAtIso: string }>;
  warnings?: string[];
};

type SavedDashboardView = {
  id: string;
  name: string;
  filters: ContextualDashboardFilters;
  createdAt: string;
};

type DrawerState = {
  title: string;
  subtitle: string;
  items: DashboardSignal[];
} | null;

const MODULE_OPTIONS: DashboardModule[] = ["Runs", "Defeitos", "Automacoes", "Integracoes"];

const VIEW_MODES: Array<{ id: DashboardViewMode; label: string; module?: DashboardModule }> = [
  { id: "overview", label: "Visao geral" },
  { id: "companies", label: "Empresas" },
  { id: "applications", label: "Aplicacoes" },
  { id: "runs", label: "Runs", module: "Runs" },
  { id: "defects", label: "Defeitos", module: "Defeitos" },
  { id: "risks", label: "Riscos" },
  { id: "activity", label: "Atividades" },
];

const PERIOD_OPTIONS: Array<{ id: DashboardPeriodPreset; label: string }> = [
  { id: "24h", label: "Ultimas 24h" },
  { id: "7d", label: "Ultimos 7 dias" },
  { id: "30d", label: "Ultimos 30 dias" },
  { id: "this_month", label: "Este mes" },
  { id: "previous_month", label: "Mes anterior" },
  { id: "custom", label: "Personalizado" },
];

const STATUS_LABELS: Record<DashboardSignalStatus, string> = {
  new: "Novo",
  analyzing: "Em analise",
  in_progress: "Em andamento",
  blocked: "Bloqueado",
  resolved: "Resolvido",
  failed: "Falhou",
  alert: "Alerta",
};

const SEVERITY_LABELS: Record<DashboardSignalSeverity, string> = {
  critical: "Critica",
  high: "Alta",
  medium: "Media",
  low: "Baixa",
};

const PRIORITY_LABELS: Record<DashboardSignalPriority, string> = {
  P0: "P0",
  P1: "P1",
  P2: "P2",
  P3: "P3",
};

const ROLE_LABELS: Record<string, string> = {
  [SYSTEM_ROLES.EMPRESA]: "Empresa",
  [SYSTEM_ROLES.COMPANY_USER]: "Usuario da empresa",
  [SYSTEM_ROLES.TESTING_COMPANY_USER]: "Usuario TC",
  [SYSTEM_ROLES.LEADER_TC]: "Lider TC",
  [SYSTEM_ROLES.TECHNICAL_SUPPORT]: "Suporte TC",
};

const STORAGE_PREFIX = "tc:contextual-dashboard-views";

const BAR_FILL_WIDTH_CLASSES = [
  "w-[8%]",
  "w-[16%]",
  "w-[24%]",
  "w-[32%]",
  "w-[40%]",
  "w-[48%]",
  "w-[56%]",
  "w-[64%]",
  "w-[72%]",
  "w-[80%]",
  "w-[88%]",
  "w-full",
] as const;

const BAR_FILL_HEIGHT_CLASSES = [
  "h-[8%]",
  "h-[16%]",
  "h-[24%]",
  "h-[32%]",
  "h-[40%]",
  "h-[48%]",
  "h-[56%]",
  "h-[64%]",
  "h-[72%]",
  "h-[80%]",
  "h-[88%]",
  "h-full",
] as const;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown, fallback = "") {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
}

function parseSignals(value: unknown): DashboardSignal[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index): DashboardSignal | null => {
      const row = asRecord(item);
      if (!row) return null;
      const type = asString(row.type, "run") as DashboardSignal["type"];
      const signal: DashboardSignal = {
        id: asString(row.id, `signal-${index}`),
        type,
        title: asString(row.title, "Item operacional"),
        companySlug: asString(row.companySlug),
        companyName: asString(row.companyName),
        application: asString(row.application, "N/A"),
        module: asString(row.module, type === "defect" ? "Defeitos" : type === "automation" ? "Automacoes" : type === "integration" ? "Integracoes" : "Runs"),
        status: asString(row.status, "new") as DashboardSignalStatus,
        owner: asString(row.owner, "Sem responsavel"),
        severity: asString(row.severity, "medium") as DashboardSignalSeverity,
        priority: asString(row.priority, "P2") as DashboardSignalPriority,
        runCode: asString(row.runCode),
        defectCode: asString(row.defectCode),
        updatedAtIso: asString(row.updatedAtIso, new Date().toISOString()),
      };
      if (typeof row.passRate === "number") signal.passRate = row.passRate;
      if (typeof row.failCount === "number") signal.failCount = row.failCount;
      if (typeof row.durationMin === "number") signal.durationMin = row.durationMin;
      return signal;
    })
    .filter((item): item is DashboardSignal => item !== null);
}

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}

function countLabel(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function formatAgo(value?: string | null) {
  if (!value) return "sem atualizacao";
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return "sem atualizacao";
  const seconds = Math.max(0, Math.round((Date.now() - time) / 1000));
  if (seconds < 10) return "agora";
  if (seconds < 60) return `ha ${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `ha ${minutes}min`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `ha ${hours}h`;
  const days = Math.round(hours / 24);
  return `ha ${days}d`;
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "-";
  return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function periodLabel(filters: Pick<ContextualDashboardFilters, "periodPreset" | "dateFrom" | "dateTo">) {
  if (filters.periodPreset === "custom") {
    if (filters.dateFrom || filters.dateTo) return `${filters.dateFrom || "inicio"} ate ${filters.dateTo || "agora"}`;
    return "Periodo personalizado";
  }
  return PERIOD_OPTIONS.find((period) => period.id === filters.periodPreset)?.label ?? "Periodo";
}

function moduleLabel(module: DashboardModule) {
  if (module === "Automacoes") return "Automacoes";
  if (module === "Integracoes") return "Integracoes";
  if (module === "Aplicacoes") return "Aplicacoes";
  return module;
}

function toneClass(tone: "critical" | "warning" | "positive" | "neutral") {
  if (tone === "critical") return "border-[rgba(239,0,1,0.20)] bg-[rgba(239,0,1,0.07)] text-[#a80001]";
  if (tone === "warning") return "border-[rgba(245,158,11,0.24)] bg-[rgba(245,158,11,0.09)] text-[#a15c07]";
  if (tone === "positive") return "border-[rgba(16,185,129,0.22)] bg-[rgba(16,185,129,0.08)] text-[#047857]";
  return "border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] text-[var(--tc-text,#0b1a3c)]";
}

function fillLevelClass(
  value: number,
  max: number,
  classes: readonly string[],
) {
  if (!Number.isFinite(value) || value <= 0) return classes[0];
  const ratio = Math.max(0.08, Math.min(1, value / Math.max(1, max)));
  const index = Math.min(classes.length - 1, Math.max(0, Math.ceil(ratio * classes.length) - 1));
  return classes[index];
}

function statusTone(status: DashboardSignalStatus) {
  if (status === "failed" || status === "alert") return "critical" as const;
  if (status === "blocked" || status === "analyzing" || status === "in_progress") return "warning" as const;
  if (status === "resolved") return "positive" as const;
  return "neutral" as const;
}

function getStorageKey(userId?: string | null) {
  return `${STORAGE_PREFIX}:${userId || "anon"}`;
}

function normalizeCompanyOptions(companies: Array<{ id?: string; slug: string; name: string }>) {
  const seen = new Set<string>();
  return companies
    .map((company) => ({ slug: company.slug.trim().toLowerCase(), name: company.name || company.slug }))
    .filter((company) => {
      if (!company.slug || seen.has(company.slug)) return false;
      seen.add(company.slug);
      return true;
    });
}

function buildApiPeriod(filters: ContextualDashboardFilters) {
  const query = new URLSearchParams();
  query.set("period", filters.periodPreset);
  if (filters.periodPreset === "custom") {
    if (filters.dateFrom) query.set("dateFrom", filters.dateFrom);
    if (filters.dateTo) query.set("dateTo", filters.dateTo);
  }
  filters.companySlugs.forEach((slug) => query.append("companySlug", slug));
  return query;
}

function applyViewModeDefaults(filters: ContextualDashboardFilters, viewMode: DashboardViewMode): ContextualDashboardFilters {
  const mode = VIEW_MODES.find((item) => item.id === viewMode);
  if (!mode?.module) return { ...filters, viewMode };
  return {
    ...filters,
    viewMode,
    modules: [mode.module],
    status: "all",
    onlyCritical: viewMode === "risks" ? true : filters.onlyCritical,
  };
}

function selectedCompaniesLabel(filters: ContextualDashboardFilters, companies: DashboardCompanyOption[], privileged: boolean) {
  if (filters.companySlugs.length === 0) {
    return privileged ? "Todas as empresas permitidas" : "Sem empresa selecionada";
  }
  const selected = companies.filter((company) => filters.companySlugs.includes(company.slug));
  if (selected.length === 1) return selected[0].name;
  if (selected.length > 1 && selected.length <= 3) return selected.map((company) => company.name).join(", ");
  return `${selected.length || filters.companySlugs.length} empresas selecionadas`;
}

function buildFilterChips(filters: ContextualDashboardFilters, companies: DashboardCompanyOption[], privileged: boolean) {
  const chips = [
    `Empresa: ${selectedCompaniesLabel(filters, companies, privileged)}`,
    `Periodo: ${periodLabel(filters)}`,
  ];
  if (filters.application !== "all") chips.push(`Aplicacao: ${filters.application}`);
  if (filters.modules.length) chips.push(`Modulo: ${filters.modules.map(moduleLabel).join(", ")}`);
  if (filters.status !== "all") chips.push(`Status: ${STATUS_LABELS[filters.status] ?? filters.status}`);
  if (filters.owner !== "all") chips.push(`Responsavel: ${filters.owner}`);
  if (filters.severity !== "all") chips.push(`Severidade: ${SEVERITY_LABELS[filters.severity]}`);
  if (filters.priority !== "all") chips.push(`Prioridade: ${filters.priority}`);
  if (filters.onlyCritical) chips.push("Somente criticos");
  if (filters.onlyFailed) chips.push("Somente falhas");
  if (filters.onlyBlocked) chips.push("Somente bloqueados");
  if (filters.onlyWithoutOwner) chips.push("Sem responsavel");
  if (filters.recentlyChanged) chips.push("Alterados nas ultimas 24h");
  return chips;
}

function EmptyState({
  title,
  detail,
  actions,
}: {
  title: string;
  detail: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--tc-border,#d7deea)] bg-[linear-gradient(180deg,var(--tc-surface,#fff)_0%,var(--tc-surface-2,#f8fafc)_100%)] p-6">
      <p className="text-base font-bold text-[var(--tc-text,#0b1a3c)]">{title}</p>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--tc-text-muted,#6b7280)]">{detail}</p>
      {actions ? <div className="mt-4 flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

function SkeletonDashboard() {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="h-44 animate-pulse rounded-2xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#fff)] p-4">
          <div className="h-3 w-24 rounded-full bg-slate-200" />
          <div className="mt-5 h-7 w-32 rounded-full bg-slate-200" />
          <div className="mt-8 h-16 rounded-xl bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

function InsightStrip({ insights }: { insights: DashboardInsight[] }) {
  if (!insights.length) return null;
  return (
    <section className="grid gap-3 lg:grid-cols-2">
      {insights.map((insight) => (
        <div key={insight.id} className={`rounded-2xl border px-4 py-3 ${toneClass(insight.tone)}`}>
          <div className="flex items-start gap-3">
            <FiZap className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="text-sm font-black">{insight.title}</p>
              <p className="mt-1 text-sm leading-5 opacity-80">{insight.detail}</p>
            </div>
          </div>
        </div>
      ))}
    </section>
  );
}

function MetricButton({
  label,
  value,
  detail,
  tone,
  onClick,
}: {
  label: string;
  value: number | string;
  detail: string;
  tone: "critical" | "warning" | "positive" | "neutral";
  onClick?: () => void;
}) {
  const Component = onClick ? "button" : "div";
  return (
    <Component
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`rounded-2xl border p-4 text-left transition ${toneClass(tone)} ${onClick ? "hover:-translate-y-0.5 hover:shadow-[0_18px_30px_rgba(15,23,42,0.08)]" : ""}`}
    >
      <p className="text-[0.68rem] font-black uppercase tracking-[0.18em] opacity-70">{label}</p>
      <p className="mt-2 text-3xl font-black tracking-[-0.04em]">{value}</p>
      <p className="mt-2 text-xs leading-5 opacity-80">{detail}</p>
    </Component>
  );
}

function WidgetShell({
  widget,
  children,
  action,
}: {
  widget: Pick<DashboardWidgetDefinition, "title" | "question" | "reason">;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#fff)] p-4 shadow-[0_14px_30px_rgba(15,23,42,0.04)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[0.68rem] font-black uppercase tracking-[0.2em] text-[var(--tc-accent,#ef0001)]">{widget.question}</p>
          <h3 className="mt-1 text-lg font-black tracking-[-0.03em] text-[var(--tc-text,#0b1a3c)]">{widget.title}</h3>
          <p className="mt-1 text-xs leading-5 text-[var(--tc-text-muted,#6b7280)]">{widget.reason}</p>
        </div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function BucketBars({
  buckets,
  maxItems = 7,
  onSelect,
  emptyLabel = "Sem distribuicao para este recorte.",
}: {
  buckets: DashboardBucket[];
  maxItems?: number;
  onSelect?: (bucket: DashboardBucket) => void;
  emptyLabel?: string;
}) {
  const visible = buckets.slice(0, maxItems);
  const max = Math.max(1, ...visible.map((bucket) => bucket.count));
  if (!visible.length) return <p className="text-sm text-[var(--tc-text-muted,#6b7280)]">{emptyLabel}</p>;
  return (
    <div className="space-y-3">
      {visible.map((bucket) => (
        <button
          key={bucket.key}
          type="button"
          onClick={() => onSelect?.(bucket)}
          className="group grid w-full grid-cols-[minmax(0,1fr)_3.75rem] items-center gap-3 text-left"
        >
          <div className="min-w-0">
            <div className="mb-1 flex items-center justify-between gap-2 text-xs font-bold text-[var(--tc-text,#0b1a3c)]">
              <span className="truncate">{bucket.label}</span>
              {bucket.riskCount > 0 ? <span className="text-[var(--tc-accent,#ef0001)]">{bucket.riskCount} risco</span> : null}
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-[var(--tc-surface-2,#f8fafc)]">
              <div
                className={`h-full rounded-full bg-[linear-gradient(90deg,#011848_0%,#ef0001_100%)] transition-all duration-500 group-hover:brightness-110 ${fillLevelClass(bucket.count, max, BAR_FILL_WIDTH_CLASSES)}`}
              />
            </div>
          </div>
          <div className="text-right text-lg font-black text-[var(--tc-text,#0b1a3c)]">{bucket.count}</div>
        </button>
      ))}
    </div>
  );
}

function TimelineBars({ buckets }: { buckets: DashboardBucket[] }) {
  const max = Math.max(1, ...buckets.map((bucket) => bucket.count));
  if (buckets.length <= 1) return <p className="text-sm text-[var(--tc-text-muted,#6b7280)]">Sem serie temporal suficiente para este recorte.</p>;
  return (
    <div className="flex h-48 items-end gap-2 overflow-x-auto rounded-2xl border border-[var(--tc-border,#d7deea)] bg-[linear-gradient(180deg,#f9fbff_0%,#fff_100%)] p-4">
      {buckets.map((bucket) => (
        <div key={bucket.key} className="flex min-w-10 flex-1 flex-col items-center gap-2">
          <div className="flex h-32 w-full items-end">
            <div
              className={`w-full rounded-t-xl bg-[linear-gradient(180deg,#ef0001_0%,#011848_100%)] shadow-[0_8px_20px_rgba(1,24,72,0.16)] transition-all duration-500 ${fillLevelClass(bucket.count, max, BAR_FILL_HEIGHT_CLASSES)}`}
              title={`${bucket.label}: ${bucket.count}`}
            />
          </div>
          <span className="whitespace-nowrap text-[0.68rem] font-semibold text-[var(--tc-text-muted,#6b7280)]">{bucket.label}</span>
        </div>
      ))}
    </div>
  );
}

function Heatmap({
  signals,
  companies,
  onSelect,
}: {
  signals: DashboardSignal[];
  companies: DashboardBucket[];
  onSelect: (companySlug: string, moduleName: DashboardModule) => void;
}) {
  const modules = MODULE_OPTIONS;
  const rows = companies.slice(0, 8);
  if (rows.length < 2) return <p className="text-sm text-[var(--tc-text-muted,#6b7280)]">O mapa de calor aparece quando ha mais de uma empresa no recorte.</p>;

  return (
    <div className="overflow-x-auto">
      <div className="min-w-176">
        <div className="grid grid-cols-[12rem_repeat(4,minmax(7rem,1fr))] gap-2 text-xs font-black uppercase tracking-[0.14em] text-[var(--tc-text-muted,#6b7280)]">
          <span>Empresa</span>
          {modules.map((moduleName) => <span key={moduleName}>{moduleLabel(moduleName)}</span>)}
        </div>
        <div className="mt-2 space-y-2">
          {rows.map((company) => (
            <div key={company.key} className="grid grid-cols-[12rem_repeat(4,minmax(7rem,1fr))] gap-2">
              <div className="truncate rounded-xl bg-[var(--tc-surface-2,#f8fafc)] px-3 py-2 text-sm font-bold text-[var(--tc-text,#0b1a3c)]">{company.label}</div>
              {modules.map((moduleName) => {
                const moduleSignals = signals.filter((signal) => signal.companySlug === company.key && resolveSignalModule(signal) === moduleName);
                const risk = moduleSignals.filter((signal) => isRiskSignal(signal)).length;
                const tone = risk > 4 ? "critical" : risk > 0 ? "warning" : moduleSignals.length > 0 ? "positive" : "neutral";
                return (
                  <button
                    key={`${company.key}-${moduleName}`}
                    type="button"
                    onClick={() => onSelect(company.key, moduleName)}
                    disabled={moduleSignals.length === 0}
                    className={`rounded-xl border px-3 py-2 text-left text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${toneClass(tone)}`}
                  >
                    {moduleSignals.length === 0 ? "Sem dado" : risk > 0 ? `${risk} risco(s)` : `${moduleSignals.length} ok`}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SignalList({
  items,
  onOpen,
  limit = 8,
}: {
  items: DashboardSignal[];
  onOpen: (item: DashboardSignal) => void;
  limit?: number;
}) {
  const visible = items.slice(0, limit);
  if (!visible.length) return <p className="text-sm text-[var(--tc-text-muted,#6b7280)]">Sem itens para listar neste bloco.</p>;
  return (
    <div className="divide-y divide-(--tc-border,#e5e7eb) overflow-hidden rounded-2xl border border-[var(--tc-border,#d7deea)]">
      {visible.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onOpen(item)}
          className="grid w-full gap-2 bg-[var(--tc-surface,#fff)] px-4 py-3 text-left transition hover:bg-[var(--tc-surface-2,#f8fafc)] md:grid-cols-[minmax(0,1.4fr)_9rem_8rem_8rem]"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-black text-[var(--tc-text,#0b1a3c)]">{item.title}</p>
            <p className="mt-1 truncate text-xs text-[var(--tc-text-muted,#6b7280)]">
              {item.companyName} | {item.application} | {moduleLabel(resolveSignalModule(item))}
            </p>
          </div>
          <span className={`h-fit w-fit rounded-full border px-2.5 py-1 text-xs font-bold ${toneClass(statusTone(item.status))}`}>
            {STATUS_LABELS[item.status] ?? item.status}
          </span>
          <span className="truncate text-sm font-semibold text-[var(--tc-text,#0b1a3c)]">{item.owner || "Sem responsavel"}</span>
          <span className="text-sm text-[var(--tc-text-muted,#6b7280)]">{formatAgo(item.updatedAtIso)}</span>
        </button>
      ))}
    </div>
  );
}

function DashboardDrawer({ drawer, onClose }: { drawer: DrawerState; onClose: () => void }) {
  if (!drawer) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-sm"
      onClick={onClose}
      onKeyDown={(event) => event.key === "Escape" && onClose()}
    >
      <aside
        className="h-full w-full max-w-2xl overflow-y-auto bg-[var(--tc-surface,#fff)] p-5 shadow-[-20px_0_50px_rgba(15,23,42,0.18)]"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[0.68rem] font-black uppercase tracking-[0.22em] text-[var(--tc-accent,#ef0001)]">Drill-down</p>
            <h2 className="mt-1 text-2xl font-black tracking-[-0.04em] text-[var(--tc-text,#0b1a3c)]">{drawer.title}</h2>
            <p className="mt-2 text-sm text-[var(--tc-text-muted,#6b7280)]">{drawer.subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] p-2 text-[var(--tc-text,#0b1a3c)]"
            aria-label="Fechar detalhes"
          >
            <FiX />
          </button>
        </div>
        <div className="mt-5 space-y-3">
          {drawer.items.map((item) => (
            <div key={item.id} className="rounded-2xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${toneClass(statusTone(item.status))}`}>
                  {STATUS_LABELS[item.status] ?? item.status}
                </span>
                <span className="rounded-full border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#fff)] px-2.5 py-1 text-xs font-bold text-[var(--tc-text,#0b1a3c)]">
                  {SEVERITY_LABELS[item.severity] ?? item.severity}
                </span>
                <span className="text-xs font-semibold text-[var(--tc-text-muted,#6b7280)]">{formatDateTime(item.updatedAtIso)}</span>
              </div>
              <h3 className="mt-3 text-base font-black text-[var(--tc-text,#0b1a3c)]">{item.title}</h3>
              <p className="mt-1 text-sm text-[var(--tc-text-muted,#6b7280)]">
                {item.companyName} | {item.application} | {moduleLabel(resolveSignalModule(item))} | {item.owner || "Sem responsavel"}
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <div className="rounded-xl bg-[var(--tc-surface,#fff)] px-3 py-2 text-xs">
                  <span className="font-bold text-[var(--tc-text-muted,#6b7280)]">Run</span>
                  <p className="mt-1 font-black text-[var(--tc-text,#0b1a3c)]">{item.runCode || "-"}</p>
                </div>
                <div className="rounded-xl bg-[var(--tc-surface,#fff)] px-3 py-2 text-xs">
                  <span className="font-bold text-[var(--tc-text-muted,#6b7280)]">Defeito</span>
                  <p className="mt-1 font-black text-[var(--tc-text,#0b1a3c)]">{item.defectCode || "-"}</p>
                </div>
                <div className="rounded-xl bg-[var(--tc-surface,#fff)] px-3 py-2 text-xs">
                  <span className="font-bold text-[var(--tc-text-muted,#6b7280)]">Prioridade</span>
                  <p className="mt-1 font-black text-[var(--tc-text,#0b1a3c)]">{item.priority}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}

export default function ContextualDashboardClient() {
  const router = useRouter();
  const pathname = usePathname() || "/operacoes/dashboard";
  const { user, companies: authCompanies, normalizedUser, loading: authLoading } = useAuthUser();
  const role =
    normalizeLegacyRole(user?.permissionRole ?? null) ??
    normalizeLegacyRole(user?.role ?? null) ??
    normalizeLegacyRole(user?.companyRole ?? null);
  const privileged =
    user?.isGlobalAdmin === true ||
    (user as { is_global_admin?: boolean } | null)?.is_global_admin === true ||
    role === SYSTEM_ROLES.LEADER_TC ||
    role === SYSTEM_ROLES.TECHNICAL_SUPPORT;

  const authCompanyOptions = useMemo(
    () => normalizeCompanyOptions(authCompanies.map((company) => ({ id: company.id, slug: company.slug, name: company.name }))),
    [authCompanies],
  );

  const dashboardScope = useMemo(
    () =>
      resolveDashboardContext({
        user: user
          ? {
              ...user,
              companySlugs: normalizedUser.companySlugs,
              defaultCompanySlug: normalizedUser.defaultCompanySlug,
            }
          : null,
        companies: authCompanyOptions,
      }),
    [authCompanyOptions, normalizedUser.companySlugs, normalizedUser.defaultCompanySlug, user],
  );

  const defaultCompanySlugs = useMemo(() => {
    if (dashboardScope.scope === "company") return dashboardScope.selectedCompanySlugs;
    if (role === SYSTEM_ROLES.TESTING_COMPANY_USER) return dashboardScope.selectedCompanySlugs;
    if (privileged) return [];
    return dashboardScope.selectedCompanySlugs;
  }, [dashboardScope.scope, dashboardScope.selectedCompanySlugs, privileged, role]);

  const [draft, setDraft] = useState<ContextualDashboardFilters>({
    ...DEFAULT_CONTEXTUAL_DASHBOARD_FILTERS,
    companySlugs: defaultCompanySlugs,
  });
  const [applied, setApplied] = useState<ContextualDashboardFilters>({
    ...DEFAULT_CONTEXTUAL_DASHBOARD_FILTERS,
    companySlugs: defaultCompanySlugs,
  });
  const [signals, setSignals] = useState<DashboardSignal[]>([]);
  const [payloadCompanies, setPayloadCompanies] = useState<DashboardCompanyOption[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [drawer, setDrawer] = useState<DrawerState>(null);
  const [savedViews, setSavedViews] = useState<SavedDashboardView[]>([]);

  const companiesForUi = useMemo(() => {
    const merged = normalizeCompanyOptions([...authCompanyOptions, ...payloadCompanies]);
    return merged;
  }, [authCompanyOptions, payloadCompanies]);

  useEffect(() => {
    if (authLoading) return;
    setDraft((current) => ({ ...current, companySlugs: current.companySlugs.length ? current.companySlugs : defaultCompanySlugs }));
    setApplied((current) => ({ ...current, companySlugs: current.companySlugs.length ? current.companySlugs : defaultCompanySlugs }));
  }, [authLoading, defaultCompanySlugs]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(getStorageKey(user?.id));
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) setSavedViews(parsed.slice(0, 12));
    } catch {
      setSavedViews([]);
    }
  }, [user?.id]);

  const loadDashboard = useCallback(async () => {
    if (authLoading) return;
    if (!privileged && applied.companySlugs.length === 0) {
      setSignals([]);
      setPayloadCompanies([]);
      setWarnings([]);
      setError(null);
      setLastUpdatedAt(null);
      return;
    }

    setLoadingData(true);
    setError(null);

    try {
      const query = buildApiPeriod(applied);
      const response = await fetchApi(`/api/operacao/summary?${query.toString()}`, { cache: "no-store" });
      if (response.status === 401) {
        router.replace("/login?next=%2Foperacoes%2Fdashboard");
        return;
      }
      const payload = (await response.json().catch(() => null)) as DashboardPayload | null;
      if (!response.ok) {
        throw new Error(asString(asRecord(payload)?.message ?? asRecord(payload)?.error, "Falha ao carregar dashboard."));
      }
      setSignals(parseSignals(payload?.signals));
      setPayloadCompanies(normalizeCompanyOptions(payload?.companies ?? []));
      setWarnings(Array.isArray(payload?.warnings) ? payload.warnings.filter((item): item is string => typeof item === "string") : []);
      setLastUpdatedAt(new Date().toISOString());
    } catch (err) {
      setSignals([]);
      setPayloadCompanies([]);
      setWarnings([]);
      setError(err instanceof Error ? err.message : "Erro ao carregar dashboard.");
    } finally {
      setLoadingData(false);
    }
  }, [applied, authLoading, privileged, router]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard, refreshNonce]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = window.setInterval(() => setRefreshNonce((current) => current + 1), 60_000);
    return () => window.clearInterval(id);
  }, [autoRefresh]);

  const selectedCompanyCount = applied.companySlugs.length || (privileged ? companiesForUi.length : dashboardScope.selectedCompanySlugs.length);

  const companyScopedSignals = useMemo(() => {
    if (applied.companySlugs.length === 0) return signals;
    return signals.filter((signal) => applied.companySlugs.includes(signal.companySlug));
  }, [applied.companySlugs, signals]);

  const applicationOptions = useMemo(
    () =>
      unique(
        companyScopedSignals
          .map((signal) => signal.application)
          .filter((value) => value && value !== "N/A")
          .sort((a, b) => a.localeCompare(b, "pt-BR")),
      ),
    [companyScopedSignals],
  );

  const moduleOptions = useMemo(() => {
    const source = draft.application === "all"
      ? companyScopedSignals
      : companyScopedSignals.filter((signal) => signal.application === draft.application);
    const modules = unique(source.map((signal) => resolveSignalModule(signal))).filter((moduleName) => moduleName !== "Aplicacoes");
    return modules.length ? modules : MODULE_OPTIONS;
  }, [companyScopedSignals, draft.application]);

  const ownerOptions = useMemo(
    () => unique(companyScopedSignals.map((signal) => signal.owner || "Sem responsavel")).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [companyScopedSignals],
  );

  const statusOptions = useMemo(
    () => getContextualStatusOptions(draft.modules.length ? draft.modules : moduleOptions),
    [draft.modules, moduleOptions],
  );

  const filteredSignals = useMemo(() => filterDashboardSignals(signals, applied), [signals, applied]);
  const aggregate = useMemo<DashboardAggregate>(() => buildDashboardAggregate(filteredSignals), [filteredSignals]);
  const widgets = useMemo(
    () => composeDashboardWidgets({ filters: applied, aggregate, selectedCompanyCount }),
    [aggregate, applied, selectedCompanyCount],
  );
  const insights = useMemo(
    () => buildDashboardInsights({ aggregate, selectedCompanyCount, selectedApplication: applied.application }),
    [aggregate, applied.application, selectedCompanyCount],
  );

  const filterChips = useMemo(
    () => buildFilterChips(applied, companiesForUi, privileged),
    [applied, companiesForUi, privileged],
  );

  const contextSummary = useMemo(() => {
    const roleName = ROLE_LABELS[dashboardScope.role] ?? ROLE_LABELS[role ?? ""] ?? "Perfil";
    const visibleCount = companiesForUi.length || dashboardScope.allowedCompanySlugs.length;
    const selected = applied.companySlugs.length ? countLabel(applied.companySlugs.length, "empresa selecionada", "empresas selecionadas") : privileged ? "todas permitidas" : "sem empresa";
    return `${roleName} | ${visibleCount} empresas visiveis | ${selected} | ${periodLabel(applied)} | atualizado ${formatAgo(lastUpdatedAt)}`;
  }, [applied, companiesForUi.length, dashboardScope.allowedCompanySlugs.length, dashboardScope.role, lastUpdatedAt, privileged, role]);

  const subtitle = useMemo(() => {
    if (role === SYSTEM_ROLES.LEADER_TC) return "Visao consolidada das empresas, aplicacoes, operacoes e riscos.";
    if (role === SYSTEM_ROLES.TECHNICAL_SUPPORT) return "Visao operacional para falhas, bloqueios, riscos e itens sem responsavel.";
    if (role === SYSTEM_ROLES.TESTING_COMPANY_USER) return "Visao das empresas vinculadas ao seu perfil.";
    return "Visao institucional da sua empresa, aplicacoes e atividades recentes.";
  }, [role]);

  const mutateDraft = (patch: Partial<ContextualDashboardFilters>) => {
    setDraft((current) => ({ ...current, ...patch }));
  };

  const applyFilters = (next = draft) => {
    setApplied({ ...next });
  };

  const clearFilters = () => {
    const next = {
      ...DEFAULT_CONTEXTUAL_DASHBOARD_FILTERS,
      companySlugs: defaultCompanySlugs,
    };
    setDraft(next);
    setApplied(next);
  };

  const saveCurrentView = () => {
    const name = window.prompt("Nome da visao", `${periodLabel(applied)} - ${selectedCompaniesLabel(applied, companiesForUi, privileged)}`);
    if (!name?.trim()) return;
    const next: SavedDashboardView = {
      id: `${Date.now()}`,
      name: name.trim(),
      filters: applied,
      createdAt: new Date().toISOString(),
    };
    const updated = [next, ...savedViews.filter((view) => view.name !== next.name)].slice(0, 12);
    setSavedViews(updated);
    localStorage.setItem(getStorageKey(user?.id), JSON.stringify(updated));
  };

  const loadSavedView = (viewId: string) => {
    const view = savedViews.find((item) => item.id === viewId);
    if (!view) return;
    setDraft(view.filters);
    setApplied(view.filters);
  };

  const toggleCompany = (slug: string) => {
    if (dashboardScope.companySelectorMode === "locked") return;
    setDraft((current) => {
      const companySlugs = current.companySlugs.includes(slug)
        ? current.companySlugs.filter((item) => item !== slug)
        : [...current.companySlugs, slug];
      return { ...current, companySlugs, application: "all", modules: [], status: "all" };
    });
  };

  const setAllCompanies = () => {
    if (!privileged && dashboardScope.canSelectMultipleCompanies) {
      mutateDraft({ companySlugs: dashboardScope.allowedCompanySlugs, application: "all", modules: [], status: "all" });
      return;
    }
    if (privileged) mutateDraft({ companySlugs: [], application: "all", modules: [], status: "all" });
  };

  const toggleModule = (moduleName: DashboardModule) => {
    setDraft((current) => {
      const modules = current.modules.includes(moduleName)
        ? current.modules.filter((item) => item !== moduleName)
        : [...current.modules, moduleName];
      return { ...current, modules, status: "all" };
    });
  };

  const applyCrossFilter = (patch: Partial<ContextualDashboardFilters>) => {
    const next = { ...applied, ...patch };
    setDraft(next);
    setApplied(next);
  };

  const openDetails = (title: string, items: DashboardSignal[], subtitle = "Itens que formam o numero selecionado.") => {
    setDrawer({ title, subtitle, items });
  };

  const openSignal = (item: DashboardSignal) => {
    setDrawer({
      title: item.title,
      subtitle: `${item.companyName} | ${item.application} | ${moduleLabel(resolveSignalModule(item))}`,
      items: [item],
    });
  };

  const assistantPrompts = useMemo(() => {
    if (aggregate.risks > 0) {
      return ["O que esta mais critico?", "Priorizar acoes", "Gerar resumo executivo", "Listar itens sem responsavel"];
    }
    if (selectedCompanyCount > 1) {
      return ["Comparar empresas selecionadas", "Qual empresa esta pior?", "Gerar status para lideranca", "Explicar indicadores"];
    }
    return ["Resumir dashboard atual", "Explicar este recorte", "O que mudou nas ultimas 24h?", "Gerar mensagem para o grupo"];
  }, [aggregate.risks, selectedCompanyCount]);

  const dashboardRuntimeContext = useMemo(() => {
    return {
      route: "/operacoes/dashboard",
      screenTitle: "Dashboard",
      userRole: dashboardScope.role,
      permissions: {
        scope: dashboardScope.scope,
        canSelectCompany: dashboardScope.canSelectCompany,
        canSelectMultipleCompanies: dashboardScope.canSelectMultipleCompanies,
        canSelectAllCompanies: privileged,
      },
      visibleCompanyIds: companiesForUi.map((company) => company.slug),
      selectedCompanyIds: applied.companySlugs.length ? applied.companySlugs : privileged ? companiesForUi.map((company) => company.slug) : [],
      selectedApplications: applied.application === "all" ? [] : [applied.application],
      selectedModules: applied.modules,
      filters: applied,
      period: {
        preset: applied.periodPreset,
        from: applied.dateFrom || null,
        to: applied.dateTo || null,
        label: periodLabel(applied),
      },
      widgets: widgets.map((widget) => ({
        id: widget.id,
        title: widget.title,
        question: widget.question,
        dataCount: widget.dataCount,
      })),
      metrics: {
        total: aggregate.total,
        failed: aggregate.failed,
        blocked: aggregate.blocked,
        critical: aggregate.critical,
        pending: aggregate.pending,
        withoutOwner: aggregate.withoutOwner,
        risks: aggregate.risks,
      },
      charts: {
        companies: aggregate.companies,
        modules: aggregate.modules,
        statuses: aggregate.statuses,
        timeline: aggregate.timeline,
      },
      alerts: insights,
      criticalItems: aggregate.criticalItems.slice(0, 10),
      recentEvents: aggregate.recent.slice(0, 10),
      lastUpdatedAt,
      autoRefreshEnabled: autoRefresh,
      assistantHints: assistantPrompts,
    };
  }, [aggregate, applied, assistantPrompts, autoRefresh, companiesForUi, dashboardScope, insights, lastUpdatedAt, privileged, widgets]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const context = {
      route: pathname,
      module: "dashboard" as const,
      screenLabel: "Dashboard contextual",
      screenSummary: `Dashboard contextual da Testing Company. ${contextSummary}. Widgets ativos: ${widgets.map((widget) => widget.title).join(", ") || "sem widgets por falta de dados"}.`,
      suggestedPrompts: assistantPrompts,
      metadata: dashboardRuntimeContext,
    };

    (window as unknown as { __TC_DASHBOARD_CONTEXT__?: unknown }).__TC_DASHBOARD_CONTEXT__ = dashboardRuntimeContext;
    window.dispatchEvent(
      new CustomEvent("assistant:context", {
        detail: {
          source: "dashboard",
          route: pathname,
          context,
        },
      }),
    );
  }, [assistantPrompts, contextSummary, dashboardRuntimeContext, pathname, widgets]);

  const askAssistant = (prompt: string) => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(
      new CustomEvent("assistant:open", {
        detail: {
          source: "dashboard",
          route: pathname,
          initialMessage: prompt,
          focusInput: true,
          context: {
            route: pathname,
            module: "dashboard",
            screenLabel: "Dashboard contextual",
            screenSummary: contextSummary,
            suggestedPrompts: assistantPrompts,
            metadata: dashboardRuntimeContext,
          },
        },
      }),
    );
  };

  const hasData = aggregate.total > 0;
  const activeWidgets = new Set(widgets.map((widget) => widget.id));
  const criticalItems = aggregate.criticalItems;
  const failedItems = filteredSignals.filter((signal) => signal.status === "failed" || signal.status === "alert");
  const blockedItems = filteredSignals.filter((signal) => signal.status === "blocked");
  const withoutOwnerItems = filteredSignals.filter((signal) => isWithoutOwner(signal.owner));
  const companyUsersLocked = dashboardScope.companySelectorMode === "locked";

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(239,0,1,0.07),transparent_28%),linear-gradient(180deg,#f7f8fb_0%,#ffffff_46%,#f5f7fb_100%)] px-4 py-6 text-[var(--tc-text,#0b1a3c)] sm:px-6 lg:px-10">
      <div className="mx-auto flex max-w-384 flex-col gap-5">
        <header className="rounded-2xl border border-[var(--tc-border,#d7deea)] bg-white/90 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)] backdrop-blur lg:p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-4xl">
              <p className="inline-flex items-center gap-2 text-[0.68rem] font-black uppercase tracking-[0.24em] text-[var(--tc-accent,#ef0001)]">
                <FiCompass className="h-4 w-4" />
                Testing Company
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-[-0.05em] text-[var(--tc-text,#0b1a3c)] sm:text-4xl">Dashboard</h1>
              <p className="mt-2 text-base leading-7 text-[var(--tc-text-muted,#6b7280)]">{subtitle}</p>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-bold text-[var(--tc-text,#0b1a3c)]">
                <span className="rounded-full border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] px-3 py-1.5">{contextSummary}</span>
                <span className={`rounded-full border px-3 py-1.5 ${autoRefresh ? toneClass("positive") : toneClass("neutral")}`}>
                  Auto atualizacao {autoRefresh ? "ativa" : "pausada"}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setAutoRefresh((current) => !current)}
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--tc-border,#d7deea)] bg-white px-3 py-2 text-sm font-bold text-[var(--tc-text,#0b1a3c)] transition hover:border-[rgba(239,0,1,0.24)]"
              >
                <FiClock className="h-4 w-4" />
                {autoRefresh ? "Pausar auto" : "Ativar auto"}
              </button>
              <button
                type="button"
                onClick={() => setRefreshNonce((current) => current + 1)}
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--tc-primary,#011848)] px-3 py-2 text-sm font-bold text-white shadow-[0_14px_28px_rgba(1,24,72,0.18)] transition hover:-translate-y-0.5"
              >
                <FiRefreshCw className={`h-4 w-4 ${loadingData ? "animate-spin" : ""}`} />
                Atualizar agora
              </button>
              <button
                type="button"
                onClick={() => askAssistant("Resuma o dashboard atual e priorize as acoes mais importantes.")}
                className="inline-flex items-center gap-2 rounded-xl border border-[rgba(239,0,1,0.22)] bg-[rgba(239,0,1,0.07)] px-3 py-2 text-sm font-bold text-[var(--tc-accent,#ef0001)] transition hover:bg-[rgba(239,0,1,0.11)]"
              >
                <FiZap className="h-4 w-4" />
                Perguntar ao assistente
              </button>
            </div>
          </div>
        </header>

        <section className="rounded-2xl border border-[var(--tc-border,#d7deea)] bg-white/95 p-4 shadow-[0_14px_32px_rgba(15,23,42,0.05)]">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <p className="inline-flex items-center gap-2 text-[0.68rem] font-black uppercase tracking-[0.22em] text-[var(--tc-accent,#ef0001)]">
                  <FiSliders className="h-4 w-4" />
                  Control center
                </p>
                <h2 className="mt-1 text-xl font-black tracking-[-0.04em] text-[var(--tc-text,#0b1a3c)]">Filtros inteligentes</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {savedViews.length > 0 ? (
                  <select
                    defaultValue=""
                    onChange={(event) => {
                      if (event.target.value) loadSavedView(event.target.value);
                      event.currentTarget.value = "";
                    }}
                    className="min-h-10 rounded-xl border border-[var(--tc-border,#d7deea)] bg-white px-3 text-sm font-semibold text-[var(--tc-text,#0b1a3c)]"
                    aria-label="Carregar visao salva"
                  >
                    <option value="">Minhas visoes</option>
                    {savedViews.map((view) => (
                      <option key={view.id} value={view.id}>{view.name}</option>
                    ))}
                  </select>
                ) : null}
                <button type="button" onClick={saveCurrentView} className="inline-flex items-center gap-2 rounded-xl border border-[var(--tc-border,#d7deea)] bg-white px-3 py-2 text-sm font-bold">
                  <FiSave className="h-4 w-4" />
                  Salvar visao
                </button>
                <button type="button" onClick={clearFilters} className="rounded-xl border border-[var(--tc-border,#d7deea)] bg-white px-3 py-2 text-sm font-bold">
                  Limpar
                </button>
                <button type="button" onClick={() => applyFilters()} className="inline-flex items-center gap-2 rounded-xl bg-[var(--tc-accent,#ef0001)] px-4 py-2 text-sm font-black text-white shadow-[0_12px_24px_rgba(239,0,1,0.18)]">
                  <FiFilter className="h-4 w-4" />
                  Aplicar filtros
                </button>
              </div>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1">
              {VIEW_MODES.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setDraft((current) => applyViewModeDefaults(current, mode.id))}
                  className={`shrink-0 rounded-full border px-3 py-2 text-xs font-black uppercase tracking-[0.14em] transition ${
                    draft.viewMode === mode.id
                      ? "border-[rgba(239,0,1,0.24)] bg-[var(--tc-accent,#ef0001)] text-white"
                      : "border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] text-[var(--tc-text,#0b1a3c)]"
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(17rem,1.1fr)_minmax(0,2fr)]">
              <div className="rounded-2xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-xs font-black uppercase tracking-[0.18em] text-[var(--tc-text-muted,#6b7280)]">Empresas</span>
                  {privileged || dashboardScope.canSelectMultipleCompanies ? (
                    <button type="button" onClick={setAllCompanies} className="text-xs font-black text-[var(--tc-accent,#ef0001)]">
                      Todas
                    </button>
                  ) : null}
                </div>
                <div className="max-h-60 space-y-2 overflow-y-auto pr-1">
                  {companiesForUi.map((company) => {
                    const active = draft.companySlugs.length === 0 ? privileged : draft.companySlugs.includes(company.slug);
                    return (
                      <button
                        key={company.slug}
                        type="button"
                        onClick={() => toggleCompany(company.slug)}
                        disabled={companyUsersLocked}
                        className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left text-sm font-bold transition disabled:cursor-not-allowed ${
                          active
                            ? "border-[rgba(239,0,1,0.22)] bg-white text-[var(--tc-accent,#ef0001)]"
                            : "border-transparent bg-transparent text-[var(--tc-text,#0b1a3c)] hover:bg-white"
                        }`}
                      >
                        <span className="truncate">{company.name}</span>
                        {active ? <FiCheckCircle className="h-4 w-4 shrink-0" /> : null}
                      </button>
                    );
                  })}
                  {!companiesForUi.length ? (
                    <p className="px-2 py-3 text-sm text-[var(--tc-text-muted,#6b7280)]">Nenhuma empresa disponivel para este perfil.</p>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-3 lg:grid-cols-4">
                <label className="grid gap-1 text-sm lg:col-span-2">
                  <span className="text-xs font-black uppercase tracking-[0.16em] text-[var(--tc-text-muted,#6b7280)]">Aplicacao</span>
                  <select
                    value={draft.application}
                    onChange={(event) => mutateDraft({ application: event.target.value, modules: [], status: "all" })}
                    className="min-h-11 rounded-xl border border-[var(--tc-border,#d7deea)] bg-white px-3 font-semibold"
                  >
                    <option value="all">Todas as aplicacoes compativeis</option>
                    {applicationOptions.map((application) => (
                      <option key={application} value={application}>{application}</option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-1 text-sm">
                  <span className="text-xs font-black uppercase tracking-[0.16em] text-[var(--tc-text-muted,#6b7280)]">Periodo</span>
                  <select
                    value={draft.periodPreset}
                    onChange={(event) => mutateDraft({ periodPreset: event.target.value as DashboardPeriodPreset })}
                    className="min-h-11 rounded-xl border border-[var(--tc-border,#d7deea)] bg-white px-3 font-semibold"
                  >
                    {PERIOD_OPTIONS.map((period) => (
                      <option key={period.id} value={period.id}>{period.label}</option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-1 text-sm">
                  <span className="text-xs font-black uppercase tracking-[0.16em] text-[var(--tc-text-muted,#6b7280)]">Status</span>
                  <select
                    value={draft.status}
                    onChange={(event) => mutateDraft({ status: event.target.value as ContextualDashboardFilters["status"] })}
                    className="min-h-11 rounded-xl border border-[var(--tc-border,#d7deea)] bg-white px-3 font-semibold"
                  >
                    <option value="all">Todos</option>
                    {statusOptions.map((status) => (
                      <option key={status} value={status}>{STATUS_LABELS[status]}</option>
                    ))}
                  </select>
                </label>

                <div className="lg:col-span-4">
                  <span className="text-xs font-black uppercase tracking-[0.16em] text-[var(--tc-text-muted,#6b7280)]">Modulos</span>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {moduleOptions.map((moduleName) => (
                      <button
                        key={moduleName}
                        type="button"
                        onClick={() => toggleModule(moduleName)}
                        className={`rounded-full border px-3 py-2 text-xs font-black uppercase tracking-[0.12em] transition ${
                          draft.modules.includes(moduleName)
                            ? "border-[rgba(1,24,72,0.18)] bg-[var(--tc-primary,#011848)] text-white"
                            : "border-[var(--tc-border,#d7deea)] bg-white text-[var(--tc-text,#0b1a3c)]"
                        }`}
                      >
                        {moduleLabel(moduleName)}
                      </button>
                    ))}
                  </div>
                </div>

                {draft.periodPreset === "custom" ? (
                  <>
                    <label className="grid gap-1 text-sm">
                      <span className="text-xs font-black uppercase tracking-[0.16em] text-[var(--tc-text-muted,#6b7280)]">Data inicial</span>
                      <input type="date" value={draft.dateFrom} onChange={(event) => mutateDraft({ dateFrom: event.target.value })} className="min-h-11 rounded-xl border border-[var(--tc-border,#d7deea)] bg-white px-3 font-semibold" />
                    </label>
                    <label className="grid gap-1 text-sm">
                      <span className="text-xs font-black uppercase tracking-[0.16em] text-[var(--tc-text-muted,#6b7280)]">Data final</span>
                      <input type="date" value={draft.dateTo} onChange={(event) => mutateDraft({ dateTo: event.target.value })} className="min-h-11 rounded-xl border border-[var(--tc-border,#d7deea)] bg-white px-3 font-semibold" />
                    </label>
                  </>
                ) : null}

                <label className="grid gap-1 text-sm">
                  <span className="text-xs font-black uppercase tracking-[0.16em] text-[var(--tc-text-muted,#6b7280)]">Responsavel</span>
                  <select value={draft.owner} onChange={(event) => mutateDraft({ owner: event.target.value })} className="min-h-11 rounded-xl border border-[var(--tc-border,#d7deea)] bg-white px-3 font-semibold">
                    <option value="all">Todos</option>
                    {ownerOptions.map((owner) => <option key={owner} value={owner}>{owner}</option>)}
                  </select>
                </label>

                <label className="grid gap-1 text-sm">
                  <span className="text-xs font-black uppercase tracking-[0.16em] text-[var(--tc-text-muted,#6b7280)]">Severidade</span>
                  <select value={draft.severity} onChange={(event) => mutateDraft({ severity: event.target.value as ContextualDashboardFilters["severity"] })} className="min-h-11 rounded-xl border border-[var(--tc-border,#d7deea)] bg-white px-3 font-semibold">
                    <option value="all">Todas</option>
                    {(Object.keys(SEVERITY_LABELS) as DashboardSignalSeverity[]).map((severity) => <option key={severity} value={severity}>{SEVERITY_LABELS[severity]}</option>)}
                  </select>
                </label>

                <label className="grid gap-1 text-sm">
                  <span className="text-xs font-black uppercase tracking-[0.16em] text-[var(--tc-text-muted,#6b7280)]">Prioridade</span>
                  <select value={draft.priority} onChange={(event) => mutateDraft({ priority: event.target.value as ContextualDashboardFilters["priority"] })} className="min-h-11 rounded-xl border border-[var(--tc-border,#d7deea)] bg-white px-3 font-semibold">
                    <option value="all">Todas</option>
                    {(Object.keys(PRIORITY_LABELS) as DashboardSignalPriority[]).map((priority) => <option key={priority} value={priority}>{PRIORITY_LABELS[priority]}</option>)}
                  </select>
                </label>

                <label className="grid gap-1 text-sm lg:col-span-2">
                  <span className="text-xs font-black uppercase tracking-[0.16em] text-[var(--tc-text-muted,#6b7280)]">Busca contextual</span>
                  <span className="relative">
                    <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--tc-text-muted,#6b7280)]" />
                    <input value={draft.search} onChange={(event) => mutateDraft({ search: event.target.value })} className="min-h-11 w-full rounded-xl border border-[var(--tc-border,#d7deea)] bg-white pl-9 pr-3 font-semibold" placeholder="Empresa, run, defeito, responsavel" />
                  </span>
                </label>

                <div className="flex flex-wrap gap-2 lg:col-span-4">
                  {[
                    ["onlyCritical", "Itens criticos"],
                    ["onlyFailed", "Somente falhas"],
                    ["onlyBlocked", "Bloqueados"],
                    ["onlyPending", "Pendentes"],
                    ["onlyWithoutOwner", "Sem responsavel"],
                    ["recentlyChanged", "Alterados 24h"],
                  ].map(([key, label]) => {
                    const active = Boolean(draft[key as keyof ContextualDashboardFilters]);
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => mutateDraft({ [key]: !active } as Partial<ContextualDashboardFilters>)}
                        className={`rounded-full border px-3 py-2 text-xs font-black uppercase tracking-[0.12em] transition ${
                          active ? "border-[rgba(239,0,1,0.24)] bg-[rgba(239,0,1,0.09)] text-[var(--tc-accent,#ef0001)]" : "border-[var(--tc-border,#d7deea)] bg-white text-[var(--tc-text,#0b1a3c)]"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {filterChips.map((chip) => (
                <span key={chip} className="rounded-full border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] px-3 py-1.5 text-xs font-bold text-[var(--tc-text,#0b1a3c)]">
                  {chip}
                </span>
              ))}
            </div>
          </div>
        </section>

        {warnings.length > 0 ? (
          <div className="rounded-2xl border border-[rgba(245,158,11,0.24)] bg-[rgba(245,158,11,0.08)] px-4 py-3 text-sm font-semibold text-[#8a4b02]">
            {warnings.slice(0, 2).join(" | ")}
          </div>
        ) : null}

        {authLoading || loadingData ? (
          <SkeletonDashboard />
        ) : error ? (
          <EmptyState
            title="Nao foi possivel carregar o dashboard."
            detail={error}
            actions={<button type="button" onClick={() => setRefreshNonce((current) => current + 1)} className="rounded-xl bg-[var(--tc-primary,#011848)] px-4 py-2 text-sm font-bold text-white">Tentar novamente</button>}
          />
        ) : !hasData ? (
          <EmptyState
            title="Nenhum dado encontrado para os filtros selecionados."
            detail="Ajuste periodo, empresa, modulo ou filtros muito restritivos. Nenhum bloco vazio foi renderizado."
            actions={
              <>
                <button type="button" onClick={clearFilters} className="rounded-xl border border-[var(--tc-border,#d7deea)] bg-white px-4 py-2 text-sm font-bold">Limpar filtros</button>
                <button type="button" onClick={() => mutateDraft({ periodPreset: "30d" })} className="rounded-xl bg-[var(--tc-primary,#011848)] px-4 py-2 text-sm font-bold text-white">Usar 30 dias</button>
                <button type="button" onClick={() => askAssistant("Nao encontrei dados neste dashboard. Quais filtros devo ajustar?")} className="rounded-xl border border-[rgba(239,0,1,0.22)] bg-[rgba(239,0,1,0.07)] px-4 py-2 text-sm font-bold text-[var(--tc-accent,#ef0001)]">Perguntar ao assistente</button>
              </>
            }
          />
        ) : (
          <>
            <InsightStrip insights={insights} />

            {activeWidgets.has("summary") ? (
              <section>
                <ScrollReveal className="grid gap-3 md:grid-cols-2 xl:grid-cols-5" stagger={0.07} deps={[aggregate.total]}>
                  <MetricButton label="Sinais no recorte" value={aggregate.total} detail="Total renderizado com filtros ativos." tone="neutral" onClick={() => openDetails("Sinais no recorte", filteredSignals)} />
                  <MetricButton label="Riscos" value={aggregate.risks} detail="Falhas, bloqueios, criticos ou sem responsavel." tone={aggregate.risks > 0 ? "critical" : "positive"} onClick={() => openDetails("Itens de risco", criticalItems)} />
                  <MetricButton label="Falhas" value={aggregate.failed} detail="Itens com status falha ou alerta." tone={aggregate.failed > 0 ? "critical" : "positive"} onClick={() => openDetails("Falhas do periodo", failedItems)} />
                  <MetricButton label="Bloqueados" value={aggregate.blocked} detail="Itens impedindo continuidade operacional." tone={aggregate.blocked > 0 ? "warning" : "positive"} onClick={() => openDetails("Bloqueios do periodo", blockedItems)} />
                  <MetricButton label="Sem responsavel" value={aggregate.withoutOwner} detail="Itens sem dono claro para acao." tone={aggregate.withoutOwner > 0 ? "warning" : "positive"} onClick={() => openDetails("Itens sem responsavel", withoutOwnerItems)} />
                </ScrollReveal>
              </section>
            ) : null}

            <section className="grid gap-4 xl:grid-cols-2">
              {activeWidgets.has("company_comparison") ? (
                <WidgetShell widget={{ title: "Comparativo de empresas", question: "Quais empresas pedem atencao?", reason: "Aparece porque o recorte tem multiplas empresas." }}>
                  <BucketBars buckets={aggregate.companies} onSelect={(bucket) => applyCrossFilter({ companySlugs: [bucket.key], application: "all", modules: [], status: "all" })} />
                </WidgetShell>
              ) : null}

              {activeWidgets.has("company_health") ? (
                <WidgetShell widget={{ title: "Saude institucional", question: "Como esta esta empresa?", reason: "Aparece porque o recorte esta focado em uma empresa." }}>
                  <ScrollReveal className="grid gap-3 sm:grid-cols-3" stagger={0.07} deps={[aggregate.pending, aggregate.resolved]}>
                    <MetricButton label="Pendentes" value={aggregate.pending} detail="Itens novos ou em andamento." tone={aggregate.pending > 0 ? "warning" : "positive"} />
                    <MetricButton label="Resolvidos" value={aggregate.resolved} detail="Itens encerrados no recorte." tone="positive" />
                    <MetricButton label="Modulos ativos" value={aggregate.modules.length} detail="Modulos com dado real." tone="neutral" />
                  </ScrollReveal>
                </WidgetShell>
              ) : null}

              {activeWidgets.has("application_health") ? (
                <WidgetShell widget={{ title: "Aplicacoes no recorte", question: "Quais aplicacoes concentram sinais?", reason: "Aparece porque ha aplicacoes reais nos dados." }}>
                  <BucketBars buckets={aggregate.applications} onSelect={(bucket) => applyCrossFilter({ application: bucket.key, modules: [], status: "all" })} />
                </WidgetShell>
              ) : null}

              {activeWidgets.has("module_distribution") ? (
                <WidgetShell widget={{ title: "Distribuicao por modulo", question: "Onde esta a concentracao?", reason: "Aparece porque ha modulos com dados no recorte." }}>
                  <BucketBars buckets={aggregate.modules} onSelect={(bucket) => applyCrossFilter({ modules: [normalizeDashboardModule(bucket.key)], status: "all" })} />
                </WidgetShell>
              ) : null}

              {activeWidgets.has("status_distribution") ? (
                <WidgetShell widget={{ title: "Distribuicao por status", question: "Qual status domina?", reason: "Status muda conforme o modulo selecionado." }}>
                  <BucketBars buckets={aggregate.statuses.map((bucket) => ({ ...bucket, label: STATUS_LABELS[bucket.key as DashboardSignalStatus] ?? bucket.label }))} onSelect={(bucket) => applyCrossFilter({ status: bucket.key as DashboardSignalStatus })} />
                </WidgetShell>
              ) : null}

              {activeWidgets.has("timeline") ? (
                <WidgetShell widget={{ title: "Evolucao no periodo", question: "Quando os sinais apareceram?", reason: "Aparece porque existe serie temporal real no recorte." }}>
                  <TimelineBars buckets={aggregate.timeline} />
                </WidgetShell>
              ) : null}
            </section>

            {activeWidgets.has("company_comparison") ? (
              <WidgetShell widget={{ title: "Mapa de calor por empresa e modulo", question: "Onde esta o risco cruzado?", reason: "Empresas e modulos sao cruzados somente quando existe dado real." }}>
                <Heatmap signals={filteredSignals} companies={aggregate.companies} onSelect={(companySlug, moduleName) => applyCrossFilter({ companySlugs: [companySlug], modules: [moduleName], status: "all" })} />
              </WidgetShell>
            ) : null}

            {activeWidgets.has("risk_ranking") ? (
              <WidgetShell
                widget={{ title: "Ranking de risco", question: "Onde agir primeiro?", reason: "Aparece porque ha falhas, bloqueios, criticos ou itens sem responsavel." }}
                action={<button type="button" onClick={() => askAssistant("Quais acoes devo priorizar neste ranking de risco?")} className="rounded-xl border border-[rgba(239,0,1,0.22)] bg-[rgba(239,0,1,0.07)] px-3 py-2 text-xs font-black text-[var(--tc-accent,#ef0001)]">Priorizar com assistente</button>}
              >
                <SignalList items={criticalItems} onOpen={openSignal} />
              </WidgetShell>
            ) : null}

            <section className="grid gap-4 xl:grid-cols-2">
              {activeWidgets.has("runs") ? (
                <WidgetShell widget={{ title: "Runs", question: "Quais execucoes exigem leitura?", reason: "Aparece porque existem runs no recorte." }}>
                  <SignalList items={filteredSignals.filter((signal) => resolveSignalModule(signal) === "Runs")} onOpen={openSignal} limit={6} />
                </WidgetShell>
              ) : null}

              {activeWidgets.has("defects") ? (
                <WidgetShell widget={{ title: "Defeitos", question: "Quais defeitos exigem triagem?", reason: "Aparece porque existem defeitos no recorte." }}>
                  <SignalList items={filteredSignals.filter((signal) => resolveSignalModule(signal) === "Defeitos")} onOpen={openSignal} limit={6} />
                </WidgetShell>
              ) : null}

              {activeWidgets.has("automations") ? (
                <WidgetShell widget={{ title: "Automacoes", question: "Quais automacoes falharam?", reason: "Aparece porque ha automacoes com dado real." }}>
                  <SignalList items={filteredSignals.filter((signal) => resolveSignalModule(signal) === "Automacoes")} onOpen={openSignal} limit={6} />
                </WidgetShell>
              ) : null}

              {activeWidgets.has("integrations") ? (
                <WidgetShell widget={{ title: "Integracoes", question: "Quais integracoes estao em alerta?", reason: "Aparece porque ha integracoes no recorte." }}>
                  <SignalList items={filteredSignals.filter((signal) => resolveSignalModule(signal) === "Integracoes")} onOpen={openSignal} limit={6} />
                </WidgetShell>
              ) : null}
            </section>

            {activeWidgets.has("details") ? (
              <WidgetShell
                widget={{ title: "Eventos recentes", question: "O que aconteceu por ultimo?", reason: "Camada de detalhe sempre acompanha o dashboard montado." }}
                action={<button type="button" onClick={() => askAssistant("Gere um resumo para enviar no grupo com base nos eventos recentes deste dashboard.")} className="rounded-xl bg-[var(--tc-primary,#011848)] px-3 py-2 text-xs font-black text-white">Gerar resumo</button>}
              >
                <SignalList items={aggregate.recent} onOpen={openSignal} limit={10} />
              </WidgetShell>
            ) : null}
          </>
        )}
      </div>

      <DashboardDrawer drawer={drawer} onClose={() => setDrawer(null)} />
    </div>
  );
}

