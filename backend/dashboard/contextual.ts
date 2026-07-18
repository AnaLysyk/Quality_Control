export type DashboardSignalType = "run" | "defect" | "automation" | "integration";

export type DashboardSignalStatus =
  | "new"
  | "analyzing"
  | "in_progress"
  | "blocked"
  | "resolved"
  | "failed"
  | "alert";

export type DashboardSignalSeverity = "critical" | "high" | "medium" | "low";
export type DashboardSignalPriority = "P0" | "P1" | "P2" | "P3";

export type DashboardPeriodPreset = "24h" | "7d" | "30d" | "this_month" | "previous_month" | "custom";
export type DashboardViewMode = "overview" | "companies" | "applications" | "runs" | "defects" | "risks" | "activity";

export type DashboardModule = "Aplicacoes" | "Runs" | "Defeitos" | "Automacoes" | "Integracoes";

export type DashboardSignal = {
  id: string;
  type: DashboardSignalType;
  title: string;
  companySlug: string;
  companyName: string;
  application: string;
  module: string;
  status: DashboardSignalStatus;
  owner: string;
  severity: DashboardSignalSeverity;
  priority: DashboardSignalPriority;
  runCode: string;
  defectCode: string;
  updatedAtIso: string;
  passRate?: number;
  failCount?: number;
  durationMin?: number;
};

export type DashboardCompanyOption = {
  slug: string;
  name: string;
};

export type ContextualDashboardFilters = {
  viewMode: DashboardViewMode;
  companySlugs: string[];
  application: string;
  modules: DashboardModule[];
  status: DashboardSignalStatus | "all";
  owner: string;
  severity: DashboardSignalSeverity | "all";
  priority: DashboardSignalPriority | "all";
  periodPreset: DashboardPeriodPreset;
  dateFrom: string;
  dateTo: string;
  search: string;
  onlyCritical: boolean;
  onlyFailed: boolean;
  onlyBlocked: boolean;
  onlyPending: boolean;
  onlyWithoutOwner: boolean;
  recentlyChanged: boolean;
};

export type DashboardBucket = {
  key: string;
  label: string;
  count: number;
  riskCount: number;
};

export type DashboardAggregate = {
  total: number;
  failed: number;
  blocked: number;
  critical: number;
  pending: number;
  withoutOwner: number;
  risks: number;
  resolved: number;
  companies: DashboardBucket[];
  applications: DashboardBucket[];
  modules: DashboardBucket[];
  statuses: DashboardBucket[];
  severities: DashboardBucket[];
  priorities: DashboardBucket[];
  owners: DashboardBucket[];
  timeline: DashboardBucket[];
  recent: DashboardSignal[];
  criticalItems: DashboardSignal[];
};

export type DashboardWidgetKind =
  | "summary"
  | "company_comparison"
  | "company_health"
  | "application_health"
  | "module_distribution"
  | "status_distribution"
  | "risk_ranking"
  | "timeline"
  | "runs"
  | "defects"
  | "automations"
  | "integrations"
  | "details";

export type DashboardWidgetDefinition = {
  id: DashboardWidgetKind;
  title: string;
  question: string;
  reason: string;
  visible: boolean;
  dataCount: number;
};

export type DashboardInsight = {
  id: string;
  title: string;
  detail: string;
  tone: "critical" | "warning" | "positive" | "neutral";
};

const MODULE_BY_SIGNAL_TYPE: Record<DashboardSignalType, DashboardModule> = {
  run: "Runs",
  defect: "Defeitos",
  automation: "Automacoes",
  integration: "Integracoes",
};

export const DEFAULT_CONTEXTUAL_DASHBOARD_FILTERS: ContextualDashboardFilters = {
  viewMode: "overview",
  companySlugs: [],
  application: "all",
  modules: [],
  status: "all",
  owner: "all",
  severity: "all",
  priority: "all",
  periodPreset: "7d",
  dateFrom: "",
  dateTo: "",
  search: "",
  onlyCritical: false,
  onlyFailed: false,
  onlyBlocked: false,
  onlyPending: false,
  onlyWithoutOwner: false,
  recentlyChanged: false,
};

export function normalizeDashboardText(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function normalizeDashboardModule(value: unknown): DashboardModule {
  const normalized = normalizeDashboardText(value);
  if (normalized.includes("run")) return "Runs";
  if (normalized.includes("defeit") || normalized.includes("defect")) return "Defeitos";
  if (normalized.includes("automat")) return "Automacoes";
  if (normalized.includes("integr")) return "Integracoes";
  return "Aplicacoes";
}

export function resolveSignalModule(signal: Pick<DashboardSignal, "type" | "module">): DashboardModule {
  const fromModule = normalizeDashboardModule(signal.module);
  if (fromModule !== "Aplicacoes") return fromModule;
  return MODULE_BY_SIGNAL_TYPE[signal.type] ?? "Aplicacoes";
}

export function isWithoutOwner(owner: string) {
  const value = normalizeDashboardText(owner);
  return !value || value.includes("sem respons") || value === "na" || value === "n/a";
}

export function isRiskSignal(signal: Pick<DashboardSignal, "status" | "severity" | "priority" | "owner">) {
  return (
    signal.status === "failed" ||
    signal.status === "blocked" ||
    signal.status === "alert" ||
    signal.severity === "critical" ||
    signal.priority === "P0" ||
    isWithoutOwner(signal.owner)
  );
}

function parseDate(value: string, boundary: "start" | "end") {
  if (!value) return null;
  const date = new Date(`${value}T${boundary === "start" ? "00:00:00" : "23:59:59"}`);
  const time = date.getTime();
  return Number.isFinite(time) ? time : null;
}

export function getPeriodBounds(filters: Pick<ContextualDashboardFilters, "periodPreset" | "dateFrom" | "dateTo">, now = new Date()) {
  const end = now.getTime();
  if (filters.periodPreset === "24h") return { from: end - 24 * 60 * 60 * 1000, to: end };
  if (filters.periodPreset === "7d") return { from: end - 7 * 24 * 60 * 60 * 1000, to: end };
  if (filters.periodPreset === "30d") return { from: end - 30 * 24 * 60 * 60 * 1000, to: end };
  if (filters.periodPreset === "this_month") {
    return { from: new Date(now.getFullYear(), now.getMonth(), 1).getTime(), to: end };
  }
  if (filters.periodPreset === "previous_month") {
    return {
      from: new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime(),
      to: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999).getTime(),
    };
  }
  return {
    from: parseDate(filters.dateFrom, "start"),
    to: parseDate(filters.dateTo, "end") ?? end,
  };
}

export function isSignalInsidePeriod(signal: Pick<DashboardSignal, "updatedAtIso">, filters: Pick<ContextualDashboardFilters, "periodPreset" | "dateFrom" | "dateTo">) {
  const bounds = getPeriodBounds(filters);
  const time = Date.parse(signal.updatedAtIso);
  if (!Number.isFinite(time)) return false;
  if (bounds.from != null && time < bounds.from) return false;
  if (bounds.to != null && time > bounds.to) return false;
  return true;
}

export function filterDashboardSignals(signals: DashboardSignal[], filters: ContextualDashboardFilters) {
  const moduleSet = new Set(filters.modules);
  const search = normalizeDashboardText(filters.search);

  return signals.filter((signal) => {
    if (filters.companySlugs.length > 0 && !filters.companySlugs.includes(signal.companySlug)) return false;
    if (filters.application !== "all" && signal.application !== filters.application) return false;

    const moduleName = resolveSignalModule(signal);
    if (moduleSet.size > 0 && !moduleSet.has(moduleName)) return false;

    if (filters.status !== "all" && signal.status !== filters.status) return false;
    if (filters.owner !== "all" && signal.owner !== filters.owner) return false;
    if (filters.severity !== "all" && signal.severity !== filters.severity) return false;
    if (filters.priority !== "all" && signal.priority !== filters.priority) return false;
    if (filters.onlyCritical && signal.severity !== "critical" && signal.priority !== "P0") return false;
    if (filters.onlyFailed && signal.status !== "failed" && signal.status !== "alert") return false;
    if (filters.onlyBlocked && signal.status !== "blocked") return false;
    if (filters.onlyPending && !["new", "analyzing", "in_progress"].includes(signal.status)) return false;
    if (filters.onlyWithoutOwner && !isWithoutOwner(signal.owner)) return false;
    if (filters.recentlyChanged) {
      const updatedAt = Date.parse(signal.updatedAtIso);
      if (!Number.isFinite(updatedAt) || Date.now() - updatedAt > 24 * 60 * 60 * 1000) return false;
    }
    if (!isSignalInsidePeriod(signal, filters)) return false;

    if (search) {
      const haystack = normalizeDashboardText([
        signal.title,
        signal.companyName,
        signal.application,
        signal.module,
        signal.owner,
        signal.runCode,
        signal.defectCode,
      ].join(" "));
      if (!haystack.includes(search)) return false;
    }

    return true;
  });
}

function makeBucket(key: string, label = key): DashboardBucket {
  return { key, label, count: 0, riskCount: 0 };
}

function increment(map: Map<string, DashboardBucket>, key: string, label: string, risky: boolean) {
  const bucket = map.get(key) ?? makeBucket(key, label);
  bucket.count += 1;
  if (risky) bucket.riskCount += 1;
  map.set(key, bucket);
}

function sortBuckets(values: DashboardBucket[]) {
  return values.sort((a, b) => b.count - a.count || b.riskCount - a.riskCount || a.label.localeCompare(b.label, "pt-BR"));
}

function timelineKey(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return { key: "sem-data", label: "Sem data" };
  const key = date.toISOString().slice(0, 10);
  const label = date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  return { key, label };
}

export function buildDashboardAggregate(signals: DashboardSignal[]): DashboardAggregate {
  const companies = new Map<string, DashboardBucket>();
  const applications = new Map<string, DashboardBucket>();
  const modules = new Map<string, DashboardBucket>();
  const statuses = new Map<string, DashboardBucket>();
  const severities = new Map<string, DashboardBucket>();
  const priorities = new Map<string, DashboardBucket>();
  const owners = new Map<string, DashboardBucket>();
  const timeline = new Map<string, DashboardBucket>();

  let failed = 0;
  let blocked = 0;
  let critical = 0;
  let pending = 0;
  let withoutOwner = 0;
  let resolved = 0;

  for (const signal of signals) {
    const risky = isRiskSignal(signal);
    const moduleName = resolveSignalModule(signal);
    const time = timelineKey(signal.updatedAtIso);

    if (signal.status === "failed" || signal.status === "alert") failed += 1;
    if (signal.status === "blocked") blocked += 1;
    if (signal.severity === "critical" || signal.priority === "P0") critical += 1;
    if (["new", "analyzing", "in_progress"].includes(signal.status)) pending += 1;
    if (signal.status === "resolved") resolved += 1;
    if (isWithoutOwner(signal.owner)) withoutOwner += 1;

    increment(companies, signal.companySlug, signal.companyName || signal.companySlug, risky);
    increment(applications, signal.application || "N/A", signal.application || "N/A", risky);
    increment(modules, moduleName, moduleName, risky);
    increment(statuses, signal.status, signal.status, risky);
    increment(severities, signal.severity, signal.severity, risky);
    increment(priorities, signal.priority, signal.priority, risky);
    increment(owners, signal.owner || "Sem responsavel", signal.owner || "Sem responsavel", risky);
    increment(timeline, time.key, time.label, risky);
  }

  const sortedRecent = [...signals].sort((a, b) => Date.parse(b.updatedAtIso) - Date.parse(a.updatedAtIso));
  const criticalItems = sortedRecent.filter((signal) => isRiskSignal(signal));

  return {
    total: signals.length,
    failed,
    blocked,
    critical,
    pending,
    withoutOwner,
    risks: criticalItems.length,
    resolved,
    companies: sortBuckets(Array.from(companies.values())),
    applications: sortBuckets(Array.from(applications.values())),
    modules: sortBuckets(Array.from(modules.values())),
    statuses: sortBuckets(Array.from(statuses.values())),
    severities: sortBuckets(Array.from(severities.values())),
    priorities: sortBuckets(Array.from(priorities.values())),
    owners: sortBuckets(Array.from(owners.values())),
    timeline: Array.from(timeline.values()).sort((a, b) => a.key.localeCompare(b.key)),
    recent: sortedRecent.slice(0, 12),
    criticalItems: criticalItems.slice(0, 20),
  };
}

export function composeDashboardWidgets(input: {
  filters: ContextualDashboardFilters;
  aggregate: DashboardAggregate;
  selectedCompanyCount: number;
}) {
  const { filters, aggregate, selectedCompanyCount } = input;
  const modules = new Set(filters.modules);
  const hasModule = (moduleName: DashboardModule) => modules.size === 0 || modules.has(moduleName);
  const widgets: DashboardWidgetDefinition[] = [
    {
      id: "summary",
      title: "Resumo executivo",
      question: "O que este recorte diz agora?",
      reason: "Existe dado real para sintetizar o contexto aplicado.",
      visible: aggregate.total > 0,
      dataCount: aggregate.total,
    },
    {
      id: "company_comparison",
      title: "Comparativo de empresas",
      question: "Quais empresas precisam de atencao primeiro?",
      reason: "Mais de uma empresa esta selecionada no filtro atual.",
      visible: selectedCompanyCount > 1 && aggregate.companies.length > 1,
      dataCount: aggregate.companies.length,
    },
    {
      id: "company_health",
      title: "Saude institucional",
      question: "Como esta a empresa selecionada?",
      reason: "O contexto esta focado em uma unica empresa.",
      visible: selectedCompanyCount === 1 && aggregate.total > 0,
      dataCount: aggregate.total,
    },
    {
      id: "application_health",
      title: "Aplicacoes no recorte",
      question: "Quais aplicacoes concentram atividade ou risco?",
      reason: "Ha aplicacoes reais nos dados retornados.",
      visible: aggregate.applications.length > 0,
      dataCount: aggregate.applications.length,
    },
    {
      id: "module_distribution",
      title: "Distribuicao por modulo",
      question: "Qual modulo concentra ocorrencias?",
      reason: "O recorte possui mais de um modulo ou modo de visao geral.",
      visible: aggregate.modules.length > 1 || filters.viewMode === "overview",
      dataCount: aggregate.modules.length,
    },
    {
      id: "status_distribution",
      title: "Distribuicao por status",
      question: "Como os itens se distribuem por status contextual?",
      reason: "Ha status reais para comparar no recorte.",
      visible: aggregate.statuses.length > 1,
      dataCount: aggregate.statuses.length,
    },
    {
      id: "risk_ranking",
      title: "Ranking de risco",
      question: "Onde agir primeiro?",
      reason: "O recorte contem falhas, bloqueios, criticos ou itens sem responsavel.",
      visible: aggregate.risks > 0,
      dataCount: aggregate.risks,
    },
    {
      id: "timeline",
      title: "Evolucao no periodo",
      question: "Quando os sinais apareceram?",
      reason: "Ha eventos distribuidos no periodo selecionado.",
      visible: aggregate.timeline.length > 1,
      dataCount: aggregate.timeline.length,
    },
    {
      id: "runs",
      title: "Runs",
      question: "Quais execucoes estao falhando, bloqueadas ou pendentes?",
      reason: "O modulo Runs esta no contexto e possui dados.",
      visible: hasModule("Runs") && aggregate.modules.some((item) => item.key === "Runs"),
      dataCount: aggregate.modules.find((item) => item.key === "Runs")?.count ?? 0,
    },
    {
      id: "defects",
      title: "Defeitos",
      question: "Quais defeitos exigem triagem?",
      reason: "O modulo Defeitos esta no contexto e possui dados.",
      visible: hasModule("Defeitos") && aggregate.modules.some((item) => item.key === "Defeitos"),
      dataCount: aggregate.modules.find((item) => item.key === "Defeitos")?.count ?? 0,
    },
    {
      id: "automations",
      title: "Automacoes",
      question: "Quais automacoes possuem alerta ou falha?",
      reason: "O modulo Automacoes esta no contexto e possui dados.",
      visible: hasModule("Automacoes") && aggregate.modules.some((item) => item.key === "Automacoes"),
      dataCount: aggregate.modules.find((item) => item.key === "Automacoes")?.count ?? 0,
    },
    {
      id: "integrations",
      title: "Integracoes",
      question: "Quais integracoes pedem atencao?",
      reason: "O modulo Integracoes esta no contexto e possui dados.",
      visible: hasModule("Integracoes") && aggregate.modules.some((item) => item.key === "Integracoes"),
      dataCount: aggregate.modules.find((item) => item.key === "Integracoes")?.count ?? 0,
    },
    {
      id: "details",
      title: "Detalhes do recorte",
      question: "Quais itens formam este resultado?",
      reason: "Todo numero importante precisa permitir drill-down.",
      visible: aggregate.total > 0,
      dataCount: aggregate.total,
    },
  ];

  return widgets.filter((widget) => widget.visible && widget.dataCount > 0);
}

export function buildDashboardInsights(input: {
  aggregate: DashboardAggregate;
  selectedCompanyCount: number;
  selectedApplication?: string;
}) {
  const { aggregate, selectedCompanyCount, selectedApplication } = input;
  const insights: DashboardInsight[] = [];
  const topCompany = aggregate.companies[0];
  const topModule = aggregate.modules[0];
  const topOwner = aggregate.owners.find((owner) => isWithoutOwner(owner.label));

  if (aggregate.total === 0) return insights;

  if (aggregate.critical > 0) {
    insights.push({
      id: "critical",
      title: `${aggregate.critical} item(ns) criticos no recorte`,
      detail: "Priorize sinais P0 ou severidade critica antes de itens informativos.",
      tone: "critical",
    });
  }

  if (aggregate.blocked > 0) {
    insights.push({
      id: "blocked",
      title: `${aggregate.blocked} bloqueio(s) ativo(s)`,
      detail: "Bloqueios tendem a atrasar fechamento de runs, defeitos e automacoes.",
      tone: "warning",
    });
  }

  if (aggregate.withoutOwner > 0) {
    insights.push({
      id: "without-owner",
      title: `${aggregate.withoutOwner} item(ns) sem responsavel`,
      detail: "Itens sem dono devem virar primeira acao operacional.",
      tone: "warning",
    });
  }

  if (selectedCompanyCount > 1 && topCompany && topCompany.riskCount > 0) {
    insights.push({
      id: "top-company",
      title: `${topCompany.label} concentra o maior risco`,
      detail: `${topCompany.riskCount} de ${topCompany.count} sinal(is) dessa empresa pedem atencao.`,
      tone: "critical",
    });
  }

  if (topModule && topModule.riskCount > 0) {
    insights.push({
      id: "top-module",
      title: `${topModule.label} e o modulo mais sensivel`,
      detail: `${topModule.riskCount} sinal(is) de risco aparecem nesse modulo.`,
      tone: "warning",
    });
  }

  if (selectedApplication && selectedApplication !== "all") {
    insights.push({
      id: "application",
      title: `Analise focada em ${selectedApplication}`,
      detail: "Os widgets abaixo foram reduzidos para a aplicacao selecionada.",
      tone: "neutral",
    });
  }

  if (aggregate.failed === 0 && aggregate.blocked === 0 && aggregate.critical === 0) {
    insights.push({
      id: "stable",
      title: "Nenhum bloqueio critico neste recorte",
      detail: "Acompanhe tendencia e eventos recentes para confirmar estabilidade.",
      tone: "positive",
    });
  }

  if (topOwner && topOwner.count > 0) {
    insights.push({
      id: "owner-risk",
      title: "Ha itens sem dono na fila",
      detail: "Use o filtro 'sem responsavel' para transformar esse grupo em acao.",
      tone: "warning",
    });
  }

  return insights.slice(0, 4);
}

export function getContextualStatusOptions(modules: DashboardModule[]): DashboardSignalStatus[] {
  const selected = new Set(modules);
  if (selected.has("Runs")) return ["in_progress", "failed", "blocked", "resolved", "new", "analyzing"];
  if (selected.has("Defeitos")) return ["new", "analyzing", "in_progress", "blocked", "alert", "resolved"];
  if (selected.has("Automacoes")) return ["new", "in_progress", "failed", "alert", "resolved"];
  if (selected.has("Integracoes")) return ["in_progress", "failed", "alert", "resolved"];
  return ["new", "analyzing", "in_progress", "blocked", "failed", "alert", "resolved"];
}

