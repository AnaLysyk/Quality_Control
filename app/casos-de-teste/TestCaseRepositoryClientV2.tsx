"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  FiArchive,
  FiCheckCircle,
  FiChevronRight,
  FiClipboard,
  FiCode,
  FiEdit2,
  FiFileText,
  FiFilter,
  FiFolder,
  FiGitBranch,
  FiLayers,
  FiPlus,
  FiRefreshCcw,
  FiSearch,
  FiShield,
  FiUploadCloud,
  FiX,
} from "react-icons/fi";
import { fetchApi } from "@/lib/api";
import { useClientContext } from "@/context/ClientContext";
import { useProjectContext } from "@/lib/core/project/ProjectContext";
import TestCaseRepositoryImportExportPanel from "./TestCaseRepositoryImportExportPanel";

type TestCaseStep = {
  id?: string;
  order?: number;
  action: string;
  expectedResult: string;
  data?: string | null;
  notes?: string | null;
};

type TestCaseRecord = {
  testCase: {
    id: string;
    key: string;
    title: string;
    description?: string | null;
    objective?: string | null;
    preconditions?: string | null;
    postconditions?: string | null;
    source: string;
    type: string;
    status: string;
    priority: string;
    severity?: string | null;
    companyId?: string | null;
    projectId?: string | null;
    applicationId?: string | null;
    moduleId?: string | null;
    testProjectCode?: string | null;
    testProjectName?: string | null;
    suiteId?: string | null;
    suiteName?: string | null;
    tags: string[];
    automationStatus: string;
    lastExecutionStatus?: string | null;
    lastExecutedAt?: string | null;
    createdBy?: string | null;
    createdAt: string;
    updatedAt: string;
  };
  steps: TestCaseStep[];
  automationLink?: {
    id: string;
    provider?: string | null;
    repository?: string | null;
    branch?: string | null;
    specFile?: string | null;
    testTitle?: string | null;
    playwrightProject?: string | null;
    tags?: string[];
    command?: string | null;
    status?: string | null;
    lastStatus?: string | null;
    lastExecutedAt?: string | null;
    lastErrorMessage?: string | null;
  } | null;
};

type ApiResponse = {
  items: TestCaseRecord[];
  total: number;
  metrics?: {
    total: number;
    manual: number;
    automated: number;
    hybrid: number;
    withoutAutomation: number;
    automationCoverage: number;
    neverExecuted: number;
    brokenAutomation: number;
  };
};

type DraftStep = {
  action: string;
  expectedResult: string;
  data: string;
  notes: string;
};

type CaseForm = {
  title: string;
  type: "manual" | "automated" | "hybrid";
  priority: "low" | "medium" | "high" | "critical";
  status: "draft" | "active" | "review" | "obsolete" | "archived";
  automationStatus: "none" | "planned" | "pending" | "review" | "approved" | "linked" | "stable" | "broken" | "disabled";
  automationTool: "none" | "playwright" | "postman" | "api";
  suiteName: string;
  applicationId: string;
  moduleId: string;
  tags: string;
  description: string;
  objective: string;
  preconditions: string;
  postconditions: string;
  automationSpecFile: string;
  automationTestTitle: string;
  automationProject: string;
  automationTags: string;
  automationCommand: string;
  steps: DraftStep[];
};

type TestCaseRepositoryClientV2Props = {
  initialCompanySlug?: string;
  lockCompanyScope?: boolean;
};

const EMPTY_STEP: DraftStep = { action: "", expectedResult: "", data: "", notes: "" };

const EMPTY_FORM: CaseForm = {
  title: "",
  type: "manual",
  priority: "medium",
  status: "active",
  automationStatus: "none",
  automationTool: "none",
  suiteName: "",
  applicationId: "",
  moduleId: "",
  tags: "",
  description: "",
  objective: "",
  preconditions: "",
  postconditions: "",
  automationSpecFile: "",
  automationTestTitle: "",
  automationProject: "chromium",
  automationTags: "",
  automationCommand: "",
  steps: [{ ...EMPTY_STEP }],
};

const TYPE_LABEL: Record<string, string> = {
  manual: "Manual",
  automated: "Automatizado",
  hybrid: "Híbrido",
};

const AUTOMATION_LABEL: Record<string, string> = {
  none: "Sem automação",
  planned: "Automatizável",
  pending: "Pendente",
  ai_generated: "Draft IA",
  review: "Em revisão",
  approved: "Aprovado",
  linked: "Vinculado",
  published: "Publicado",
  running: "Em execução",
  stable: "Estável",
  broken: "Quebrado",
  disabled: "Desativado",
};

const PRIORITY_LABEL: Record<string, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  critical: "Crítica",
};

const EXECUTION_LABEL: Record<string, string> = {
  passed: "Aprovado",
  failed: "Falhou",
  blocked: "Bloqueado",
  skipped: "Ignorado",
  invalid: "Inválido",
  not_run: "Não executado",
};

const AUTOMATION_WORKFLOW_STATUSES = new Set(["planned", "pending", "review", "approved", "linked", "stable", "broken"]);

function normalizeCompanySlug(value?: string | null) {
  return value?.trim().toLowerCase() || "all";
}

function formatDate(value?: string | null) {
  if (!value) return "--";
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "--";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(timestamp);
}

function splitTags(value: string) {
  return Array.from(new Set(value.split(/[,\s]+/).map((item) => item.trim()).filter(Boolean)));
}

function getProjectLabel(activeProject: unknown) {
  const project = (activeProject ?? {}) as Record<string, unknown>;
  return String(project.name ?? project.slug ?? project.id ?? "Projeto não selecionado");
}

function getProjectId(activeProject: unknown) {
  const project = (activeProject ?? {}) as Record<string, unknown>;
  return typeof project.id === "string" ? project.id : null;
}

function getProjectCode(activeProject: unknown) {
  const project = (activeProject ?? {}) as Record<string, unknown>;
  const value = project.qaseProjectCode ?? project.code ?? project.slug;
  return typeof value === "string" ? value : null;
}

function getProjectName(activeProject: unknown) {
  const project = (activeProject ?? {}) as Record<string, unknown>;
  return typeof project.name === "string" ? project.name : null;
}

function getAutomationTool(record: TestCaseRecord) {
  if (record.automationLink?.specFile) return "Playwright";
  const tags = record.testCase.tags.join(" ").toLowerCase();
  if (tags.includes("postman")) return "Postman/API";
  if (tags.includes("api")) return "API";
  if (record.testCase.automationStatus !== "none") return "A definir";
  return "—";
}

function isAutomationCandidate(record: TestCaseRecord) {
  return AUTOMATION_WORKFLOW_STATUSES.has(record.testCase.automationStatus);
}

export default function TestCaseRepositoryClientV2({
  initialCompanySlug,
  lockCompanyScope = false,
}: TestCaseRepositoryClientV2Props) {
  const { activeClientSlug } = useClientContext();
  const { activeProject } = useProjectContext();
  const projectId = getProjectId(activeProject);
  const projectCode = getProjectCode(activeProject);
  const projectName = getProjectName(activeProject);
  const projectLabel = getProjectLabel(activeProject);
  const companySlug = lockCompanyScope ? normalizeCompanySlug(initialCompanySlug) : normalizeCompanySlug(activeClientSlug ?? initialCompanySlug);

  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [automationFilter, setAutomationFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [suiteFilter, setSuiteFilter] = useState("all");
  const [items, setItems] = useState<TestCaseRecord[]>([]);
  const [metrics, setMetrics] = useState<ApiResponse["metrics"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedBulkIds, setSelectedBulkIds] = useState<string[]>([]);
  const [detailTab, setDetailTab] = useState<"case" | "steps" | "automation" | "runs" | "history">("case");
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [form, setForm] = useState<CaseForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const contextKey = `${companySlug}:${projectId ?? "no-project"}`;

  const resetFilters = useCallback(() => {
    setQuery("");
    setTypeFilter("all");
    setAutomationFilter("all");
    setPriorityFilter("all");
    setSuiteFilter("all");
    setSelectedId(null);
    setSelectedBulkIds([]);
    setDetailTab("case");
  }, []);

  useEffect(() => {
    resetFilters();
  }, [contextKey, resetFilters]);

  const loadCases = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ includeIntegrated: "true" });
    if (companySlug !== "all") params.set("companySlug", companySlug);
    if (projectId) params.set("projectId", projectId);
    if (query.trim()) params.set("query", query.trim());
    if (typeFilter !== "all") params.set("type", typeFilter);
    if (automationFilter !== "all") params.set("automationStatus", automationFilter);
    if (priorityFilter !== "all") params.set("priority", priorityFilter);
    if (suiteFilter !== "all") params.set("suiteId", suiteFilter);

    try {
      const response = await fetchApi(`/api/test-cases?${params.toString()}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Não foi possível carregar os casos.");
      const payload = (await response.json()) as ApiResponse;
      setItems(payload.items ?? []);
      setMetrics(payload.metrics ?? null);
      setSelectedId((current) => current ?? payload.items?.[0]?.testCase.id ?? null);
    } catch {
      setItems([]);
      setMetrics(null);
    } finally {
      setLoading(false);
    }
  }, [automationFilter, companySlug, priorityFilter, projectId, query, suiteFilter, typeFilter]);

  useEffect(() => {
    void loadCases();
  }, [loadCases]);

  const selected = useMemo(
    () => items.find((item) => item.testCase.id === selectedId) ?? items[0] ?? null,
    [items, selectedId],
  );

  const suiteOptions = useMemo(() => {
    const values = new Map<string, string>();
    for (const item of items) {
      const id = item.testCase.suiteId || item.testCase.suiteName;
      if (id) values.set(id, item.testCase.suiteName || id);
    }
    return Array.from(values.entries()).sort((left, right) => left[1].localeCompare(right[1]));
  }, [items]);

  const summary = useMemo(() => {
    const total = metrics?.total ?? items.length;
    const manual = metrics?.manual ?? items.filter((item) => item.testCase.type === "manual").length;
    const automated = metrics?.automated ?? items.filter((item) => item.testCase.type === "automated").length;
    const candidates = items.filter(isAutomationCandidate).length;
    const coverage = metrics?.automationCoverage ?? (total ? Math.round((automated / total) * 100) : 0);
    return { total, manual, automated, candidates, coverage };
  }, [items, metrics]);

  function openCreateForm(defaultAutomation = false) {
    setForm({
      ...EMPTY_FORM,
      type: defaultAutomation ? "hybrid" : "manual",
      automationStatus: defaultAutomation ? "planned" : "none",
      automationTool: defaultAutomation ? "playwright" : "none",
      tags: defaultAutomation ? "automatizavel" : "",
      steps: [{ ...EMPTY_STEP }],
    });
    setFormError(null);
    setFormOpen(true);
  }

  function updateStep(index: number, field: keyof DraftStep, value: string) {
    setForm((current) => ({
      ...current,
      steps: current.steps.map((step, stepIndex) => (stepIndex === index ? { ...step, [field]: value } : step)),
    }));
  }

  async function patchCase(id: string, payload: Record<string, unknown>) {
    const response = await fetchApi(`/api/test-cases/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error("Não foi possível atualizar o caso.");
    return (await response.json()) as TestCaseRecord;
  }

  async function markAsAutomatable(record: TestCaseRecord) {
    const updated = await patchCase(record.testCase.id, {
      type: record.testCase.type === "manual" ? "hybrid" : record.testCase.type,
      automationStatus: "planned",
      tags: Array.from(new Set([...(record.testCase.tags ?? []), "automatizavel"])),
    });
    setItems((current) => current.map((item) => (item.testCase.id === updated.testCase.id ? updated : item)));
  }

  async function handleArchive(record: TestCaseRecord | null) {
    if (!record) return;
    const confirmed = window.confirm(`Arquivar ${record.testCase.key} - ${record.testCase.title}?`);
    if (!confirmed) return;
    const response = await fetchApi(`/api/test-cases/${encodeURIComponent(record.testCase.id)}`, { method: "DELETE" });
    if (response.ok) await loadCases();
  }

  async function handleSave() {
    setSaving(true);
    setFormError(null);

    const steps = form.steps
      .map((step) => ({
        action: step.action.trim(),
        expectedResult: step.expectedResult.trim(),
        data: step.data.trim() || undefined,
        notes: step.notes.trim() || undefined,
      }))
      .filter((step) => step.action && step.expectedResult);

    const tags = splitTags(form.tags);
    if (form.automationTool !== "none") tags.push(form.automationTool === "postman" ? "postman" : form.automationTool);

    if (!form.title.trim()) {
      setFormError("Título é obrigatório.");
      setSaving(false);
      return;
    }

    try {
      const createResponse = await fetchApi("/api/test-cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim() || undefined,
          objective: form.objective.trim() || undefined,
          preconditions: form.preconditions.trim() || undefined,
          postconditions: form.postconditions.trim() || undefined,
          source: "manual",
          type: form.type,
          status: form.status,
          priority: form.priority,
          companySlug: companySlug !== "all" ? companySlug : undefined,
          companyId: companySlug !== "all" ? companySlug : undefined,
          projectId: projectId ?? undefined,
          testProjectCode: projectCode ?? undefined,
          testProjectName: projectName ?? undefined,
          suiteName: form.suiteName.trim() || undefined,
          applicationId: form.applicationId.trim() || undefined,
          moduleId: form.moduleId.trim() || undefined,
          tags: Array.from(new Set(tags)),
          steps,
        }),
      });

      if (!createResponse.ok) {
        const payloadError = await createResponse.json().catch(() => null);
        throw new Error(payloadError?.message || "Não foi possível criar o caso.");
      }

      let saved = (await createResponse.json()) as TestCaseRecord;
      if (form.automationStatus !== "none" || form.type !== "manual") {
        saved = await patchCase(saved.testCase.id, {
          type: form.type,
          automationStatus: form.automationStatus,
          tags: Array.from(new Set(tags)),
        });
      }

      if (form.automationTool === "playwright" && form.automationSpecFile.trim()) {
        await fetchApi(`/api/test-cases/${encodeURIComponent(saved.testCase.id)}/automation`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            specFile: form.automationSpecFile.trim(),
            testTitle: form.automationTestTitle.trim() || form.title.trim(),
            playwrightProject: form.automationProject.trim() || "chromium",
            tags: splitTags(form.automationTags),
            command: form.automationCommand.trim() || undefined,
            status: "pending",
          }),
        });
      }

      setFormOpen(false);
      await loadCases();
      setSelectedId(saved.testCase.id);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Falha ao salvar caso.");
    } finally {
      setSaving(false);
    }
  }

  const emptyByProject = !loading && items.length === 0 && !query && typeFilter === "all" && automationFilter === "all" && priorityFilter === "all" && suiteFilter === "all";

  return (
    <section data-testid="test-case-repository" className="flex min-h-[calc(100vh-7rem)] w-full min-w-0 flex-col gap-3 rounded-[24px] border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#ffffff)] p-3 text-[var(--tc-text,#0b1a3c)] shadow-sm">
      <header data-testid="test-case-header" className="rounded-2xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--tc-text-muted,#6b7280)]">
              Empresa › {companySlug === "all" ? "Todas" : companySlug} › Projeto › {projectLabel}
            </p>
            <h1 className="mt-1 text-2xl font-black tracking-[-0.04em] text-[var(--tc-text,#0b1a3c)]">Repositório de Casos de Teste</h1>
            <p className="mt-1 text-sm text-[var(--tc-text-secondary,#4b5563)]">
              Repositório único do projeto. Automação é vínculo/status; execução fica nas telas de Execuções e Automação.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setImportOpen((current) => !current)}
              className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#ffffff)] px-3 text-xs font-bold text-[var(--tc-text,#0b1a3c)]"
            >
              <FiUploadCloud className="h-4 w-4" />
              Importar
            </button>
            <Link
              href="/automacoes/casos"
              className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#ffffff)] px-3 text-xs font-bold text-[var(--tc-text,#0b1a3c)]"
            >
              <FiCode className="h-4 w-4" />
              Ver automação
            </Link>
            <button
              type="button"
              data-testid="test-case-new-button"
              onClick={() => openCreateForm(false)}
              className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-[var(--tc-accent,#ef0001)] px-4 text-xs font-black text-white"
            >
              <FiPlus className="h-4 w-4" />
              Novo caso
            </button>
          </div>
        </div>
      </header>

      {importOpen ? (
        <div className="rounded-2xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] p-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-sm font-black">Importação e exportação</p>
            <button type="button" onClick={() => setImportOpen(false)} className="rounded-full border border-[var(--tc-border,#d7deea)] px-3 py-1 text-xs font-bold">
              Fechar
            </button>
          </div>
          <TestCaseRepositoryImportExportPanel initialCompanySlug={companySlug !== "all" ? companySlug : null} />
        </div>
      ) : null}

      <div data-testid="test-case-metrics-bar" className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryChip label="Total" value={summary.total} icon={<FiClipboard />} />
        <SummaryChip label="Manuais" value={summary.manual} icon={<FiFileText />} />
        <SummaryChip label="Automatizados" value={summary.automated} icon={<FiCode />} />
        <SummaryChip label="Automatizáveis" value={summary.candidates} icon={<FiGitBranch />} />
        <SummaryChip label="Cobertura" value={`${summary.coverage}%`} icon={<FiCheckCircle />} />
      </div>

      <article className="rounded-2xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] p-3">
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[minmax(260px,1fr)_160px_180px_160px_180px_auto]">
          <label className="grid gap-1 text-xs font-semibold">
            Buscar
            <span className="relative">
              <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--tc-text-muted,#6b7280)]" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Código, título, tag ou suite" className="min-h-9 w-full rounded-lg border border-[var(--tc-border,#d7deea)] bg-[var(--tc-input-bg,#ffffff)] pr-3 pl-9 text-xs outline-none focus:border-[var(--tc-accent,#ef0001)]" />
            </span>
          </label>
          <Select label="Tipo" value={typeFilter} onChange={setTypeFilter} options={[["all", "Todos"], ["manual", "Manual"], ["automated", "Automatizado"], ["hybrid", "Híbrido"]]} />
          <Select label="Automação" value={automationFilter} onChange={setAutomationFilter} options={[["all", "Todas"], ["none", "Sem automação"], ["planned", "Automatizável"], ["review", "Em revisão"], ["linked", "Vinculado"], ["stable", "Estável"], ["broken", "Quebrado"]]} />
          <Select label="Prioridade" value={priorityFilter} onChange={setPriorityFilter} options={[["all", "Todas"], ["low", "Baixa"], ["medium", "Média"], ["high", "Alta"], ["critical", "Crítica"]]} />
          <Select label="Suite/Pasta" value={suiteFilter} onChange={setSuiteFilter} options={[["all", "Todas"], ...suiteOptions]} />
          <button type="button" onClick={resetFilters} className="min-h-9 self-end rounded-lg border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#ffffff)] px-3 text-xs font-bold">
            Limpar
          </button>
        </div>
      </article>

      {emptyByProject ? (
        <div className="grid flex-1 place-items-center rounded-2xl border border-dashed border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] px-6 py-16 text-center">
          <div className="max-w-md">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgba(239,0,1,0.10)] text-[var(--tc-accent,#ef0001)]"><FiClipboard className="h-6 w-6" /></div>
            <h2 className="mt-4 text-xl font-black">Nenhum caso criado neste projeto ainda</h2>
            <p className="mt-2 text-sm text-[var(--tc-text-secondary,#4b5563)]">Comece criando o primeiro caso manual ou marque um cenário como automatizável para aparecer na fila de automação.</p>
            <button type="button" onClick={() => openCreateForm(false)} className="mt-5 rounded-xl bg-[var(--tc-accent,#ef0001)] px-4 py-2 text-sm font-black text-white">
              Criar primeiro caso
            </button>
          </div>
        </div>
      ) : (
        <div className="grid flex-1 items-start gap-3 xl:grid-cols-[280px_minmax(520px,1fr)_380px] 2xl:grid-cols-[320px_minmax(0,1fr)_440px]">
          <aside data-testid="test-case-suite-tree" className="max-h-[calc(100vh-17rem)] overflow-auto rounded-2xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#ffffff)] p-3 xl:sticky xl:top-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--tc-text-muted,#6b7280)]">Suites / Pastas</p>
                <p className="mt-1 text-xs text-[var(--tc-text-secondary,#4b5563)]">{items.length} caso(s) no filtro</p>
              </div>
              <FiFolder className="h-4 w-4 text-[var(--tc-accent,#ef0001)]" />
            </div>
            <div className="mt-3 space-y-1">
              <SuiteButton active={suiteFilter === "all"} label="Todas as suites" count={items.length} onClick={() => setSuiteFilter("all")} />
              {suiteOptions.map(([id, label]) => (
                <SuiteButton key={id} active={suiteFilter === id} label={label} count={items.filter((item) => (item.testCase.suiteId || item.testCase.suiteName) === id).length} onClick={() => setSuiteFilter(id)} />
              ))}
            </div>
          </aside>

          <article data-testid="test-case-table" className="min-h-[520px] overflow-hidden rounded-2xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#ffffff)]">
            <div className="flex min-h-12 items-center justify-between gap-2 border-b border-[var(--tc-border,#d7deea)] px-3 py-2">
              <div>
                <h2 className="text-sm font-black">Casos de teste ({items.length})</h2>
                <p className="text-xs text-[var(--tc-text-secondary,#4b5563)]">{selectedBulkIds.length ? `${selectedBulkIds.length} selecionado(s)` : "Selecione um caso para ver detalhes."}</p>
              </div>
              {loading ? <FiRefreshCcw className="h-4 w-4 animate-spin text-[var(--tc-text-muted,#6b7280)]" /> : <FiFilter className="h-4 w-4 text-[var(--tc-text-muted,#6b7280)]" />}
            </div>
            <div data-testid="test-case-list" className="max-h-[calc(100vh-20rem)] min-h-[460px] overflow-auto">
              {items.length === 0 ? (
                <div className="m-3 rounded-2xl border border-dashed border-[var(--tc-border,#d7deea)] px-4 py-8 text-center text-sm text-[var(--tc-text-muted,#6b7280)]">Nenhum caso encontrado para os filtros atuais.</div>
              ) : (
                <table className="w-full min-w-[820px] border-separate border-spacing-0 text-left text-xs">
                  <thead className="sticky top-0 z-10 bg-[var(--tc-surface-2,#f8fafc)] text-[10px] uppercase tracking-[0.14em] text-[var(--tc-text-muted,#6b7280)]">
                    <tr>
                      <th className="w-9 border-b border-[var(--tc-border,#d7deea)] px-3 py-2"></th>
                      <th className="border-b border-[var(--tc-border,#d7deea)] px-3 py-2">Código</th>
                      <th className="min-w-64 border-b border-[var(--tc-border,#d7deea)] px-3 py-2">Título</th>
                      <th className="border-b border-[var(--tc-border,#d7deea)] px-3 py-2">Tipo</th>
                      <th className="border-b border-[var(--tc-border,#d7deea)] px-3 py-2">Automação</th>
                      <th className="border-b border-[var(--tc-border,#d7deea)] px-3 py-2">Prioridade</th>
                      <th className="border-b border-[var(--tc-border,#d7deea)] px-3 py-2">Último run</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((record) => {
                      const active = selected?.testCase.id === record.testCase.id;
                      return (
                        <tr key={record.testCase.id} data-testid="test-case-row" onClick={() => setSelectedId(record.testCase.id)} className={`cursor-pointer transition ${active ? "bg-[rgba(239,0,1,0.08)] shadow-[inset_3px_0_0_var(--tc-accent,#ef0001)]" : "hover:bg-[var(--tc-surface-2,#f8fafc)]"}`}>
                          <td className="border-b border-[var(--tc-border,#d7deea)] px-3 py-2 align-top"><input type="checkbox" checked={selectedBulkIds.includes(record.testCase.id)} onChange={(event) => { event.stopPropagation(); setSelectedBulkIds((current) => event.target.checked ? [...current, record.testCase.id] : current.filter((id) => id !== record.testCase.id)); }} /></td>
                          <td className="whitespace-nowrap border-b border-[var(--tc-border,#d7deea)] px-3 py-2 align-top font-black"><span data-testid="test-case-key">{record.testCase.key}</span></td>
                          <td className="border-b border-[var(--tc-border,#d7deea)] px-3 py-2 align-top"><span data-testid="test-case-card" className="block max-w-[28rem] truncate font-bold">{record.testCase.title}</span><span className="mt-0.5 block truncate text-[11px] text-[var(--tc-text-muted,#6b7280)]">{record.testCase.suiteName || record.testCase.moduleId || "Sem suite"}</span></td>
                          <td className="whitespace-nowrap border-b border-[var(--tc-border,#d7deea)] px-3 py-2 align-top"><Badge>{TYPE_LABEL[record.testCase.type] ?? record.testCase.type}</Badge></td>
                          <td className="whitespace-nowrap border-b border-[var(--tc-border,#d7deea)] px-3 py-2 align-top"><Badge>{AUTOMATION_LABEL[record.testCase.automationStatus] ?? record.testCase.automationStatus}</Badge><span className="ml-1 text-[11px] text-[var(--tc-text-muted,#6b7280)]">{getAutomationTool(record)}</span></td>
                          <td className="whitespace-nowrap border-b border-[var(--tc-border,#d7deea)] px-3 py-2 align-top">{PRIORITY_LABEL[record.testCase.priority] ?? record.testCase.priority}</td>
                          <td className="whitespace-nowrap border-b border-[var(--tc-border,#d7deea)] px-3 py-2 align-top">{record.testCase.lastExecutionStatus ? EXECUTION_LABEL[record.testCase.lastExecutionStatus] ?? record.testCase.lastExecutionStatus : "Nunca"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </article>

          <aside data-testid="test-case-detail-panel" className="max-h-[calc(100vh-17rem)] overflow-auto rounded-2xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#ffffff)] p-4 xl:sticky xl:top-3">
            {selected ? (
              <div data-testid="test-case-detail">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--tc-accent,#ef0001)]">{selected.testCase.key}</p>
                    <h2 data-testid="test-case-detail-title" className="mt-1 text-lg font-black tracking-[-0.02em]">{selected.testCase.title}</h2>
                    <p className="mt-2 text-sm leading-5 text-[var(--tc-text-secondary,#4b5563)]">{selected.testCase.description || "Sem descrição detalhada."}</p>
                  </div>
                  <div className="flex gap-1">
                    <button type="button" onClick={() => setFormOpen(true)} className="rounded-lg border border-[var(--tc-border,#d7deea)] p-2"><FiEdit2 /></button>
                    <button type="button" onClick={() => void handleArchive(selected)} className="rounded-lg border border-[var(--tc-border,#d7deea)] p-2"><FiArchive /></button>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2"><Badge>{TYPE_LABEL[selected.testCase.type] ?? selected.testCase.type}</Badge><Badge>{PRIORITY_LABEL[selected.testCase.priority] ?? selected.testCase.priority}</Badge><Badge>{AUTOMATION_LABEL[selected.testCase.automationStatus] ?? selected.testCase.automationStatus}</Badge></div>

                <div className="mt-4 flex flex-wrap gap-1 border-b border-[var(--tc-border,#d7deea)]">
                  {["case", "steps", "automation", "runs", "history"].map((tab) => (
                    <button key={tab} type="button" onClick={() => setDetailTab(tab as typeof detailTab)} className={`px-3 py-2 text-xs font-black ${detailTab === tab ? "border-b-2 border-[var(--tc-accent,#ef0001)] text-[var(--tc-accent,#ef0001)]" : "text-[var(--tc-text-muted,#6b7280)]"}`}>{tab === "case" ? "Caso" : tab === "steps" ? "Passos" : tab === "automation" ? "Automação" : tab === "runs" ? "Runs" : "Histórico"}</button>
                  ))}
                </div>

                {detailTab === "case" ? <DetailSection selected={selected} /> : null}
                {detailTab === "steps" ? <StepsSection steps={selected.steps} /> : null}
                {detailTab === "automation" ? (
                  <section className="mt-4 space-y-3 text-sm">
                    {selected.testCase.automationStatus === "none" ? (
                      <button type="button" onClick={() => void markAsAutomatable(selected)} className="w-full rounded-xl border border-[var(--tc-accent,#ef0001)] bg-[rgba(239,0,1,0.08)] px-3 py-2 text-sm font-black text-[var(--tc-accent,#ef0001)]">Marcar como automatizável</button>
                    ) : null}
                    <div className="rounded-xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] p-3">
                      <p><strong>Status:</strong> {AUTOMATION_LABEL[selected.testCase.automationStatus] ?? selected.testCase.automationStatus}</p>
                      <p className="mt-1"><strong>Ferramenta:</strong> {getAutomationTool(selected)}</p>
                      <p className="mt-1"><strong>Spec:</strong> {selected.automationLink?.specFile || "Ainda não vinculado"}</p>
                      <p className="mt-1"><strong>Command:</strong> {selected.automationLink?.command || "Referência não informada"}</p>
                    </div>
                    <Link href={`/automacoes/casos?testCaseId=${encodeURIComponent(selected.testCase.id)}`} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--tc-primary,#011848)] px-3 py-2 text-sm font-black text-white"><FiCode /> Abrir na automação</Link>
                  </section>
                ) : null}
                {detailTab === "runs" ? <RunsSection selected={selected} /> : null}
                {detailTab === "history" ? <HistorySection selected={selected} /> : null}
              </div>
            ) : (
              <p className="text-sm text-[var(--tc-text-muted,#6b7280)]">Selecione um caso para visualizar detalhes.</p>
            )}
          </aside>
        </div>
      )}

      {formOpen ? (
        <CreateCaseModal
          form={form}
          saving={saving}
          error={formError}
          onClose={() => setFormOpen(false)}
          onSave={() => void handleSave()}
          onChange={setForm}
          onStepChange={updateStep}
        />
      ) : null}
    </section>
  );
}

function SummaryChip({ label, value, icon }: { label: string; value: number | string; icon: ReactNode }) {
  return <div className="rounded-xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#ffffff)] px-3 py-2"><div className="flex items-center justify-between gap-2"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--tc-text-muted,#6b7280)]">{label}</p><span className="text-[var(--tc-accent,#ef0001)]">{icon}</span></div><p className="mt-1 text-xl font-black tracking-[-0.03em]">{value}</p></div>;
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<[string, string]> }) {
  return <label className="grid gap-1 text-xs font-semibold">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="min-h-9 rounded-lg border border-[var(--tc-border,#d7deea)] bg-[var(--tc-input-bg,#ffffff)] px-3 text-xs outline-none focus:border-[var(--tc-accent,#ef0001)]">{options.map(([optionValue, labelValue]) => <option key={optionValue} value={optionValue}>{labelValue}</option>)}</select></label>;
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex rounded-full border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] px-2.5 py-1 text-[11px] font-black">{children}</span>;
}

function SuiteButton({ active, label, count, onClick }: { active: boolean; label: string; count: number; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-xs font-bold ${active ? "bg-[rgba(239,0,1,0.10)] text-[var(--tc-accent,#ef0001)]" : "hover:bg-[var(--tc-surface-2,#f8fafc)]"}`}><span className="truncate">{label}</span><span className="rounded-full bg-[var(--tc-surface-2,#f8fafc)] px-2 py-0.5 text-[10px]">{count}</span></button>;
}

function DetailSection({ selected }: { selected: TestCaseRecord }) {
  return <section className="mt-4 space-y-3 text-sm"><p><strong>Objetivo:</strong> {selected.testCase.objective || "Não informado"}</p><p><strong>Pré-condições:</strong> {selected.testCase.preconditions || "Não informado"}</p><p><strong>Pós-condições:</strong> {selected.testCase.postconditions || "Não informado"}</p><p><strong>Tags:</strong> {selected.testCase.tags.length ? selected.testCase.tags.join(", ") : "Sem tags"}</p></section>;
}

function StepsSection({ steps }: { steps: TestCaseStep[] }) {
  return <section className="mt-4 space-y-2">{steps.length ? steps.map((step, index) => <div key={`${index}-${step.action}`} className="rounded-xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] p-3 text-sm"><p className="text-[11px] font-black uppercase text-[var(--tc-accent,#ef0001)]">Passo {index + 1}</p><p className="mt-2"><strong>Ação:</strong> {step.action}</p><p className="mt-1"><strong>Esperado:</strong> {step.expectedResult}</p></div>) : <p className="text-sm text-[var(--tc-text-muted,#6b7280)]">Sem passos cadastrados.</p>}</section>;
}

function RunsSection({ selected }: { selected: TestCaseRecord }) {
  return <section className="mt-4 rounded-xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] p-3 text-sm"><p><strong>Último resultado:</strong> {selected.testCase.lastExecutionStatus ? EXECUTION_LABEL[selected.testCase.lastExecutionStatus] ?? selected.testCase.lastExecutionStatus : "Nunca executado"}</p><p className="mt-1"><strong>Data:</strong> {formatDate(selected.testCase.lastExecutedAt)}</p><p className="mt-1 text-[var(--tc-text-muted,#6b7280)]">Execuções devem ser iniciadas nas telas de Execuções ou Automação.</p></section>;
}

function HistorySection({ selected }: { selected: TestCaseRecord }) {
  return <section className="mt-4 rounded-xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] p-3 text-sm"><p>Criado em {formatDate(selected.testCase.createdAt)}.</p><p className="mt-1">Atualizado em {formatDate(selected.testCase.updatedAt)}.</p></section>;
}

function CreateCaseModal({ form, saving, error, onClose, onSave, onChange, onStepChange }: { form: CaseForm; saving: boolean; error: string | null; onClose: () => void; onSave: () => void; onChange: React.Dispatch<React.SetStateAction<CaseForm>>; onStepChange: (index: number, field: keyof DraftStep, value: string) => void }) {
  const showAutomation = form.type !== "manual" || form.automationStatus !== "none" || form.automationTool !== "none";
  return <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-slate-950/60 p-4 backdrop-blur-sm"><div data-testid="test-case-create-modal" className="w-full max-w-5xl rounded-3xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#ffffff)] p-5 shadow-2xl"><div className="flex items-start justify-between gap-3"><div><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--tc-accent,#ef0001)]">Novo caso</p><h2 className="mt-1 text-2xl font-black">Criar caso de teste</h2><p className="mt-1 text-sm text-[var(--tc-text-secondary,#4b5563)]">Cadastre o caso funcional. Automação é opcional e não executa por aqui.</p></div><button type="button" onClick={onClose} className="rounded-xl border border-[var(--tc-border,#d7deea)] p-2"><FiX /></button></div>
    <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr]">
      <section className="rounded-2xl border border-[var(--tc-border,#d7deea)] p-4"><h3 className="text-sm font-black">Geral</h3><div className="mt-3 grid gap-3"><Field testId="test-case-title-input" label="Título" value={form.title} onChange={(value) => onChange((current) => ({ ...current, title: value }))} /><Select label="Tipo" value={form.type} onChange={(value) => onChange((current) => ({ ...current, type: value as CaseForm["type"], automationStatus: value === "manual" ? current.automationStatus : current.automationStatus === "none" ? "planned" : current.automationStatus }))} options={[["manual", "Manual"], ["hybrid", "Híbrido"], ["automated", "Automatizado"]]} /><Select label="Prioridade" value={form.priority} onChange={(value) => onChange((current) => ({ ...current, priority: value as CaseForm["priority"] }))} options={[["low", "Baixa"], ["medium", "Média"], ["high", "Alta"], ["critical", "Crítica"]]} /><Field label="Tags" value={form.tags} onChange={(value) => onChange((current) => ({ ...current, tags: value }))} placeholder="smoke, login, regressao" /></div></section>
      <section className="rounded-2xl border border-[var(--tc-border,#d7deea)] p-4"><h3 className="text-sm font-black">Escopo</h3><div className="mt-3 grid gap-3"><Field label="Suite/Pasta" value={form.suiteName} onChange={(value) => onChange((current) => ({ ...current, suiteName: value }))} /><Field label="Aplicação" value={form.applicationId} onChange={(value) => onChange((current) => ({ ...current, applicationId: value }))} /><Field label="Módulo" value={form.moduleId} onChange={(value) => onChange((current) => ({ ...current, moduleId: value }))} /></div></section>
    </div>
    <section className="mt-4 rounded-2xl border border-[var(--tc-border,#d7deea)] p-4"><h3 className="text-sm font-black">Caso</h3><div className="mt-3 grid gap-3 lg:grid-cols-2"><TextArea testId="test-case-description-input" label="Descrição" value={form.description} onChange={(value) => onChange((current) => ({ ...current, description: value }))} /><TextArea label="Objetivo" value={form.objective} onChange={(value) => onChange((current) => ({ ...current, objective: value }))} /><TextArea testId="test-case-preconditions-input" label="Pré-condições" value={form.preconditions} onChange={(value) => onChange((current) => ({ ...current, preconditions: value }))} /><TextArea label="Pós-condições" value={form.postconditions} onChange={(value) => onChange((current) => ({ ...current, postconditions: value }))} /></div><div className="mt-4 space-y-3"><div className="flex items-center justify-between"><h4 className="text-sm font-black">Passos</h4><button type="button" data-testid="test-case-add-step-button" onClick={() => onChange((current) => ({ ...current, steps: [...current.steps, { ...EMPTY_STEP }] }))} className="rounded-full border border-[var(--tc-border,#d7deea)] px-3 py-1 text-xs font-bold"><FiPlus className="inline" /> Adicionar passo</button></div>{form.steps.map((step, index) => <div key={index} className="grid gap-2 rounded-xl bg-[var(--tc-surface-2,#f8fafc)] p-3 lg:grid-cols-2"><Field testId={index === 0 ? "test-case-step-action-input" : undefined} label={`Ação ${index + 1}`} value={step.action} onChange={(value) => onStepChange(index, "action", value)} /><Field testId={index === 0 ? "test-case-step-expected-input" : undefined} label="Resultado esperado" value={step.expectedResult} onChange={(value) => onStepChange(index, "expectedResult", value)} /></div>)}</div></section>
    <section className="mt-4 rounded-2xl border border-[var(--tc-border,#d7deea)] p-4"><h3 className="text-sm font-black">Automação</h3><p className="mt-1 text-xs text-[var(--tc-text-muted,#6b7280)]">Use para marcar fila/vínculo técnico. Não executa script.</p><div className="mt-3 grid gap-3 lg:grid-cols-3"><Select label="Status" value={form.automationStatus} onChange={(value) => onChange((current) => ({ ...current, automationStatus: value as CaseForm["automationStatus"], type: value === "none" ? "manual" : current.type === "manual" ? "hybrid" : current.type }))} options={[["none", "Não aplicável"], ["planned", "Automatizável"], ["pending", "Pendente"], ["review", "Em revisão"], ["linked", "Vinculado"], ["stable", "Estável"], ["broken", "Quebrado"]]} /><Select label="Ferramenta sugerida" value={form.automationTool} onChange={(value) => onChange((current) => ({ ...current, automationTool: value as CaseForm["automationTool"] }))} options={[["none", "Nenhuma"], ["playwright", "Playwright"], ["postman", "Postman/API"], ["api", "API customizada"]]} /></div>{showAutomation && form.automationTool === "playwright" ? <div className="mt-3 grid gap-3 lg:grid-cols-2"><Field label="Spec file" value={form.automationSpecFile} onChange={(value) => onChange((current) => ({ ...current, automationSpecFile: value }))} placeholder="tests/e2e/login.spec.ts" /><Field label="Test title" value={form.automationTestTitle} onChange={(value) => onChange((current) => ({ ...current, automationTestTitle: value }))} /><Field label="Project" value={form.automationProject} onChange={(value) => onChange((current) => ({ ...current, automationProject: value }))} /><Field label="Tags" value={form.automationTags} onChange={(value) => onChange((current) => ({ ...current, automationTags: value }))} placeholder="@smoke @login" /><TextArea label="Command de referência" value={form.automationCommand} onChange={(value) => onChange((current) => ({ ...current, automationCommand: value }))} /></div> : null}</section>
    {error ? <p className="mt-4 text-sm font-bold text-rose-700">{error}</p> : null}<div className="mt-5 flex justify-end gap-2 border-t border-[var(--tc-border,#d7deea)] pt-4"><button type="button" onClick={onClose} className="rounded-xl border border-[var(--tc-border,#d7deea)] px-4 py-2 text-sm font-bold">Cancelar</button><button type="button" data-testid="test-case-save-button" onClick={onSave} disabled={saving} className="rounded-xl bg-[var(--tc-primary,#011848)] px-4 py-2 text-sm font-black text-white disabled:opacity-60">{saving ? "Salvando..." : "Salvar caso"}</button></div>
  </div></div>;
}

function Field({ label, value, onChange, placeholder, testId }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; testId?: string }) {
  return <label className="grid gap-1 text-xs font-semibold">{label}<input data-testid={testId} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="min-h-10 rounded-xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-input-bg,#ffffff)] px-3 text-sm outline-none focus:border-[var(--tc-accent,#ef0001)]" /></label>;
}

function TextArea({ label, value, onChange, testId }: { label: string; value: string; onChange: (value: string) => void; testId?: string }) {
  return <label className="grid gap-1 text-xs font-semibold">{label}<textarea data-testid={testId} value={value} onChange={(event) => onChange(event.target.value)} className="min-h-24 rounded-xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-input-bg,#ffffff)] px-3 py-2 text-sm outline-none focus:border-[var(--tc-accent,#ef0001)]" /></label>;
}
