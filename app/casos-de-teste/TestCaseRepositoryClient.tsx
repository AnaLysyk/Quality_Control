"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  FiArchive,
  FiBookOpen,
  FiChevronDown,
  FiCheckCircle,
  FiClipboard,
  FiCode,
  FiEdit2,
  FiFilter,
  FiFolderPlus,
  FiLayers,
  FiLoader,
  FiPlay,
  FiPlus,
  FiRefreshCcw,
  FiSave,
  FiSearch,
  FiShield,
  FiTrash2,
  FiUploadCloud,
  FiX,
} from "react-icons/fi";
import { useAppShellCoverSlot } from "@/components/AppShellCoverSlotContext";
import { fetchApi } from "@/lib/api";
import { useAuthUser } from "@/hooks/useAuthUser";
import { useClientContext } from "@/context/ClientContext";
import { useProjectContext } from "@/context/ProjectContext";
import TestCaseRepositoryImportExportPanel from "./TestCaseRepositoryImportExportPanel";

type TestCaseStep = {
  id: string;
  order: number;
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
    risk?: string | null;
    companyId?: string | null;
    applicationId?: string | null;
    moduleId?: string | null;
    featureId?: string | null;
    externalUrl?: string | null;
    testProjectId?: string | null;
    testProjectCode?: string | null;
    testProjectName?: string | null;
    suiteId?: string | null;
    suiteName?: string | null;
    tags: string[];
    automationStatus: string;
    lastExecutionStatus?: string | null;
    lastExecutedAt?: string | null;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
  };
  steps: TestCaseStep[];
  versions?: Array<{ id: string; version: number }>;
  automationLink?: {
    id: string;
    specFile: string;
    testTitle?: string | null;
    testDescribe?: string | null;
    playwrightProject?: string | null;
    tags: string[];
    command?: string | null;
    status: string;
  } | null;
  externalSync?: unknown;
};

type AutomationDraft = {
  id: string;
  status: "draft" | "approved" | "linked" | "discarded";
  maturityStatus?: string;
  approvalState?: "none" | "awaiting_qa_review" | "approved_for_publish" | "approved_for_execution" | "approved_for_healing";
  qualityScore?: {
    totalScore: number;
    locators: "good" | "medium" | "poor";
    assertions: "sufficient" | "weak";
    pom: "yes" | "not_required" | "missing";
    fixtures: "yes" | "no";
    traceability: "ok" | "missing";
    flakinessRisk: "low" | "medium" | "high";
    security: "ok" | "risk";
    reviewedAt: string;
    reviewedBy?: string | null;
  } | null;
  specFile?: string | null;
  specCode?: string | null;
  pomPath?: string | null;
  pomCode?: string | null;
  fixturePath?: string | null;
  fixtureCode?: string | null;
  command?: string | null;
  reviewNotes?: string | null;
  githubPublication?: {
    status: "pending" | "published" | "failed";
    repository?: string | null;
    branch?: string | null;
    commitSha?: string | null;
    pullRequestUrl?: string | null;
  } | null;
  createdAt: string;
};

type AutomationAgentRun = {
  id: string;
  agentName: string;
  status: "completed" | "failed";
  createdAt: string;
  output: unknown;
};

type AssistantLog = {
  id: string;
  role: "user" | "assistant";
  message: string;
};

type ApiResponse = {
  items: TestCaseRecord[];
  total: number;
  metrics: {
    total: number;
    automated: number;
    hybrid: number;
    manual: number;
    withoutAutomation: number;
    brokenAutomation: number;
    neverExecuted: number;
    failedRecently: number;
    automationCoverage: number;
  };
};

type TestProjectSuite = {
  id: string;
  externalId?: string | null;
  name: string;
  parentId?: string | null;
  casesCount?: number;
};

type TestProject = {
  id: string;
  code: string | null;
  name: string;
  provider: string;
  applicationId?: string | null;
  applicationName?: string | null;
  status?: string;
  suites: TestProjectSuite[];
  casesCount: number;
  warnings?: string[];
};

type TestProjectsResponse = {
  projects?: TestProject[];
  warnings?: string[];
};

type StepDraft = {
  action: string;
  expectedResult: string;
  data: string;
  notes: string;
};

type FormState = {
  title: string;
  description: string;
  objective: string;
  preconditions: string;
  postconditions: string;
  companySlug: string;
  applicationId: string;
  moduleId: string;
  source: string;
  type: string;
  status: string;
  priority: string;
  automationStatus: string;
  tags: string;
  automationSpecFile: string;
  automationTestTitle: string;
  automationProject: string;
  automationTags: string;
  automationCommand: string;
  steps: StepDraft[];
};

const EMPTY_STEP: StepDraft = {
  action: "",
  expectedResult: "",
  data: "",
  notes: "",
};

const EMPTY_FORM: FormState = {
  title: "",
  description: "",
  objective: "",
  preconditions: "",
  postconditions: "",
  companySlug: "",
  applicationId: "",
  moduleId: "",
  source: "manual",
  type: "manual",
  status: "draft",
  priority: "medium",
  automationStatus: "none",
  tags: "",
  automationSpecFile: "",
  automationTestTitle: "",
  automationProject: "chromium",
  automationTags: "",
  automationCommand: "",
  steps: [{ ...EMPTY_STEP }],
};

const SOURCE_LABEL: Record<string, string> = {
  manual: "Manual",
  local: "Local",
  automation: "Automação",
  integration: "Integração",
  qase: "Qase",
  import: "Importado",
  playwright: "Playwright",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  active: "Ativo",
  review: "Revisão",
  obsolete: "Obsoleto",
  archived: "Arquivado",
};

const AUTOMATION_LABEL: Record<string, string> = {
  none: "Sem automação",
  planned: "Planejada",
  pending: "Planejada",
  ai_generated: "Draft IA",
  review: "Em revisão",
  approved: "Aprovada",
  linked: "Vinculado",
  published: "Enviada GitHub",
  running: "Em execução",
  stable: "Estável",
  broken: "Quebrado",
  disabled: "Desativada",
};

const PRIORITY_LABEL: Record<string, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  critical: "Crítica",
};

const TYPE_LABEL: Record<string, string> = {
  manual: "Manual",
  automated: "Automatizado",
  hybrid: "Híbrido",
};

const EXECUTION_LABEL: Record<string, string> = {
  passed: "Passed",
  failed: "Failed",
  blocked: "Blocked",
  skipped: "Skipped",
  invalid: "Invalid",
  not_run: "Não executado",
};

const PROFILE_LABEL: Record<string, string> = {
  empresa: "Empresa",
  technical_support: "Suporte Técnico",
  leader_tc: "Líder TC",
  testing_company_user: "Usuário TC",
  company_user: "Usuário da Empresa",
};

const APPROVAL_LABEL: Record<string, string> = {
  none: "Sem aprovação",
  awaiting_qa_review: "Aguardando revisão QA",
  approved_for_publish: "Aprovado para publicação",
  approved_for_execution: "Aprovado para execução",
  approved_for_healing: "Aprovado para healing",
};

type DraftApprovalAction = "request_qa_review" | "approve_publish" | "approve_execution" | "approve_healing" | "reset";
type RepositoryQuickView = "all" | "coverage_gap" | "review_queue" | "automation_backlog" | "playwright_linked";

type TestCaseRepositoryClientProps = {
  initialCompanySlug?: string;
  lockCompanyScope?: boolean;
};

function normalizeCompanySlug(value?: string) {
  return value?.trim().toLowerCase() || "all";
}

function normalizeSearchText(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function formatDateTime(value?: string | null) {
  if (!value) return "--";
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "--";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(timestamp);
}

export default function TestCaseRepositoryClient({
  initialCompanySlug,
  lockCompanyScope = false,
}: TestCaseRepositoryClientProps) {
  const { user, normalizedUser } = useAuthUser();
  const { activeClientSlug } = useClientContext();
  const { activeProject: selectedProject } = useProjectContext();
  const normalizedInitialCompanySlug = normalizeCompanySlug(initialCompanySlug);
  const [hydrated, setHydrated] = useState(false);
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("all");
  const [status, setStatus] = useState("all");
  const [automationStatus, setAutomationStatus] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [executionFilter, setExecutionFilter] = useState<"all" | "never">("all");
  const [applicationFilter, setApplicationFilter] = useState("all");
  const [moduleFilter, setModuleFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [suiteFilter, setSuiteFilter] = useState("all");
  const [suiteSearch, setSuiteSearch] = useState("");
  const [companySlug, setCompanySlug] = useState(normalizedInitialCompanySlug);
  const [items, setItems] = useState<TestCaseRecord[]>([]);
  const [testProjects, setTestProjects] = useState<TestProject[]>([]);
  const [testProjectsWarning, setTestProjectsWarning] = useState<string | null>(null);
  const [testProjectsLoading, setTestProjectsLoading] = useState(false);
  const [metrics, setMetrics] = useState<ApiResponse["metrics"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<"case" | "steps" | "automation" | "runs" | "history">("case");
  const [isCreateMenuOpen, setIsCreateMenuOpen] = useState(false);
  const [isImportPanelOpen, setIsImportPanelOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [createMode, setCreateMode] = useState<"manual" | "automated" | "ai">("manual");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [drafts, setDrafts] = useState<AutomationDraft[]>([]);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [loadingDrafts, setLoadingDrafts] = useState(false);
  const [generatingDraft, setGeneratingDraft] = useState(false);
  const [draftRefreshToken, setDraftRefreshToken] = useState(0);
  const [assistantInput, setAssistantInput] = useState("");
  const [assistantLogs, setAssistantLogs] = useState<AssistantLog[]>([]);
  const [assistantBusy, setAssistantBusy] = useState(false);
  const [agentRuns, setAgentRuns] = useState<AutomationAgentRun[]>([]);
  const [selectedBulkIds, setSelectedBulkIds] = useState<string[]>([]);

  useEffect(() => {
    setHydrated(true);
  }, []);

  const roleKey =
    (typeof user?.permissionRole === "string" && user.permissionRole.trim()) ||
    (typeof user?.companyRole === "string" && user.companyRole.trim()) ||
    (typeof user?.role === "string" && user.role.trim()) ||
    "";
  const resolvedRoleLabel = PROFILE_LABEL[roleKey.toLowerCase()] ?? (roleKey || "Perfil");
  const roleLabel = hydrated ? resolvedRoleLabel : "Perfil";
  const canViewCompanyFilter = !lockCompanyScope && (
    user?.isGlobalAdmin === true ||
    ["leader_tc", "technical_support", "admin"].includes(roleKey.toLowerCase())
  );
  const defaultCompanyForCreate =
    companySlug !== "all"
      ? companySlug
      : activeClientSlug || normalizedUser.primaryCompanySlug || normalizedUser.companySlugs[0] || "";

  const selected = useMemo(
    () => items.find((item) => item.testCase.id === selectedId) ?? items[0] ?? null,
    [items, selectedId],
  );

  const selectedBulkRecords = useMemo(
    () => items.filter((item) => selectedBulkIds.includes(item.testCase.id)),
    [items, selectedBulkIds],
  );

  const displayItems = useMemo(
    () =>
      executionFilter === "never"
        ? items.filter((item) => !item.testCase.lastExecutedAt && !item.testCase.lastExecutionStatus)
        : items,
    [executionFilter, items],
  );

  const runHref =
    companySlug !== "all"
      ? `/empresas/${encodeURIComponent(companySlug)}/runs`
      : "/runs";

  const companyOptions = useMemo(() => {
    const values = Array.from(
      new Set([
        ...items.map((item) => item.testCase.companyId).filter((value): value is string => Boolean(value)),
        ...(normalizedUser.companySlugs ?? []),
      ]),
    );
    return values.sort((left, right) => left.localeCompare(right));
  }, [items, normalizedUser.companySlugs]);

  const applicationOptions = useMemo(() => {
    const values = Array.from(
      new Set(
        items
          .map((item) => item.testCase.applicationId)
          .filter((value): value is string => typeof value === "string" && value.trim().length > 0),
      ),
    );
    return values.sort((left, right) => left.localeCompare(right));
  }, [items]);

  const moduleOptions = useMemo(() => {
    const values = Array.from(
      new Set(
        items
          .map((item) => item.testCase.moduleId)
          .filter((value): value is string => typeof value === "string" && value.trim().length > 0),
      ),
    );
    return values.sort((left, right) => left.localeCompare(right));
  }, [items]);

  const projectOptions = useMemo(() => {
    const fromProjects = testProjects
      .map((project) => project.code)
      .filter((code): code is string => typeof code === "string" && code.trim().length > 0)
      .map((code) => [code, `${code} - ${testProjects.find((project) => project.code === code)?.name ?? code}`] as [string, string]);
    const fromCases = items
      .map((item) => item.testCase.testProjectCode)
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .map((code) => [code, code] as [string, string]);
    const byCode = new Map<string, string>();
    [...fromProjects, ...fromCases].forEach(([code, label]) => {
      if (!byCode.has(code)) byCode.set(code, label);
    });
    return Array.from(byCode.entries()).sort((left, right) => left[0].localeCompare(right[0]));
  }, [items, testProjects]);

  const suiteOptions = useMemo(() => {
    const suites = testProjects
      .filter((project) => projectFilter === "all" || project.code === projectFilter)
      .flatMap((project) =>
        project.suites.map((suite) => [
          suite.id,
          `${project.code || project.name} / ${suite.name}`,
        ] as [string, string]),
      );
    const fromCases = items
      .filter((item) => projectFilter === "all" || item.testCase.testProjectCode === projectFilter)
      .filter((item) => item.testCase.suiteId || item.testCase.suiteName)
      .map((item) => [
        item.testCase.suiteId || item.testCase.suiteName || "",
        `${item.testCase.testProjectCode || "Projeto"} / ${item.testCase.suiteName || item.testCase.suiteId}`,
      ] as [string, string])
      .filter(([id]) => id);
    const byId = new Map<string, string>();
    [...suites, ...fromCases].forEach(([id, label]) => {
      if (!byId.has(id)) byId.set(id, label);
    });
    return Array.from(byId.entries()).sort((left, right) => left[1].localeCompare(right[1]));
  }, [items, projectFilter, testProjects]);

  const filteredTestProjects = useMemo(() => {
    const term = normalizeSearchText(suiteSearch);
    if (!term) return testProjects;
    return testProjects
      .map((project) => ({
        ...project,
        suites: project.suites.filter((suite) =>
          normalizeSearchText(`${project.code ?? ""} ${project.name} ${suite.name}`).includes(term),
        ),
      }))
      .filter((project) => normalizeSearchText(`${project.code ?? ""} ${project.name}`).includes(term) || project.suites.length > 0);
  }, [suiteSearch, testProjects]);

  const repositoryInsights = useMemo(() => {
    const reviewQueue = items.filter((item) => item.testCase.status === "review").length;
    const draftCases = items.filter((item) => item.testCase.status === "draft").length;
    const coverageGap = items.filter((item) => item.testCase.automationStatus === "none").length;
    const automationBacklog = items.filter((item) => ["planned", "review", "ai_generated"].includes(item.testCase.automationStatus)).length;
    const playwrightLinked = items.filter((item) => ["linked", "stable", "approved"].includes(item.testCase.automationStatus)).length;
    const projectCount = new Set(
      items
        .map((item) => item.testCase.testProjectCode)
        .filter((value): value is string => typeof value === "string" && value.trim().length > 0),
    ).size;
    const suiteCount = new Set(
      items
        .map((item) => item.testCase.suiteId || item.testCase.suiteName)
        .filter((value): value is string => typeof value === "string" && value.trim().length > 0),
    ).size;

    return {
      reviewQueue,
      draftCases,
      coverageGap,
      automationBacklog,
      playwrightLinked,
      projectCount,
      suiteCount,
    };
  }, [items]);

  const activeQuickView: RepositoryQuickView = useMemo(() => {
    if (status === "review" && automationStatus === "all") return "review_queue";
    if (automationStatus === "none") return "coverage_gap";
    if (["planned", "review", "ai_generated"].includes(automationStatus)) return "automation_backlog";
    if (["linked", "stable", "approved"].includes(automationStatus)) return "playwright_linked";
    return "all";
  }, [automationStatus, status]);

  const visibleCompanyCount = hydrated && canViewCompanyFilter
    ? Math.max(companyOptions.length, normalizedUser.companySlugs.length)
    : 1;

  const coverContent = useMemo(
    () => (
      <div className="grid w-full gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_auto_auto_auto] xl:items-center">
        <Link
          href="/docs"
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#ffffff] px-5 py-2 text-center text-sm font-bold text-[#011848] shadow-[0_2px_12px_rgba(0,0,0,0.18)] transition-colors hover:bg-[#f0f4ff] sm:justify-start"
        >
          <FiBookOpen className="h-4 w-4 shrink-0" />
          Abrir documentação do código
        </Link>
        {hydrated && selectedProject && (
          <div className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-white/18 bg-white/10 px-4 py-2 text-center text-sm font-semibold leading-5 text-white/92">
            <FiLayers className="h-4 w-4 shrink-0" />
            <span className="max-w-40 truncate">{selectedProject.name}</span>
          </div>
        )}
        <div className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-white/18 bg-white/10 px-4 py-2 text-center text-sm font-semibold leading-5 text-white/92">
          <FiShield className="h-4 w-4 shrink-0" />
          <span className="wrap-break-word">
            {roleLabel}
            {companySlug !== "all" ? `: ${companySlug}` : ""}
          </span>
        </div>
        <div className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-white/18 bg-white/10 px-4 py-2 text-center text-sm font-semibold leading-5 text-white/92">
          <FiLayers className="h-4 w-4 shrink-0" />
          <span>{visibleCompanyCount} empresa{visibleCompanyCount === 1 ? "" : "s"} visíveis</span>
        </div>
      </div>
    ),
    [companySlug, roleLabel, selectedProject, visibleCompanyCount],
  );

  useAppShellCoverSlot(coverContent);

  useEffect(() => {
    if (lockCompanyScope) {
      setCompanySlug(normalizedInitialCompanySlug);
    }
  }, [lockCompanyScope, normalizedInitialCompanySlug]);

  useEffect(() => {
    if (lockCompanyScope) return;
    if (canViewCompanyFilter) return;
    const fixedCompany = activeClientSlug || normalizedUser.primaryCompanySlug || normalizedUser.companySlugs[0] || "all";
    setCompanySlug(fixedCompany);
  }, [activeClientSlug, canViewCompanyFilter, lockCompanyScope, normalizedUser.companySlugs, normalizedUser.primaryCompanySlug]);

  useEffect(() => {
    setSuiteFilter("all");
  }, [projectFilter]);

  useEffect(() => {
    if (companySlug === "all") {
      setTestProjects([]);
      setTestProjectsWarning(null);
      setTestProjectsLoading(false);
      return;
    }

    const controller = new AbortController();

    async function loadTestProjects() {
      setTestProjectsLoading(true);
      setTestProjectsWarning(null);
      const params = new URLSearchParams({
        companySlug,
        includeCases: "false",
      });
      if (applicationFilter !== "all") params.set("applicationId", applicationFilter);

      try {
        const response = await fetchApi(`/api/test-projects?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = (await response.json().catch(() => null)) as TestProjectsResponse | null;
        if (!response.ok) {
          setTestProjects([]);
          setTestProjectsWarning("Nao foi possivel carregar projetos de casos vinculados.");
          return;
        }
        setTestProjects(payload?.projects ?? []);
        const warnings = payload?.warnings?.filter(Boolean) ?? [];
        setTestProjectsWarning(warnings.length ? warnings.join(" ") : null);
      } catch {
        if (controller.signal.aborted) return;
        setTestProjects([]);
        setTestProjectsWarning("Nao foi possivel carregar projetos de casos vinculados.");
      } finally {
        if (!controller.signal.aborted) setTestProjectsLoading(false);
      }
    }

    void loadTestProjects();

    return () => controller.abort();
  }, [applicationFilter, companySlug]);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);

      const params = new URLSearchParams();
      if (query.trim()) params.set("query", query.trim());
      if (source !== "all") params.set("source", source);
      if (status !== "all") params.set("status", status);
      if (automationStatus !== "all") params.set("automationStatus", automationStatus);
      if (priorityFilter !== "all") params.set("priority", priorityFilter);
      if (typeFilter !== "all") params.set("type", typeFilter);
      if (applicationFilter !== "all") params.set("applicationId", applicationFilter);
      if (moduleFilter !== "all") params.set("moduleId", moduleFilter);
      if (projectFilter !== "all") params.set("projectCode", projectFilter);
      if (suiteFilter !== "all") params.set("suiteId", suiteFilter);
      if (companySlug !== "all") params.set("companySlug", companySlug);
      if (selectedProject) params.set("projectId", selectedProject.id);

      try {
        const response = await fetchApi(`/api/test-cases?${params.toString()}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          if (!controller.signal.aborted) {
            setItems([]);
            setMetrics(null);
            setLoading(false);
          }
          return;
        }

        const payload = (await response.json()) as ApiResponse;
        if (controller.signal.aborted) return;
        setItems(payload.items || []);
        setMetrics(payload.metrics);
        setLoading(false);
        setSelectedId((current) => current ?? payload.items?.[0]?.testCase.id ?? null);
      } catch {
        if (controller.signal.aborted) return;
        setItems([]);
        setMetrics(null);
        setLoading(false);
      }
    }

    void load();

    return () => controller.abort();
  }, [applicationFilter, automationStatus, companySlug, moduleFilter, priorityFilter, projectFilter, query, selectedProject, source, status, suiteFilter, typeFilter]);

  useEffect(() => {
    if (!selectedId && items[0]) setSelectedId(items[0].testCase.id);
  }, [items, selectedId]);

  useEffect(() => {
    const visibleIds = new Set(displayItems.map((item) => item.testCase.id));
    setSelectedBulkIds((current) => current.filter((id) => visibleIds.has(id)));
  }, [displayItems]);

  useEffect(() => {
    if (detailTab !== "automation" || !selected?.testCase.id) return;
    let canceled = false;

    async function loadDrafts() {
      setLoadingDrafts(true);
      setDraftError(null);
      const response = await fetchApi(`/api/test-cases/${encodeURIComponent(selected.testCase.id)}/automation/drafts`);
      if (!response.ok) {
        if (!canceled) {
          setDrafts([]);
          setDraftError("Não foi possível carregar drafts de automação.");
          setLoadingDrafts(false);
        }
        return;
      }

      const payload = (await response.json()) as { drafts?: AutomationDraft[] };
      if (!canceled) {
        setDrafts(payload.drafts ?? []);
        setLoadingDrafts(false);
      }
    }

    void loadDrafts();

    return () => {
      canceled = true;
    };
  }, [detailTab, selected?.testCase.id, draftRefreshToken]);

  useEffect(() => {
    if (!["automation", "runs"].includes(detailTab) || !selected?.testCase.id) return;
    let canceled = false;

    async function loadRuns() {
      const response = await fetchApi(`/api/test-cases/${encodeURIComponent(selected.testCase.id)}/ai/runs`);
      if (!response.ok) {
        if (!canceled) setAgentRuns([]);
        return;
      }

      const payload = (await response.json()) as { runs?: AutomationAgentRun[] };
      if (!canceled) {
        setAgentRuns(payload.runs ?? []);
      }
    }

    void loadRuns();

    return () => {
      canceled = true;
    };
  }, [detailTab, selected?.testCase.id, draftRefreshToken]);

  function resetForm(record?: TestCaseRecord | null) {
    if (!record) {
      setForm({
        ...EMPTY_FORM,
        companySlug: defaultCompanyForCreate,
        automationProject: "chromium",
        steps: [{ ...EMPTY_STEP }],
      });
      return;
    }

    setForm({
      title: record.testCase.title,
      description: record.testCase.description ?? "",
      objective: record.testCase.objective ?? "",
      preconditions: record.testCase.preconditions ?? "",
      postconditions: record.testCase.postconditions ?? "",
      companySlug: record.testCase.companyId ?? "",
      applicationId: record.testCase.applicationId ?? "",
      moduleId: record.testCase.moduleId ?? "",
      source: record.testCase.source,
      type: record.testCase.type,
      status: record.testCase.status,
      priority: record.testCase.priority,
      automationStatus: record.testCase.automationStatus,
      tags: record.testCase.tags.join(", "),
      automationSpecFile: record.automationLink?.specFile ?? "",
      automationTestTitle: record.automationLink?.testTitle ?? "",
      automationProject: record.automationLink?.playwrightProject ?? "chromium",
      automationTags: record.automationLink?.tags?.join(" ") ?? "",
      automationCommand: record.automationLink?.command ?? "",
      steps: record.steps.length
        ? record.steps.map((step) => ({
            action: step.action,
            expectedResult: step.expectedResult,
            data: step.data ?? "",
            notes: step.notes ?? "",
          }))
        : [{ ...EMPTY_STEP }],
    });
  }

  function openCreateForm(mode: "manual" | "automated" | "ai" = "manual") {
    setCreateMode(mode);
    setEditingId(null);
    resetForm();
    setFormError(null);
    setIsCreateMenuOpen(false);
    if (mode === "automated") {
      setForm((current) => ({
        ...current,
        type: "automated",
        source: "automation",
        automationStatus: "planned",
      }));
    }
    if (mode === "ai") {
      setForm((current) => ({
        ...current,
        type: "hybrid",
        source: "manual",
        automationStatus: "planned",
      }));
    }
    setIsFormOpen(true);
  }

  function applyQuickView(view: RepositoryQuickView) {
    setQuery("");
    setProjectFilter("all");
    setSuiteFilter("all");
    setApplicationFilter("all");
    setModuleFilter("all");
    setSource("all");
    setPriorityFilter("all");
    setTypeFilter("all");
    setExecutionFilter("all");

    if (view === "coverage_gap") {
      setStatus("all");
      setAutomationStatus("none");
      return;
    }

    if (view === "review_queue") {
      setStatus("review");
      setAutomationStatus("all");
      return;
    }

    if (view === "automation_backlog") {
      setStatus("all");
      setAutomationStatus("planned");
      return;
    }

    if (view === "playwright_linked") {
      setStatus("all");
      setAutomationStatus("linked");
      return;
    }

    setStatus("all");
    setAutomationStatus("all");
  }

  function openEditForm(record: TestCaseRecord | null) {
    if (!record) return;
    setCreateMode("manual");
    setEditingId(record.testCase.id);
    resetForm(record);
    setFormError(null);
    setIsFormOpen(true);
  }

  function updateStep(index: number, field: keyof StepDraft, value: string) {
    setForm((current) => ({
      ...current,
      steps: current.steps.map((step, stepIndex) => (stepIndex === index ? { ...step, [field]: value } : step)),
    }));
  }

  function addStep() {
    setForm((current) => ({ ...current, steps: [...current.steps, { ...EMPTY_STEP }] }));
  }

  function removeStep(index: number) {
    setForm((current) => {
      const next = current.steps.filter((_, stepIndex) => stepIndex !== index);
      return { ...current, steps: next.length ? next : [{ ...EMPTY_STEP }] };
    });
  }

  async function handleSave() {
    setSaving(true);
    setFormError(null);

    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      objective: form.objective.trim(),
      preconditions: form.preconditions.trim(),
      postconditions: form.postconditions.trim(),
      companySlug: form.companySlug.trim() || undefined,
      applicationId: form.applicationId.trim() || undefined,
      moduleId: form.moduleId.trim() || undefined,
      projectId: selectedProject?.id || undefined,
      testProjectCode: projectFilter !== "all" ? projectFilter : undefined,
      suiteId: suiteFilter !== "all" ? suiteFilter : undefined,
      suiteName: suiteFilter !== "all" ? suiteOptions.find(([id]) => id === suiteFilter)?.[1]?.split(" / ").pop() : undefined,
      source: form.source,
      type: form.type,
      status: form.status,
      priority: form.priority,
      automationStatus: form.automationStatus,
      tags: form.tags
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      steps: form.steps
        .map((step, index) => ({
          order: index + 1,
          action: step.action.trim(),
          expectedResult: step.expectedResult.trim(),
          data: step.data.trim() || undefined,
          notes: step.notes.trim() || undefined,
        }))
        .filter((step) => step.action && step.expectedResult),
    };

    if (!payload.title) {
      setFormError("Título é obrigatório.");
      setSaving(false);
      return;
    }

    const method = editingId ? "PATCH" : "POST";
    const endpoint = editingId ? `/api/test-cases/${editingId}` : "/api/test-cases";
    const response = await fetchApi(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const payloadError = await response.json().catch(() => null);
      setFormError(payloadError?.message || payloadError?.error || "Não foi possível salvar o caso.");
      setSaving(false);
      return;
    }

    const saved = (await response.json()) as TestCaseRecord;
    let finalSaved = saved;

    const shouldSaveAutomationLink =
      (form.type === "automated" || form.type === "hybrid" || form.automationStatus !== "none") &&
      form.automationSpecFile.trim().length > 0;

    if (shouldSaveAutomationLink) {
      const automationResponse = await fetchApi(`/api/test-cases/${saved.testCase.id}/automation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          specFile: form.automationSpecFile.trim(),
          testTitle: form.automationTestTitle.trim() || undefined,
          playwrightProject: form.automationProject.trim() || "chromium",
          tags: form.automationTags
            .split(/[\s,]+/)
            .map((item) => item.trim())
            .filter(Boolean),
          command: form.automationCommand.trim() || undefined,
          status:
            form.automationStatus === "linked" ||
            form.automationStatus === "published" ||
            form.automationStatus === "stable"
              ? "active"
              : form.automationStatus === "broken"
                ? "broken"
                : form.automationStatus === "disabled"
                  ? "disabled"
                  : "pending",
        }),
      });

      if (!automationResponse.ok) {
        const automationError = await automationResponse.json().catch(() => null);
        setFormError(automationError?.message || "Caso salvo, mas falhou ao criar vínculo Playwright.");
        setSaving(false);
        return;
      }

      const automationPayload = (await automationResponse.json()) as {
        testCase: TestCaseRecord["testCase"];
        steps: TestCaseRecord["steps"];
        automationLink: TestCaseRecord["automationLink"];
      };
      finalSaved = {
        ...saved,
        testCase: automationPayload.testCase,
        steps: automationPayload.steps,
        automationLink: automationPayload.automationLink,
      };
    }

    setItems((current) => {
      const next = current.filter((item) => item.testCase.id !== finalSaved.testCase.id);
      next.unshift(finalSaved);
      return next;
    });
    setSelectedId(finalSaved.testCase.id);
    setIsFormOpen(false);
    setEditingId(null);
    setSaving(false);

    // Modo IA: gera draft Playwright automaticamente após criar o caso base
    if (createMode === "ai" && !editingId) {
      setGeneratingDraft(true);
      setDraftError(null);
      const draftResponse = await fetchApi(`/api/test-cases/${finalSaved.testCase.id}/ai/generate-playwright`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playwrightProject: "chromium",
          testDescribe: "Repositório de Casos",
        }),
      });
      if (!draftResponse.ok) {
        const draftErr = await draftResponse.json().catch(() => null);
        setDraftError(draftErr?.message || "Caso criado, mas não foi possível gerar draft de IA automaticamente.");
      } else {
        const draftPayload = (await draftResponse.json()) as { draft?: AutomationDraft };
        if (draftPayload.draft) {
          setDrafts((current) => [draftPayload.draft as AutomationDraft, ...current.filter((item) => item.id !== draftPayload.draft?.id)]);
        }
        setDraftRefreshToken((current) => current + 1);
      }
      setGeneratingDraft(false);
    }
  }

  async function handleArchive(record: TestCaseRecord) {
    const response = await fetchApi(`/api/test-cases/${record.testCase.id}`, { method: "DELETE" });
    if (!response.ok) return;
    const archived = (await response.json()) as TestCaseRecord;
    setItems((current) => current.map((item) => (item.testCase.id === archived.testCase.id ? archived : item)));
    if (selectedId === archived.testCase.id) {
      setSelectedId(archived.testCase.id);
    }
  }

  function toggleBulkSelection(id: string, checked: boolean) {
    setSelectedBulkIds((current) =>
      checked ? Array.from(new Set([...current, id])) : current.filter((item) => item !== id),
    );
  }

  function toggleAllVisible(checked: boolean) {
    setSelectedBulkIds(checked ? displayItems.map((item) => item.testCase.id) : []);
  }

  async function handleBulkStatus(nextStatus: string) {
    const records = selectedBulkRecords;
    if (records.length === 0) return;
    const updated = await Promise.all(
      records.map(async (record) => {
        const response = await fetchApi(`/api/test-cases/${record.testCase.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: nextStatus }),
        });
        if (!response.ok) return null;
        return (await response.json()) as TestCaseRecord;
      }),
    );
    const byId = new Map(updated.filter((record): record is TestCaseRecord => Boolean(record)).map((record) => [record.testCase.id, record]));
    setItems((current) => current.map((item) => byId.get(item.testCase.id) ?? item));
    setSelectedBulkIds([]);
  }

  async function handleBulkArchive() {
    const records = selectedBulkRecords;
    if (records.length === 0) return;
    const confirmed = window.confirm(`Arquivar ${records.length} caso(s) selecionado(s)?`);
    if (!confirmed) return;
    const updated = await Promise.all(
      records.map(async (record) => {
        const response = await fetchApi(`/api/test-cases/${record.testCase.id}`, { method: "DELETE" });
        if (!response.ok) return null;
        return (await response.json()) as TestCaseRecord;
      }),
    );
    const byId = new Map(updated.filter((record): record is TestCaseRecord => Boolean(record)).map((record) => [record.testCase.id, record]));
    setItems((current) => current.map((item) => byId.get(item.testCase.id) ?? item));
    setSelectedBulkIds([]);
  }

  async function handleGeneratePlaywrightDraft() {
    if (!selected?.testCase.id) return;
    setGeneratingDraft(true);
    setDraftError(null);

    const response = await fetchApi(`/api/test-cases/${selected.testCase.id}/ai/generate-playwright`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        playwrightProject: selected.automationLink?.playwrightProject || "chromium",
        testDescribe: "Repositório de Casos",
      }),
    });

    if (!response.ok) {
      const payloadError = await response.json().catch(() => null);
      setDraftError(payloadError?.message || "Não foi possível gerar draft de automação.");
      setGeneratingDraft(false);
      return;
    }

    const payload = (await response.json()) as { draft?: AutomationDraft };
    if (payload.draft) {
      setDrafts((current) => [payload.draft as AutomationDraft, ...current.filter((item) => item.id !== payload.draft?.id)]);
    }
    setDraftRefreshToken((current) => current + 1);
    setGeneratingDraft(false);
  }

  function pushAssistantLog(role: "user" | "assistant", message: string) {
    setAssistantLogs((current) => [
      ...current,
      { id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`, role, message },
    ]);
  }

  async function handleDraftAction(draftId: string, action: "approve" | "link" | "discard") {
    if (!selected?.testCase.id) return;
    setAssistantBusy(true);
    const response = await fetchApi(`/api/test-cases/${selected.testCase.id}/automation/drafts/${draftId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });

    if (!response.ok) {
      const payloadError = await response.json().catch(() => null);
      const message = payloadError?.message || `Falha ao executar ${action} no draft.`;
      setDraftError(message);
      pushAssistantLog("assistant", message);
      setAssistantBusy(false);
      return;
    }

    if (action === "link") {
      const payload = (await response.json()) as {
        testCase?: TestCaseRecord["testCase"];
        automationLink?: TestCaseRecord["automationLink"];
      };
      if (payload.testCase) {
        setItems((current) =>
          current.map((item) =>
            item.testCase.id === selected.testCase.id
              ? {
                  ...item,
                  testCase: payload.testCase ?? item.testCase,
                  automationLink: payload.automationLink ?? item.automationLink,
                }
              : item,
          ),
        );
      }
    } else {
      await response.json().catch(() => null);
    }

    setDraftRefreshToken((current) => current + 1);
    pushAssistantLog("assistant", `Draft ${draftId} atualizado com ação ${action}.`);
    setAssistantBusy(false);
  }

  async function handlePublishDraftGithub(draft: AutomationDraft) {
    if (!selected?.testCase.id) return;

    const confirmed = window.confirm("Confirmar publicação deste draft no GitHub?");
    if (!confirmed) return;

    setAssistantBusy(true);
    const response = await fetchApi(
      `/api/test-cases/${selected.testCase.id}/automation/drafts/${draft.id}/publish-github`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirm: true,
        }),
      },
    );

    if (!response.ok) {
      const payloadError = await response.json().catch(() => null);
      const message = payloadError?.message || "Falha ao publicar draft no GitHub.";
      setDraftError(message);
      pushAssistantLog("assistant", message);
      setAssistantBusy(false);
      return;
    }

    const payload = (await response.json()) as { publication?: { pullRequestUrl?: string | null } };
    setDraftRefreshToken((current) => current + 1);
    pushAssistantLog(
      "assistant",
      payload.publication?.pullRequestUrl
        ? `Publicação registrada. PR: ${payload.publication.pullRequestUrl}`
        : "Publicação GitHub registrada com confirmação explícita.",
    );
    setAssistantBusy(false);
  }

  async function handleReviewDraft(draftId: string) {
    if (!selected?.testCase.id) return;
    setAssistantBusy(true);

    const locatorJustificationRaw = window.prompt(
      "Justificativa opcional para locator frágil (nth/xpath/css), se necessário:",
      "",
    );
    const locatorJustification = locatorJustificationRaw?.trim() || undefined;

    const response = await fetchApi(`/api/test-cases/${selected.testCase.id}/ai/review-automation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ draftId, locatorJustification }),
    });

    if (!response.ok) {
      const payloadError = await response.json().catch(() => null);
      const locatorGateMessage =
        payloadError?.review?.locatorPolicy?.blocked === true
          ? `Review bloqueado por policy gate de locator: ${(payloadError?.review?.locatorPolicy?.reasons || []).join(" ")}`
          : null;
      pushAssistantLog("assistant", locatorGateMessage || payloadError?.message || "Falha ao revisar draft.");
      setAssistantBusy(false);
      return;
    }

    const payload = (await response.json()) as {
      review?: {
        score?: number;
        risks?: string[];
        qualityScore?: { totalScore?: number };
        locatorPolicy?: { blocked?: boolean };
      };
    };
    pushAssistantLog(
      "assistant",
      `Review concluído: score=${payload.review?.score ?? "n/a"}; quality=${payload.review?.qualityScore?.totalScore ?? "n/a"}; riscos=${payload.review?.risks?.length ?? 0}; gate=${payload.review?.locatorPolicy?.blocked ? "blocked" : "ok"}.`,
    );
    setDraftRefreshToken((current) => current + 1);
    setAssistantBusy(false);
  }

  async function handleApprovalAction(draftId: string, action: DraftApprovalAction) {
    if (!selected?.testCase.id) return;
    setAssistantBusy(true);

    const response = await fetchApi(`/api/test-cases/${selected.testCase.id}/automation/drafts/${draftId}/approval`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });

    if (!response.ok) {
      const payloadError = await response.json().catch(() => null);
      pushAssistantLog("assistant", payloadError?.message || "Falha ao atualizar estado de aprovação.");
      setAssistantBusy(false);
      return;
    }

    await response.json().catch(() => null);
    pushAssistantLog("assistant", `Approval state atualizado (${action}) para draft ${draftId}.`);
    setDraftRefreshToken((current) => current + 1);
    setAssistantBusy(false);
  }

  async function handleHealDraft(draftId: string, errorMessage?: string) {
    if (!selected?.testCase.id) return;
    setAssistantBusy(true);

    const response = await fetchApi(`/api/test-cases/${selected.testCase.id}/ai/heal-failure`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        draftId,
        errorMessage: errorMessage || "Falha detectada em execução automatizada.",
      }),
    });

    if (!response.ok) {
      const payloadError = await response.json().catch(() => null);
      pushAssistantLog("assistant", payloadError?.message || "Falha ao gerar healing do draft.");
      setAssistantBusy(false);
      return;
    }

    const payload = (await response.json()) as { heal?: { cause?: string; suggestions?: string[] } };
    pushAssistantLog(
      "assistant",
      `Healing concluído: causa=${payload.heal?.cause ?? "n/a"}; sugestões=${payload.heal?.suggestions?.length ?? 0}.`,
    );
    setDraftRefreshToken((current) => current + 1);
    setAssistantBusy(false);
  }

  async function handleAssistantCommandSubmit() {
    const command = assistantInput.trim();
    if (!command) return;

    pushAssistantLog("user", command);
    setAssistantInput("");

    const parts = command.split(/\s+/);
    const action = parts[0]?.toLowerCase();
    const draftId = parts.slice(1).join(" ").trim();

    if (action === "gerar") {
      await handleGeneratePlaywrightDraft();
      pushAssistantLog("assistant", "Comando gerar executado: draft IA solicitado.");
      return;
    }

    if (action === "aprovar" && draftId) {
      await handleDraftAction(draftId, "approve");
      return;
    }

    if (action === "descartar" && draftId) {
      await handleDraftAction(draftId, "discard");
      return;
    }

    if (action === "vincular" && draftId) {
      await handleDraftAction(draftId, "link");
      return;
    }

    if (action === "publicar" && draftId) {
      const draft = drafts.find((item) => item.id === draftId);
      if (!draft) {
        pushAssistantLog("assistant", `Draft ${draftId} não encontrado.`);
        return;
      }
      await handlePublishDraftGithub(draft);
      return;
    }

    if (action === "review" && draftId) {
      await handleReviewDraft(draftId);
      return;
    }

    if (action === "heal" && draftId) {
      await handleHealDraft(draftId);
      return;
    }

    if (action === "approval" && draftId) {
      const mode = parts[2]?.toLowerCase();
      if (mode === "review") await handleApprovalAction(draftId, "request_qa_review");
      else if (mode === "publish") await handleApprovalAction(draftId, "approve_publish");
      else if (mode === "execution") await handleApprovalAction(draftId, "approve_execution");
      else if (mode === "healing") await handleApprovalAction(draftId, "approve_healing");
      else if (mode === "reset") await handleApprovalAction(draftId, "reset");
      else pushAssistantLog("assistant", "Use: approval <draftId> review|publish|execution|healing|reset");
      return;
    }

    pushAssistantLog(
      "assistant",
      "Comando não reconhecido. Use: gerar | aprovar <draftId> | vincular <draftId> | descartar <draftId> | publicar <draftId> | review <draftId> | heal <draftId> | approval <draftId> review|publish|execution|healing|reset",
    );
  }

  return (
    <section
      data-testid="test-case-repository"
      className="space-y-3 rounded-[24px] border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#ffffff)] p-3 text-[var(--tc-text,#0b1a3c)] shadow-sm sm:p-4"
    >
      <header data-testid="test-case-header" className="rounded-2xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] px-4 py-3 shadow-sm">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--tc-accent,#ef0001)]">Repositório Central</p>
            <h1 className="mt-1 text-xl font-black tracking-[-0.03em] text-[var(--tc-text,#0b1a3c)] sm:text-2xl">Casos de Teste</h1>
            <p className="mt-1 max-w-3xl text-sm leading-5 text-[var(--tc-text-secondary,#4b5563)]">
              Fonte única de casos manuais, automatizados e vinculados ao Playwright.
            </p>
            <p
              data-testid="test-case-context-chip"
              className="mt-2 inline-flex items-center rounded-full border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#ffffff)] px-3 py-1 text-xs font-bold text-[var(--tc-text,#0b1a3c)]"
            >
              {roleLabel}
              {companySlug !== "all" ? ` - ${companySlug}` : ""}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsCreateMenuOpen((current) => !current)}
                data-testid="test-case-new-button"
                className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg bg-[var(--tc-primary,#011848)] px-3 py-2 text-xs font-bold text-white"
              >
                <FiPlus className="h-4 w-4" />
                Novo caso de teste
                <FiChevronDown className="h-4 w-4" />
              </button>

              {isCreateMenuOpen ? (
                <div data-testid="test-case-new-menu" className="absolute right-0 z-20 mt-2 w-64 rounded-2xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#ffffff)] p-2 shadow-xl">
                  <button
                    type="button"
                    data-testid="test-case-new-manual"
                    onClick={() => openCreateForm("manual")}
                    className="flex w-full items-center justify-start gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-[var(--tc-text,#0b1a3c)] hover:bg-[var(--tc-surface-2,#f8fafc)]"
                  >
                    Caso manual
                  </button>
                  <button
                    type="button"
                    data-testid="test-case-new-automated"
                    onClick={() => openCreateForm("automated")}
                    className="flex w-full items-center justify-start gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-[var(--tc-text,#0b1a3c)] hover:bg-[var(--tc-surface-2,#f8fafc)]"
                  >
                    Caso automatizado Playwright
                  </button>
                  <button
                    type="button"
                    data-testid="test-case-new-ai"
                    onClick={() => openCreateForm("ai")}
                    className="flex w-full items-center justify-start gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-[var(--tc-text,#0b1a3c)] hover:bg-[var(--tc-surface-2,#f8fafc)]"
                  >
                    Gerar com IA
                  </button>
                </div>
              ) : null}
            </div>
            <button
              type="button"
              title="Criação de suite será vinculada ao projeto quando houver integração disponível"
              className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#ffffff)] px-3 py-2 text-xs font-bold text-[var(--tc-text,#0b1a3c)]"
            >
              <FiFolderPlus className="h-4 w-4" />
              Nova suite
            </button>
            <button
              type="button"
              onClick={() => setIsImportPanelOpen(true)}
              className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#ffffff)] px-3 py-2 text-xs font-bold text-[var(--tc-text,#0b1a3c)]"
            >
              <FiUploadCloud className="h-4 w-4" />
              Importar
            </button>
            <Link
              href={runHref}
              className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#ffffff)] px-3 py-2 text-xs font-bold text-[var(--tc-text,#0b1a3c)]"
            >
              <FiPlay className="h-4 w-4" />
              Iniciar run
            </Link>
            <button
              type="button"
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.dispatchEvent(new CustomEvent("assistant:open", {
                    detail: {
                      source: "casos-de-teste",
                      agentMode: "qa",
                      panelMode: "side",
                      initialMessage: "Analise o repositório de casos de teste: cobertura, lacunas e próximas prioridades.",
                    },
                  }));
                }
              }}
              className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#ffffff)] px-3 py-2 text-xs font-bold text-[var(--tc-text,#0b1a3c)]"
            >
              Perguntar IA
            </button>
          </div>
        </div>
      </header>

      <div data-testid="test-case-metrics-bar" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7">
        <Metric active={activeQuickView === "all"} label="Total de casos" value={metrics?.total ?? 0} icon={<FiClipboard />} onClick={() => applyQuickView("all")} />
        <Metric active={activeQuickView === "playwright_linked"} label="Automatizados" value={metrics?.automated ?? 0} icon={<FiCheckCircle />} onClick={() => applyQuickView("playwright_linked")} />
        <Metric active={activeQuickView === "coverage_gap"} label="Sem automação" value={metrics?.withoutAutomation ?? 0} icon={<FiShield />} onClick={() => applyQuickView("coverage_gap")} />
        <Metric active={activeQuickView === "review_queue"} label="Em revisão" value={repositoryInsights.reviewQueue} icon={<FiFilter />} onClick={() => applyQuickView("review_queue")} />
        <Metric active={executionFilter === "never"} label="Nunca executados" value={metrics?.neverExecuted ?? 0} icon={<FiClipboard />} onClick={() => { applyQuickView("all"); setExecutionFilter("never"); }} />
        <Metric active={automationStatus === "broken"} label="Flaky" value={metrics?.brokenAutomation ?? 0} icon={<FiCode />} onClick={() => { applyQuickView("all"); setAutomationStatus("broken"); }} />
        <Metric label="Cobertura de automação" value={metrics?.automationCoverage ?? 0} suffix="%" icon={<FiLayers />} onClick={() => applyQuickView("playwright_linked")} />
      </div>

      <section className="hidden">
        <article className="rounded-[28px] border border-[var(--tc-border,#d7deea)] bg-[linear-gradient(135deg,#08142a_0%,#0d1d3f_60%,#132956_100%)] p-5 text-white shadow-[0_20px_48px_rgba(1,24,72,.18)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/65">Mapa do repositório</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/65">Empresa</p>
              <p className="mt-2 text-lg font-black">{companySlug === "all" ? "Operação geral" : companySlug}</p>
              <p className="mt-1 text-xs text-white/60">{visibleCompanyCount} escopo(s) disponível(eis)</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/65">Projetos</p>
              <p className="mt-2 text-lg font-black">{repositoryInsights.projectCount || testProjects.length}</p>
              <p className="mt-1 text-xs text-white/60">com casos visíveis no filtro atual</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/65">Suites</p>
              <p className="mt-2 text-lg font-black">{repositoryInsights.suiteCount || suiteOptions.length}</p>
              <p className="mt-1 text-xs text-white/60">pastas e agrupadores ativos</p>
            </div>
          </div>
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/15 p-4">
            <p className="text-sm font-semibold text-white/84">
              {lockCompanyScope
                ? "Esta visão está ancorada na empresa da rota e já organiza casos, projetos e suites no mesmo fluxo."
                : "Use as visões rápidas para alternar entre lacunas, revisão e automação sem reconfigurar filtro por filtro."}
            </p>
          </div>
        </article>

        <article className="rounded-[28px] border border-[var(--tc-border,#d7deea)] bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--tc-accent,#ef0001)]">Visões rápidas</p>
              <h2 className="mt-2 text-lg font-black tracking-[-0.03em] text-[var(--tc-text,#0b1a3c)]">Troca de foco sem ruído</h2>
            </div>
            <button
              type="button"
              onClick={() => applyQuickView("all")}
              className="text-xs font-semibold text-[var(--tc-accent,#ef0001)]"
            >
              Resetar
            </button>
          </div>

          <div className="mt-4 grid gap-3">
            <QuickViewButton
              active={activeQuickView === "coverage_gap"}
              label="Sem automação"
              note={`${repositoryInsights.coverageGap} caso(s) com gap de cobertura`}
              onClick={() => applyQuickView("coverage_gap")}
            />
            <QuickViewButton
              active={activeQuickView === "review_queue"}
              label="Fila de revisão"
              note={`${repositoryInsights.reviewQueue} caso(s) aguardando revisão`}
              onClick={() => applyQuickView("review_queue")}
            />
            <QuickViewButton
              active={activeQuickView === "automation_backlog"}
              label="Backlog de automação"
              note={`${repositoryInsights.automationBacklog} caso(s) planejados ou em avaliação`}
              onClick={() => applyQuickView("automation_backlog")}
            />
            <QuickViewButton
              active={activeQuickView === "playwright_linked"}
              label="Playwright vinculado"
              note={`${repositoryInsights.playwrightLinked} caso(s) já conectados à automação`}
              onClick={() => applyQuickView("playwright_linked")}
            />
          </div>
        </article>

        <article className="rounded-[28px] border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--tc-accent,#ef0001)]">Atenção imediata</p>
          <div className="mt-4 space-y-3">
            <InsightRow label="Rascunhos" value={repositoryInsights.draftCases} tone="neutral" />
            <InsightRow label="Em revisão" value={repositoryInsights.reviewQueue} tone="warn" />
            <InsightRow label="Sem automação" value={repositoryInsights.coverageGap} tone="danger" />
            <InsightRow label="Backlog técnico" value={repositoryInsights.automationBacklog} tone="neutral" />
          </div>
          <div className="mt-4 rounded-2xl border border-[var(--tc-border,#d7deea)] bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--tc-text-muted,#6b7280)]">Cobertura atual</p>
            <p className="mt-2 text-2xl font-black tracking-[-0.04em] text-[var(--tc-text,#0b1a3c)]">{metrics?.automationCoverage ?? 0}%</p>
            <p className="mt-1 text-sm text-[var(--tc-text-secondary,#4b5563)]">percentual dos casos visíveis já conectado à camada de automação</p>
          </div>
        </article>
      </section>

      <article className="rounded-2xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] p-3">
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5 2xl:grid-cols-10">
          <label className="grid gap-1 text-xs font-semibold text-[var(--tc-text,#0b1a3c)] xl:col-span-2">
            Buscar
            <span className="relative">
              <FiSearch className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--tc-text-muted,#6b7280)]" />
              <input
                data-testid="test-case-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Código, título, tag, aplicação ou módulo"
                className="min-h-9 w-full rounded-lg border border-[var(--tc-border,#d7deea)] bg-[var(--tc-input-bg,#ffffff)] pr-3 pl-9 text-xs text-[var(--tc-text,#0b1a3c)] outline-none transition focus:border-[var(--tc-accent,#ef0001)]"
              />
            </span>
          </label>

          {canViewCompanyFilter ? (
            <div data-testid="test-case-filter-company">
              <Select
                label="Empresa"
                value={companySlug}
                onChange={setCompanySlug}
                options={[["all", "Todas"], ...companyOptions.map((item) => [item, item] as [string, string])]}
                testId="test-case-company-filter"
              />
            </div>
          ) : null}

          <Select
            testId="test-case-filter-application"
            label="Aplicação"
            value={applicationFilter}
            onChange={setApplicationFilter}
            options={[["all", "Todas"], ...applicationOptions.map((item) => [item, item] as [string, string])]}
          />

          <Select
            testId="test-case-filter-project"
            label="Projeto"
            value={projectFilter}
            onChange={setProjectFilter}
            options={[["all", testProjectsLoading ? "Carregando..." : "Todos"], ...projectOptions]}
          />

          <Select
            testId="test-case-filter-suite"
            label="Suite/Pasta"
            value={suiteFilter}
            onChange={setSuiteFilter}
            options={[["all", "Todas"], ...suiteOptions]}
          />

          <Select
            testId="test-case-filter-module"
            label="Módulo"
            value={moduleFilter}
            onChange={setModuleFilter}
            options={[["all", "Todos"], ...moduleOptions.map((item) => [item, item] as [string, string])]}
          />

          <Select
            testId="test-case-filter-source"
            label="Origem"
            value={source}
            onChange={setSource}
            options={[
              ["all", "Todas"],
              ["manual", SOURCE_LABEL.manual],
              ["integration", SOURCE_LABEL.integration],
              ["qase", SOURCE_LABEL.qase],
              ["import", SOURCE_LABEL.import],
              ["playwright", SOURCE_LABEL.playwright],
            ]}
          />

          <Select
            testId="test-case-filter-status"
            label="Status"
            value={status}
            onChange={setStatus}
            options={[
              ["all", "Todos"],
              ["draft", STATUS_LABEL.draft],
              ["active", STATUS_LABEL.active],
              ["review", STATUS_LABEL.review],
              ["obsolete", STATUS_LABEL.obsolete],
              ["archived", STATUS_LABEL.archived],
            ]}
          />

          <Select
            testId="test-case-filter-automation"
            label="Automação"
            value={automationStatus}
            onChange={setAutomationStatus}
            options={[
              ["all", "Todas"],
              ["none", AUTOMATION_LABEL.none],
              ["planned", AUTOMATION_LABEL.planned],
              ["ai_generated", AUTOMATION_LABEL.ai_generated],
              ["review", AUTOMATION_LABEL.review],
              ["approved", AUTOMATION_LABEL.approved],
              ["linked", AUTOMATION_LABEL.linked],
              ["stable", AUTOMATION_LABEL.stable],
              ["broken", AUTOMATION_LABEL.broken],
              ["disabled", AUTOMATION_LABEL.disabled],
            ]}
          />

          <Select
            testId="test-case-filter-priority"
            label="Prioridade"
            value={priorityFilter}
            onChange={setPriorityFilter}
            options={[
              ["all", "Todas"],
              ["low", PRIORITY_LABEL.low],
              ["medium", PRIORITY_LABEL.medium],
              ["high", PRIORITY_LABEL.high],
              ["critical", PRIORITY_LABEL.critical],
            ]}
          />

          <Select
            testId="test-case-filter-type"
            label="Tipo"
            value={typeFilter}
            onChange={setTypeFilter}
            options={[
              ["all", "Todos"],
              ["manual", TYPE_LABEL.manual],
              ["automated", TYPE_LABEL.automated],
              ["hybrid", TYPE_LABEL.hybrid],
            ]}
          />

          <button
            type="button"
            onClick={() => {
              setQuery("");
              setSource("all");
              setStatus("all");
              setAutomationStatus("all");
              setPriorityFilter("all");
              setTypeFilter("all");
              setExecutionFilter("all");
              setApplicationFilter("all");
              setModuleFilter("all");
              setProjectFilter("all");
              setSuiteFilter("all");
            }}
            className="min-h-9 self-end rounded-lg border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#ffffff)] px-3 text-xs font-bold text-[var(--tc-text,#0b1a3c)]"
          >
            Limpar
          </button>
        </div>
      </article>

      <div className="grid items-start gap-3 xl:grid-cols-[260px_minmax(420px,1fr)_360px] 2xl:grid-cols-[300px_minmax(0,1fr)_440px]">
        <aside data-testid="test-case-suite-tree" className="max-h-[calc(100vh-220px)] overflow-hidden rounded-2xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#ffffff)] p-3 xl:sticky xl:top-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--tc-text-muted,#6b7280)]">Repositório / Suites</p>
              <p className="mt-1 text-xs text-[var(--tc-text-secondary,#4b5563)]">{loading ? "Carregando..." : `${displayItems.length} caso(s) no filtro`}</p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--tc-text-muted,#6b7280)]">
              <FiFilter className="h-3.5 w-3.5" />
              QA
            </div>
          </div>

          <div className="mt-3 rounded-2xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] p-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--tc-text-muted,#6b7280)]">Projetos e suites</p>
              <button
                type="button"
                onClick={() => {
                  setProjectFilter("all");
                  setSuiteFilter("all");
                }}
                className="text-xs font-semibold text-[var(--tc-accent,#ef0001)]"
              >
                Limpar
              </button>
            </div>
            <label className="mt-2 block">
              <span className="sr-only">Buscar suite</span>
              <input
                value={suiteSearch}
                onChange={(event) => setSuiteSearch(event.target.value)}
                placeholder="Buscar suite"
                className="min-h-8 w-full rounded-lg border border-[var(--tc-border,#d7deea)] bg-[var(--tc-input-bg,#ffffff)] px-3 text-xs text-[var(--tc-text,#0b1a3c)] outline-none focus:border-[var(--tc-accent,#ef0001)]"
              />
            </label>
            {testProjectsWarning ? (
              <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
                {testProjectsWarning}
              </p>
            ) : null}
            {companySlug === "all" ? (
              <p className="mt-2 text-xs text-[var(--tc-text-muted,#6b7280)]">Selecione uma empresa para carregar integrações por aplicação.</p>
            ) : testProjectsLoading ? (
              <p className="mt-2 text-xs text-[var(--tc-text-muted,#6b7280)]">Carregando projetos vinculados...</p>
            ) : filteredTestProjects.length === 0 ? (
              <p className="mt-2 text-xs text-[var(--tc-text-muted,#6b7280)]">Nenhum projeto de casos vinculado para o contexto atual.</p>
            ) : (
              <div className="mt-3 max-h-[calc(100vh-360px)] space-y-2 overflow-auto pr-1">
                {filteredTestProjects.map((project) => {
                  const projectCode = project.code ?? "";
                  const activeProject = projectCode ? projectFilter === projectCode : false;
                  return (
                    <div key={project.id} className="rounded-xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#ffffff)] p-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          if (projectCode) setProjectFilter(projectCode);
                          setSuiteFilter("all");
                        }}
                        className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-bold ${
                          activeProject ? "border-l-2 border-[var(--tc-accent,#ef0001)] bg-[rgba(239,0,1,0.08)] text-[var(--tc-accent,#ef0001)]" : "text-[var(--tc-text,#0b1a3c)]"
                        }`}
                      >
                        <span className="min-w-0 truncate">{project.code ? `${project.code} - ${project.name}` : project.name}</span>
                        <span className="shrink-0 rounded-full bg-[var(--tc-surface-2,#f8fafc)] px-2 py-0.5 text-[10px] text-[var(--tc-text-muted,#6b7280)]">
                          {project.casesCount}
                        </span>
                      </button>
                      {project.suites.length ? (
                        <div className="mt-1 space-y-1 pl-3">
                          {project.suites.map((suite) => {
                            const activeSuite = suiteFilter === suite.id;
                            return (
                              <button
                                key={suite.id}
                                type="button"
                                onClick={() => {
                                  if (projectCode) setProjectFilter(projectCode);
                                  setSuiteFilter(suite.id);
                                }}
                                className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] font-semibold ${
                                  activeSuite ? "border-l-2 border-[var(--tc-accent,#ef0001)] bg-[rgba(239,0,1,0.08)] text-[var(--tc-accent,#ef0001)]" : "text-[var(--tc-text-secondary,#4b5563)]"
                                }`}
                              >
                                <span className="min-w-0 truncate">{suite.name}</span>
                                {suite.casesCount ? <span className="shrink-0">{suite.casesCount}</span> : null}
                              </button>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div data-testid="test-case-tree-legacy-table" className="hidden">
            <div data-testid="test-case-tree-legacy-list" className="space-y-2">
            {items.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--tc-border,#d7deea)] px-4 py-6 text-sm text-[var(--tc-text-muted,#6b7280)]">
                Nenhum caso encontrado para os filtros atuais.
              </div>
            ) : (
              items.map((record) => {
                const active = selected?.testCase.id === record.testCase.id;
                return (
                  <div key={record.testCase.id} data-testid="test-case-tree-legacy-row">
                    <button
                      data-testid="test-case-tree-legacy-card"
                      type="button"
                      onClick={() => setSelectedId(record.testCase.id)}
                      className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                        active
                          ? "border-[var(--tc-accent,#ef0001)] bg-[#fff5f5] shadow-[0_10px_24px_rgba(239,0,1,0.08)]"
                          : "border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] hover:border-[var(--tc-accent,#ef0001)]"
                      }`}
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--tc-text-muted,#6b7280)]">
                        <span data-testid="test-case-tree-legacy-key">{record.testCase.key}</span> • {SOURCE_LABEL[record.testCase.source] ?? record.testCase.source}
                      </p>
                      <h3 className="mt-1 wrap-break-word text-base font-black tracking-[-0.03em] text-[var(--tc-text,#0b1a3c)]">{record.testCase.title}</h3>
                      <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--tc-text-muted,#6b7280)]">
                        {[record.testCase.testProjectCode, record.testCase.suiteName].filter(Boolean).join(" / ") || "Sem projeto/suite"}
                      </p>
                      <p className="mt-2 text-sm text-[var(--tc-text-secondary,#4b5563)]">
                        {record.testCase.applicationId || "Sem aplicação"} / {record.testCase.moduleId || "Sem módulo"}
                      </p>
                    </button>
                  </div>
                );
              })
            )}
            </div>
          </div>
        </aside>

        <article data-testid="test-case-table" className="min-h-[420px] rounded-2xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#ffffff)]">
          <div className="flex min-h-12 flex-wrap items-center justify-between gap-2 border-b border-[var(--tc-border,#d7deea)] px-3 py-2">
            <div>
              <h2 className="text-sm font-black text-[var(--tc-text,#0b1a3c)]">Casos do repositório</h2>
              <p className="text-xs text-[var(--tc-text-secondary,#4b5563)]">{displayItems.length} registro(s) encontrados.</p>
            </div>
            {selectedBulkIds.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] px-3 py-1 text-xs font-bold text-[var(--tc-text,#0b1a3c)]">
                  {selectedBulkIds.length} selecionado(s)
                </span>
                <Link href={runHref} className="rounded-lg border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] px-3 py-1.5 text-xs font-bold text-[var(--tc-text,#0b1a3c)]">
                  Iniciar run
                </Link>
                <button type="button" onClick={() => void handleBulkStatus("review")} className="rounded-lg border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] px-3 py-1.5 text-xs font-bold text-[var(--tc-text,#0b1a3c)]">
                  Enviar para revisão
                </button>
                <button type="button" onClick={() => void handleBulkStatus("active")} className="rounded-lg border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] px-3 py-1.5 text-xs font-bold text-[var(--tc-text,#0b1a3c)]">
                  Alterar status
                </button>
                <button type="button" onClick={() => void handleBulkArchive()} className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 dark:border-rose-400/30 dark:bg-rose-500/10 dark:text-rose-100">
                  Arquivar
                </button>
              </div>
            ) : loading ? (
              <FiLoader className="h-4 w-4 animate-spin text-[var(--tc-text-muted,#6b7280)]" />
            ) : null}
          </div>

          <div data-testid="test-case-list" className="max-h-[calc(100vh-310px)] min-h-[360px] overflow-auto">
            {displayItems.length === 0 ? (
              <div className="m-3 rounded-2xl border border-dashed border-[var(--tc-border,#d7deea)] px-4 py-8 text-center text-sm text-[var(--tc-text-muted,#6b7280)]">
                Nenhum caso encontrado para os filtros atuais.
              </div>
            ) : (
              <table className="min-w-[980px] w-full border-separate border-spacing-0 text-left text-xs">
                <thead className="sticky top-0 z-10 bg-[var(--tc-surface-2,#f8fafc)] text-[10px] uppercase tracking-[0.14em] text-[var(--tc-text-muted,#6b7280)]">
                  <tr>
                    <th className="w-9 border-b border-[var(--tc-border,#d7deea)] px-3 py-2">
                      <input
                        type="checkbox"
                        aria-label="Selecionar todos os casos visíveis"
                        checked={displayItems.length > 0 && selectedBulkIds.length === displayItems.length}
                        onChange={(event) => toggleAllVisible(event.target.checked)}
                      />
                    </th>
                    <th className="border-b border-[var(--tc-border,#d7deea)] px-3 py-2">Código</th>
                    <th className="min-w-64 border-b border-[var(--tc-border,#d7deea)] px-3 py-2">Título</th>
                    <th className="border-b border-[var(--tc-border,#d7deea)] px-3 py-2">Status</th>
                    <th className="border-b border-[var(--tc-border,#d7deea)] px-3 py-2">Prioridade</th>
                    <th className="border-b border-[var(--tc-border,#d7deea)] px-3 py-2">Severidade</th>
                    <th className="border-b border-[var(--tc-border,#d7deea)] px-3 py-2">Tipo</th>
                    <th className="border-b border-[var(--tc-border,#d7deea)] px-3 py-2">Camada</th>
                    <th className="border-b border-[var(--tc-border,#d7deea)] px-3 py-2">Automação</th>
                    <th className="border-b border-[var(--tc-border,#d7deea)] px-3 py-2">Última execução</th>
                    <th className="border-b border-[var(--tc-border,#d7deea)] px-3 py-2">Atualizado em</th>
                  </tr>
                </thead>
                <tbody>
                  {displayItems.map((record) => {
                    const active = selected?.testCase.id === record.testCase.id;
                    const checked = selectedBulkIds.includes(record.testCase.id);
                    return (
                      <tr
                        key={record.testCase.id}
                        data-testid="test-case-row"
                        className={`transition ${
                          active
                            ? "bg-[rgba(239,0,1,0.08)] shadow-[inset_3px_0_0_var(--tc-accent,#ef0001)]"
                            : "hover:bg-[var(--tc-surface-2,#f8fafc)]"
                        }`}
                      >
                        <td className="border-b border-[var(--tc-border,#d7deea)] px-3 py-2 align-top">
                          <input
                            type="checkbox"
                            aria-label={`Selecionar ${record.testCase.key}`}
                            checked={checked}
                            onChange={(event) => toggleBulkSelection(record.testCase.id, event.target.checked)}
                          />
                        </td>
                        <td className="whitespace-nowrap border-b border-[var(--tc-border,#d7deea)] px-3 py-2 align-top font-bold text-[var(--tc-text,#0b1a3c)]">
                          <span data-testid="test-case-key">{record.testCase.key}</span>
                        </td>
                        <td className="border-b border-[var(--tc-border,#d7deea)] px-3 py-2 align-top">
                          <button
                            type="button"
                            data-testid="test-case-card"
                            onClick={() => setSelectedId(record.testCase.id)}
                            className="block max-w-[24rem] text-left"
                          >
                            <span className="block truncate font-bold text-[var(--tc-text,#0b1a3c)]">{record.testCase.title}</span>
                            <span className="mt-0.5 block truncate text-[11px] text-[var(--tc-text-muted,#6b7280)]">
                              {[record.testCase.testProjectCode, record.testCase.suiteName, record.testCase.moduleId].filter(Boolean).join(" / ") || "Sem projeto/suite"}
                            </span>
                          </button>
                        </td>
                        <td className="whitespace-nowrap border-b border-[var(--tc-border,#d7deea)] px-3 py-2 align-top">{STATUS_LABEL[record.testCase.status] ?? record.testCase.status}</td>
                        <td className="whitespace-nowrap border-b border-[var(--tc-border,#d7deea)] px-3 py-2 align-top">{PRIORITY_LABEL[record.testCase.priority] ?? record.testCase.priority}</td>
                        <td className="whitespace-nowrap border-b border-[var(--tc-border,#d7deea)] px-3 py-2 align-top">{PRIORITY_LABEL[record.testCase.severity || ""] ?? record.testCase.severity ?? "--"}</td>
                        <td className="whitespace-nowrap border-b border-[var(--tc-border,#d7deea)] px-3 py-2 align-top">{TYPE_LABEL[record.testCase.type] ?? record.testCase.type}</td>
                        <td className="whitespace-nowrap border-b border-[var(--tc-border,#d7deea)] px-3 py-2 align-top">{SOURCE_LABEL[record.testCase.source] ?? record.testCase.source}</td>
                        <td className="whitespace-nowrap border-b border-[var(--tc-border,#d7deea)] px-3 py-2 align-top">{AUTOMATION_LABEL[record.testCase.automationStatus] ?? record.testCase.automationStatus}</td>
                        <td className="whitespace-nowrap border-b border-[var(--tc-border,#d7deea)] px-3 py-2 align-top">{record.testCase.lastExecutionStatus ? EXECUTION_LABEL[record.testCase.lastExecutionStatus] ?? record.testCase.lastExecutionStatus : "Nunca"}</td>
                        <td className="whitespace-nowrap border-b border-[var(--tc-border,#d7deea)] px-3 py-2 align-top">{formatDateTime(record.testCase.updatedAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </article>

        <article data-testid="test-case-detail-panel" className="max-h-[calc(100vh-220px)] overflow-auto rounded-2xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#ffffff)] p-4 xl:sticky xl:top-4">
          <div data-testid="test-case-detail">
          {selected ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--tc-accent,#ef0001)]">{selected.testCase.key}</p>
                  <h2 data-testid="test-case-detail-title" className="mt-1 text-lg font-black tracking-[-0.02em] text-[var(--tc-text,#0b1a3c)]">{selected.testCase.title}</h2>
                  <p className="mt-2 text-xs leading-5 text-[var(--tc-text-secondary,#4b5563)]">{selected.testCase.description || "Sem descrição detalhada."}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/automacoes/playwright?testCaseId=${encodeURIComponent(selected.testCase.id)}`}
                    data-testid="test-case-automation-action"
                    className="inline-flex items-center gap-2 rounded-lg border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] px-3 py-1.5 text-xs font-semibold text-[var(--tc-text,#0b1a3c)]"
                  >
                    Automatizar
                  </Link>
                  <button
                    type="button"
                    onClick={() => openEditForm(selected)}
                    className="inline-flex items-center gap-2 rounded-lg border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] px-3 py-1.5 text-xs font-semibold text-[var(--tc-text,#0b1a3c)]"
                  >
                    <FiEdit2 className="h-4 w-4" />
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleArchive(selected)}
                    className="inline-flex items-center gap-2 rounded-lg border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] px-3 py-1.5 text-xs font-semibold text-[var(--tc-text,#0b1a3c)]"
                  >
                    <FiArchive className="h-4 w-4" />
                    Arquivar
                  </button>
                  <Link
                    href={runHref}
                    className="inline-flex items-center gap-2 rounded-lg bg-[var(--tc-primary,#011848)] px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    <FiPlay className="h-4 w-4" />
                    Iniciar run
                  </Link>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
                <Badge>{STATUS_LABEL[selected.testCase.status] ?? selected.testCase.status}</Badge>
                <Badge>{SOURCE_LABEL[selected.testCase.source] ?? selected.testCase.source}</Badge>
                <Badge>{AUTOMATION_LABEL[selected.testCase.automationStatus] ?? selected.testCase.automationStatus}</Badge>
                {selected.testCase.testProjectCode ? <Badge>Projeto {selected.testCase.testProjectCode}</Badge> : null}
                {selected.testCase.suiteName ? <Badge>Suite {selected.testCase.suiteName}</Badge> : null}
                {selected.testCase.externalUrl ? (
                  <a
                    href={selected.testCase.externalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex rounded-full border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] px-3 py-1 text-[var(--tc-accent,#ef0001)]"
                  >
                    Abrir origem
                  </a>
                ) : null}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <DrawerTabButton label="Caso" active={detailTab === "case"} onClick={() => setDetailTab("case")} testId="test-case-tab-case" />
                <DrawerTabButton label="Passos" active={detailTab === "steps"} onClick={() => setDetailTab("steps")} testId="test-case-tab-steps" />
                <DrawerTabButton label="Automação" active={detailTab === "automation"} onClick={() => setDetailTab("automation")} testId="test-case-tab-automation" />
                <DrawerTabButton label="Runs" active={detailTab === "runs"} onClick={() => setDetailTab("runs")} testId="test-case-tab-runs" />
                <DrawerTabButton label="Histórico" active={detailTab === "history"} onClick={() => setDetailTab("history")} testId="test-case-tab-history" />
              </div>

              {detailTab === "case" ? (
                <section className="mt-4 rounded-2xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] p-4 text-sm text-[var(--tc-text,#0b1a3c)]">
                  <p><strong>Objetivo:</strong> {selected.testCase.objective || "Não informado"}</p>
                  <p className="mt-2"><strong>Pré-condições:</strong> {selected.testCase.preconditions || "Não informado"}</p>
                  <p className="mt-2"><strong>Pós-condições:</strong> {selected.testCase.postconditions || "Não informado"}</p>
                  <p className="mt-2"><strong>Tags:</strong> {selected.testCase.tags.length ? selected.testCase.tags.join(", ") : "Sem tags"}</p>
                  <p className="mt-2"><strong>Projeto de casos:</strong> {selected.testCase.testProjectCode || selected.testCase.testProjectName || "Nao informado"}</p>
                  <p className="mt-2"><strong>Suite/Pasta:</strong> {selected.testCase.suiteName || selected.testCase.suiteId || "Nao informado"}</p>
                </section>
              ) : null}

              {detailTab === "steps" ? (
                <section className="mt-4">
                  <h3 className="text-sm font-black text-[var(--tc-text,#0b1a3c)]">Passos</h3>

                  <div data-testid="test-case-steps-list" className="mt-3 space-y-3">
                    {(selected.steps || []).map((step) => (
                      <div key={step.id} className="rounded-2xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] p-4">
                        <p className="text-xs font-bold text-[var(--tc-accent,#ef0001)]">Passo {step.order}</p>
                        <p className="mt-2 text-sm text-[var(--tc-text,#0b1a3c)]">
                          <strong>Ação:</strong> {step.action}
                        </p>
                        <p className="mt-1 text-sm text-[var(--tc-text,#0b1a3c)]">
                          <strong>Resultado esperado:</strong> {step.expectedResult}
                        </p>
                      </div>
                    ))}

                    {(!selected.steps || selected.steps.length === 0) ? (
                      <p className="text-sm text-[var(--tc-text-muted,#6b7280)]">Este caso ainda não possui passos cadastrados.</p>
                    ) : null}
                  </div>
                </section>
              ) : null}

              {detailTab === "automation" ? (
                <section data-testid="automation-panel" className="mt-4 rounded-2xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-black text-[var(--tc-text,#0b1a3c)]">Automação Playwright</h3>
                      <p className="mt-1 text-sm text-[var(--tc-text-secondary,#4b5563)]">
                        Camada técnica do mesmo caso. O vínculo não cria outro cadastro.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        data-testid="automation-generate-ai-button"
                        onClick={() => void handleGeneratePlaywrightDraft()}
                        disabled={generatingDraft}
                        className="inline-flex items-center gap-2 rounded-full border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#ffffff)] px-3 py-2 text-sm font-semibold text-[var(--tc-text,#0b1a3c)] disabled:opacity-60"
                      >
                        {generatingDraft ? <FiLoader className="h-4 w-4 animate-spin" /> : <FiCode className="h-4 w-4" />}
                        Gerar draft com IA
                      </button>
                      <Link
                        href={`/automacoes/playwright?testCaseId=${encodeURIComponent(selected.testCase.id)}`}
                        className="inline-flex items-center gap-2 rounded-full border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#ffffff)] px-3 py-2 text-sm font-semibold text-[var(--tc-text,#0b1a3c)]"
                      >
                        Vincular teste
                      </Link>
                    </div>
                  </div>

                  {selected.automationLink ? (
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <div className="rounded-2xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#ffffff)] p-3 text-sm text-[var(--tc-text,#0b1a3c)]">
                        <p><strong>Spec file:</strong> {selected.automationLink.specFile}</p>
                        <p className="mt-1"><strong>Test title:</strong> {selected.automationLink.testTitle || "Não informado"}</p>
                        <p className="mt-1"><strong>Project:</strong> {selected.automationLink.playwrightProject || "Não informado"}</p>
                      </div>
                      <div className="rounded-2xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#ffffff)] p-3 text-sm text-[var(--tc-text,#0b1a3c)]">
                        <p><strong>Status da automação:</strong> {AUTOMATION_LABEL[selected.testCase.automationStatus] ?? selected.automationLink.status}</p>
                        <p className="mt-1"><strong>Última execução:</strong> {formatDateTime(selected.testCase.lastExecutedAt)}</p>
                        <p className="mt-1"><strong>Último resultado:</strong> {selected.testCase.lastExecutionStatus ? EXECUTION_LABEL[selected.testCase.lastExecutionStatus] ?? selected.testCase.lastExecutionStatus : "Não executado"}</p>
                        <p className="mt-1"><strong>Tags:</strong> {selected.automationLink.tags.length ? selected.automationLink.tags.join(" ") : "Sem tags"}</p>
                        <p className="mt-1"><strong>Command:</strong> {selected.automationLink.command || "Não informado"}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 rounded-2xl border border-dashed border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#ffffff)] px-4 py-3 text-sm text-[var(--tc-text-secondary,#4b5563)]">
                      Este caso ainda não possui vínculo técnico com Playwright.
                    </div>
                  )}

                  <div className="mt-4 flex items-center justify-between">
                    <h4 className="text-sm font-black text-[var(--tc-text,#0b1a3c)]">Drafts IA</h4>
                    <button
                      type="button"
                      onClick={() => setDraftRefreshToken((current) => current + 1)}
                      className="inline-flex items-center gap-2 rounded-full border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#ffffff)] px-3 py-1.5 text-xs font-semibold text-[var(--tc-text,#0b1a3c)]"
                    >
                      <FiRefreshCcw className="h-3.5 w-3.5" />
                      Atualizar
                    </button>
                  </div>

                  {loadingDrafts ? (
                    <p className="mt-2 text-sm text-[var(--tc-text-secondary,#4b5563)]">Carregando drafts...</p>
                  ) : drafts.length === 0 ? (
                    <p className="mt-2 text-sm text-[var(--tc-text-secondary,#4b5563)]">Nenhum draft gerado para este caso.</p>
                  ) : (
                    <div className="mt-3 space-y-3">
                      {drafts.map((draft) => (
                        <div key={draft.id} data-testid="automation-draft-preview" className="rounded-2xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#ffffff)] p-3 text-sm text-[var(--tc-text,#0b1a3c)]">
                          <p><strong>ID:</strong> {draft.id}</p>
                          <p><strong>Status:</strong> {draft.status}</p>
                          <p><strong>Maturidade:</strong> {AUTOMATION_LABEL[draft.maturityStatus || ""] ?? draft.maturityStatus ?? "n/a"}</p>
                          <p><strong>Aprovação:</strong> {APPROVAL_LABEL[draft.approvalState || "none"] ?? draft.approvalState ?? "n/a"}</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <TransitionBadge label="approved" active={draft.status === "approved" || draft.status === "linked"} />
                            <TransitionBadge label="linked" active={draft.status === "linked"} />
                            <TransitionBadge label="published" active={draft.githubPublication?.status === "published"} />
                          </div>
                          {draft.qualityScore ? (
                            <div className="mt-2 rounded-xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] p-2 text-xs">
                              <p><strong>Quality score:</strong> {draft.qualityScore.totalScore}</p>
                              <p className="mt-1">
                                locators={draft.qualityScore.locators} • assertions={draft.qualityScore.assertions} • traceability={draft.qualityScore.traceability}
                              </p>
                              <p className="mt-1">
                                flakiness={draft.qualityScore.flakinessRisk} • security={draft.qualityScore.security}
                              </p>
                            </div>
                          ) : null}
                          <p className="mt-1"><strong>Spec:</strong> {draft.specFile || "Não informado"}</p>
                          <p className="mt-1"><strong>POM:</strong> {draft.pomPath || "Não informado"}</p>
                          <p className="mt-1"><strong>Command:</strong> {draft.command || "Não informado"}</p>
                          {draft.githubPublication ? (
                            <p className="mt-1">
                              <strong>GitHub:</strong> {draft.githubPublication.status}
                              {draft.githubPublication.pullRequestUrl ? ` • ${draft.githubPublication.pullRequestUrl}` : ""}
                            </p>
                          ) : null}
                          {draft.reviewNotes ? <p className="mt-2 text-[var(--tc-text-secondary,#4b5563)]">{draft.reviewNotes}</p> : null}

                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => void handleDraftAction(draft.id, "approve")}
                              className="rounded-full border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] px-3 py-1 text-xs font-semibold"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDraftAction(draft.id, "link")}
                              className="rounded-full border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] px-3 py-1 text-xs font-semibold"
                            >
                              Vincular draft
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDraftAction(draft.id, "discard")}
                              className="rounded-full border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] px-3 py-1 text-xs font-semibold"
                            >
                              Discard
                            </button>
                            <button
                              type="button"
                              onClick={() => void handlePublishDraftGithub(draft)}
                              className="rounded-full border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] px-3 py-1 text-xs font-semibold"
                            >
                              Publicar no GitHub
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleReviewDraft(draft.id)}
                              className="rounded-full border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] px-3 py-1 text-xs font-semibold"
                            >
                              Review
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleApprovalAction(draft.id, "request_qa_review")}
                              className="rounded-full border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] px-3 py-1 text-xs font-semibold"
                            >
                              QA Review
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleApprovalAction(draft.id, "approve_publish")}
                              className="rounded-full border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] px-3 py-1 text-xs font-semibold"
                            >
                              Aprovar publicação
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleApprovalAction(draft.id, "approve_execution")}
                              className="rounded-full border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] px-3 py-1 text-xs font-semibold"
                            >
                              Aprovar execução
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleApprovalAction(draft.id, "approve_healing")}
                              className="rounded-full border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] px-3 py-1 text-xs font-semibold"
                            >
                              Aprovar healing
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleHealDraft(draft.id)}
                              className="rounded-full border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] px-3 py-1 text-xs font-semibold"
                            >
                              Heal
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {draftError ? <p className="mt-3 text-sm font-semibold text-rose-700">{draftError}</p> : null}

                  <section className="mt-4 rounded-2xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#ffffff)] p-3">
                    <h5 className="text-sm font-black text-[var(--tc-text,#0b1a3c)]">Assistente QA (terminal inicial)</h5>
                    <p className="mt-1 text-xs text-[var(--tc-text-secondary,#4b5563)]">
                      Comandos: gerar, aprovar &lt;draftId&gt;, vincular &lt;draftId&gt;, descartar &lt;draftId&gt;, publicar &lt;draftId&gt;, review &lt;draftId&gt;, heal &lt;draftId&gt;, approval &lt;draftId&gt; review|publish|execution|healing|reset
                    </p>

                    <div className="mt-3 max-h-56 space-y-2 overflow-auto rounded-xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] p-3 text-xs">
                      {assistantLogs.length === 0 ? (
                        <p className="text-[var(--tc-text-secondary,#4b5563)]">Sem comandos executados nesta sessão.</p>
                      ) : (
                        assistantLogs.map((entry) => (
                          <p key={entry.id}>
                            <strong>{entry.role === "user" ? ">" : "assistente:"}</strong> {entry.message}
                          </p>
                        ))
                      )}
                    </div>

                    <div className="mt-3 flex gap-2">
                      <input
                        value={assistantInput}
                        onChange={(event) => setAssistantInput(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            void handleAssistantCommandSubmit();
                          }
                        }}
                        placeholder="Digite um comando do assistente"
                        className="min-h-10 flex-1 rounded-xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-input-bg,#ffffff)] px-3 text-sm text-[var(--tc-text,#0b1a3c)]"
                      />
                      <button
                        type="button"
                        onClick={() => void handleAssistantCommandSubmit()}
                        disabled={assistantBusy}
                        className="rounded-xl bg-[var(--tc-primary,#011848)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        {assistantBusy ? "Executando..." : "Executar"}
                      </button>
                    </div>

                    {agentRuns.length > 0 ? (
                      <div className="mt-3 rounded-xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] p-3 text-xs">
                        <p className="font-semibold text-[var(--tc-text,#0b1a3c)]">Timeline de agentes</p>
                        <div className="mt-2 space-y-1 text-[var(--tc-text-secondary,#4b5563)]">
                          {agentRuns.slice(0, 8).map((run) => (
                            <p key={run.id}>
                              [{hydrated ? new Date(run.createdAt).toLocaleTimeString("pt-BR") : "--:--:--"}] {run.agentName} - {run.status}
                            </p>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </section>
                </section>
              ) : null}

              {detailTab === "runs" ? (
                <section className="mt-4 rounded-2xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] p-4 text-sm text-[var(--tc-text,#0b1a3c)]">
                  <h3 className="text-sm font-black">Últimas execuções</h3>
                  <div className="mt-3 grid gap-2">
                    <div className="rounded-xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#ffffff)] p-3">
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--tc-text-muted,#6b7280)]">Resultado mais recente</p>
                      <p className="mt-1 font-semibold">
                        {selected.testCase.lastExecutionStatus
                          ? EXECUTION_LABEL[selected.testCase.lastExecutionStatus] ?? selected.testCase.lastExecutionStatus
                          : "Nunca executado"}
                      </p>
                      <p className="mt-1 text-xs text-[var(--tc-text-secondary,#4b5563)]">
                        Ambiente: {selected.automationLink?.playwrightProject || "Não informado"} · Data: {formatDateTime(selected.testCase.lastExecutedAt)}
                      </p>
                    </div>
                    {agentRuns.slice(0, 4).map((run) => (
                      <div key={run.id} className="rounded-xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#ffffff)] p-3">
                        <p className="font-semibold">{run.agentName}</p>
                        <p className="mt-1 text-xs text-[var(--tc-text-secondary,#4b5563)]">
                          Resultado: {run.status} · Ambiente: automação · Data: {formatDateTime(run.createdAt)}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              {detailTab === "history" ? (
                <section className="mt-4 rounded-2xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] p-4 text-sm text-[var(--tc-text,#0b1a3c)]">
                  <h3 className="text-sm font-black">Histórico</h3>
                  <div className="mt-3 space-y-2">
                    <p className="rounded-xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#ffffff)] p-3">
                      Criado em {formatDateTime(selected.testCase.createdAt)} por {selected.testCase.createdBy || "sistema"}.
                    </p>
                    <p className="rounded-xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#ffffff)] p-3">
                      Última atualização em {formatDateTime(selected.testCase.updatedAt)}.
                    </p>
                    {(selected.versions ?? []).slice(0, 4).map((version) => (
                      <p key={version.id} className="rounded-xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#ffffff)] p-3">
                        Versão {version.version} registrada no repositório.
                      </p>
                    ))}
                  </div>
                </section>
              ) : null}
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-[var(--tc-border,#d7deea)] px-4 py-6 text-sm text-[var(--tc-text-muted,#6b7280)]">
              Selecione um caso para visualizar os detalhes.
            </div>
          )}
          </div>
        </article>
      </div>

      {isImportPanelOpen ? (
        <div className="fixed inset-0 z-50 overflow-auto bg-black/50 p-4 backdrop-blur-sm">
          <div className="mx-auto max-w-6xl">
            <div className="mb-3 flex justify-end">
              <button
                type="button"
                onClick={() => setIsImportPanelOpen(false)}
                aria-label="Fechar importação"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white text-[#011848] shadow-xl"
              >
                <FiX className="h-4 w-4" />
              </button>
            </div>
            <TestCaseRepositoryImportExportPanel initialCompanySlug={companySlug !== "all" ? companySlug : undefined} />
          </div>
        </div>
      ) : null}

      {isFormOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div data-testid="test-case-create-modal" className="max-h-[90vh] w-full max-w-4xl overflow-auto rounded-3xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#ffffff)] p-5 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--tc-accent,#ef0001)]">
                  {editingId
                    ? "Editar caso"
                    : createMode === "automated"
                      ? "Novo caso automatizado"
                      : createMode === "ai"
                        ? "Novo caso com IA"
                        : "Novo caso"}
                </p>
                <h3 className="mt-1 text-2xl font-black tracking-[-0.03em] text-[var(--tc-text,#0b1a3c)]">
                  {editingId
                    ? "Atualizar caso de teste"
                    : createMode === "automated"
                      ? "Criar caso automatizado Playwright"
                      : createMode === "ai"
                        ? "Criar caso base + draft IA"
                        : "Criar caso de teste"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                aria-label="Fechar formulário"
                title="Fechar formulário"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--tc-border,#d7deea)] text-[var(--tc-text,#0b1a3c)]"
              >
                <FiX className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <Field testId="test-case-title-input" label="Título" value={form.title} onChange={(value) => setForm((current) => ({ ...current, title: value }))} />
              <Field label="Empresa / companySlug" value={form.companySlug} onChange={(value) => setForm((current) => ({ ...current, companySlug: value }))} />
              <Field label="Aplicação" value={form.applicationId} onChange={(value) => setForm((current) => ({ ...current, applicationId: value }))} />
              <Field label="Módulo" value={form.moduleId} onChange={(value) => setForm((current) => ({ ...current, moduleId: value }))} />
              <Select label="Origem" value={form.source} onChange={(value) => setForm((current) => ({ ...current, source: value }))} options={[
                ["manual", SOURCE_LABEL.manual],
                ["local", SOURCE_LABEL.local],
                ["automation", SOURCE_LABEL.automation],
                ["integration", SOURCE_LABEL.integration],
                ["qase", SOURCE_LABEL.qase],
                ["import", SOURCE_LABEL.import],
                ["playwright", SOURCE_LABEL.playwright],
              ]} />
              <Select label="Tipo" value={form.type} onChange={(value) => setForm((current) => ({ ...current, type: value }))} options={[
                ["manual", "Manual"],
                ["automated", "Automatizado"],
                ["hybrid", "Híbrido"],
              ]} />
              <Select label="Status" value={form.status} onChange={(value) => setForm((current) => ({ ...current, status: value }))} options={[
                ["draft", STATUS_LABEL.draft],
                ["active", STATUS_LABEL.active],
                ["review", STATUS_LABEL.review],
                ["obsolete", STATUS_LABEL.obsolete],
                ["archived", STATUS_LABEL.archived],
              ]} />
              <Select label="Prioridade" value={form.priority} onChange={(value) => setForm((current) => ({ ...current, priority: value }))} options={[
                ["low", "Baixa"],
                ["medium", "Média"],
                ["high", "Alta"],
                ["critical", "Crítica"],
              ]} />
              <Select label="Automação" value={form.automationStatus} onChange={(value) => setForm((current) => ({ ...current, automationStatus: value }))} options={[
                ["none", AUTOMATION_LABEL.none],
                ["planned", AUTOMATION_LABEL.planned],
                ["ai_generated", AUTOMATION_LABEL.ai_generated],
                ["review", AUTOMATION_LABEL.review],
                ["approved", AUTOMATION_LABEL.approved],
                ["linked", AUTOMATION_LABEL.linked],
                ["published", AUTOMATION_LABEL.published],
                ["running", AUTOMATION_LABEL.running],
                ["stable", AUTOMATION_LABEL.stable],
                ["broken", AUTOMATION_LABEL.broken],
                ["disabled", AUTOMATION_LABEL.disabled],
              ]} />
              <Field label="Tags" value={form.tags} onChange={(value) => setForm((current) => ({ ...current, tags: value }))} placeholder="tag1, tag2, tag3" />
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <TextAreaField testId="test-case-description-input" label="Descrição" value={form.description} onChange={(value) => setForm((current) => ({ ...current, description: value }))} />
              <TextAreaField label="Objetivo" value={form.objective} onChange={(value) => setForm((current) => ({ ...current, objective: value }))} />
              <TextAreaField testId="test-case-preconditions-input" label="Pré-condições" value={form.preconditions} onChange={(value) => setForm((current) => ({ ...current, preconditions: value }))} />
              <TextAreaField label="Pós-condições" value={form.postconditions} onChange={(value) => setForm((current) => ({ ...current, postconditions: value }))} />
            </div>

            {(form.type === "automated" || form.type === "hybrid" || createMode !== "manual") ? (
              <section className="mt-6 rounded-2xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] p-4">
                <h4 className="text-sm font-black text-[var(--tc-text,#0b1a3c)]">Automação Playwright</h4>
                <p className="mt-1 text-sm text-[var(--tc-text-secondary,#4b5563)]">
                  Mesmo caso, mesma estrutura base. O vínculo Playwright é adicionado sem duplicar cadastro.
                </p>

                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  <Field label="Spec file" value={form.automationSpecFile} onChange={(value) => setForm((current) => ({ ...current, automationSpecFile: value }))} placeholder="tests-e2e/repository/tc-001.spec.ts" />
                  <Field label="Test title" value={form.automationTestTitle} onChange={(value) => setForm((current) => ({ ...current, automationTestTitle: value }))} placeholder="deve validar fluxo principal" />
                  <Field label="Project" value={form.automationProject} onChange={(value) => setForm((current) => ({ ...current, automationProject: value }))} placeholder="chromium" />
                  <Field label="Tags" value={form.automationTags} onChange={(value) => setForm((current) => ({ ...current, automationTags: value }))} placeholder="@tc-001 @smoke" />
                </div>

                <div className="mt-3">
                  <TextAreaField label="Command" value={form.automationCommand} onChange={(value) => setForm((current) => ({ ...current, automationCommand: value }))} />
                </div>
              </section>
            ) : null}

            <section className="mt-6">
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-sm font-black text-[var(--tc-text,#0b1a3c)]">Passos</h4>
                <button
                  type="button"
                  onClick={addStep}
                  data-testid="test-case-add-step-button"
                  className="inline-flex items-center gap-2 rounded-full border border-[var(--tc-border,#d7deea)] px-3 py-2 text-sm font-semibold text-[var(--tc-text,#0b1a3c)]"
                >
                  <FiPlus className="h-4 w-4" />
                  Adicionar passo
                </button>
              </div>

              <div className="mt-3 space-y-3">
                {form.steps.map((step, index) => (
                  <div key={`${index}-${step.action}`} className="rounded-2xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="text-xs font-bold uppercase tracking-[0.24em] text-[var(--tc-accent,#ef0001)]">Passo {index + 1}</p>
                      <button
                        type="button"
                        onClick={() => removeStep(index)}
                        className="inline-flex items-center gap-1 rounded-full border border-[var(--tc-border,#d7deea)] px-3 py-1 text-xs font-semibold text-[var(--tc-text,#0b1a3c)]"
                      >
                        <FiTrash2 className="h-3.5 w-3.5" />
                        Remover
                      </button>
                    </div>
                    <div className="grid gap-3 lg:grid-cols-2">
                      <Field testId={index === 0 ? "test-case-step-action-input" : undefined} label="Ação" value={step.action} onChange={(value) => updateStep(index, "action", value)} />
                      <Field testId={index === 0 ? "test-case-step-expected-input" : undefined} label="Resultado esperado" value={step.expectedResult} onChange={(value) => updateStep(index, "expectedResult", value)} />
                      <Field label="Dados" value={step.data} onChange={(value) => updateStep(index, "data", value)} />
                      <Field label="Observações" value={step.notes} onChange={(value) => updateStep(index, "notes", value)} />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {formError ? <p className="mt-4 text-sm font-semibold text-rose-700">{formError}</p> : null}

            <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-[var(--tc-border,#d7deea)] pt-4">
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--tc-border,#d7deea)] px-4 py-2 text-sm font-semibold text-[var(--tc-text,#0b1a3c)]"
              >
                <FiX className="h-4 w-4" />
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                data-testid="test-case-save-button"
                className="inline-flex items-center gap-2 rounded-full bg-[var(--tc-primary,#011848)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                <FiSave className="h-4 w-4" />
                {saving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function Metric({
  label,
  value,
  suffix,
  icon,
  active = false,
  onClick,
}: {
  label: string;
  value: number | string;
  suffix?: string;
  icon: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-3 py-2 text-left transition ${
        active
          ? "border-[var(--tc-accent,#ef0001)] bg-[rgba(239,0,1,0.08)]"
          : "border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#ffffff)] hover:border-[var(--tc-accent,#ef0001)]"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--tc-text-muted,#6b7280)]">{label}</p>
        <span className="text-[var(--tc-accent,#ef0001)]">{icon}</span>
      </div>
      <p className="mt-1 text-lg font-black tracking-[-0.03em] text-[var(--tc-text,#0b1a3c)]">{value}{suffix ?? ""}</p>
    </button>
  );
}

function QuickViewButton({
  active,
  label,
  note,
  onClick,
}: {
  active: boolean;
  label: string;
  note: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border px-4 py-3 text-left transition ${
        active
          ? "border-[var(--tc-accent,#ef0001)] bg-[rgba(239,0,1,0.08)] shadow-[0_10px_24px_rgba(239,0,1,0.08)]"
          : "border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] hover:border-[var(--tc-accent,#ef0001)]"
      }`}
    >
      <p className="text-sm font-black tracking-[-0.02em] text-[var(--tc-text,#0b1a3c)]">{label}</p>
      <p className="mt-1 text-xs text-[var(--tc-text-secondary,#4b5563)]">{note}</p>
    </button>
  );
}

function InsightRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "neutral" | "warn" | "danger";
}) {
  const toneClass =
    tone === "danger"
      ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-100 dark:border-rose-400/30"
      : tone === "warn"
        ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-100 dark:border-amber-400/30"
        : "bg-[var(--tc-surface,#ffffff)] text-[var(--tc-text,#0b1a3c)] border-[var(--tc-border,#d7deea)]";

  return (
    <div className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 ${toneClass}`}>
      <span className="text-sm font-semibold">{label}</span>
      <span className="text-lg font-black tracking-[-0.03em]">{value}</span>
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
  testId,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
  testId?: string;
}) {
  return (
    <label className="grid gap-1 text-xs font-semibold text-[var(--tc-text,#0b1a3c)]">
      {label}
      <select
        data-testid={testId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-9 rounded-lg border border-[var(--tc-border,#d7deea)] bg-[var(--tc-input-bg,#ffffff)] px-3 text-xs text-[var(--tc-text,#0b1a3c)] outline-none transition focus:border-[var(--tc-accent,#ef0001)]"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  testId,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  testId?: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-[var(--tc-text,#0b1a3c)]">
      {label}
      <input
        data-testid={testId}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 rounded-2xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-input-bg,#ffffff)] px-4 text-sm text-[var(--tc-text,#0b1a3c)] outline-none transition focus:border-[var(--tc-accent,#ef0001)]"
      />
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  testId,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  testId?: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-[var(--tc-text,#0b1a3c)]">
      {label}
      <textarea
        data-testid={testId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        className="rounded-2xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-input-bg,#ffffff)] px-4 py-3 text-sm text-[var(--tc-text,#0b1a3c)] outline-none transition focus:border-[var(--tc-accent,#ef0001)]"
      />
    </label>
  );
}

function DrawerTabButton({
  label,
  active,
  onClick,
  testId,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  testId?: string;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
        active
          ? "border-[var(--tc-accent,#ef0001)] bg-[rgba(239,0,1,0.08)] text-[var(--tc-accent,#ef0001)]"
          : "border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#ffffff)] text-[var(--tc-text,#0b1a3c)]"
      }`}
    >
      {label}
    </button>
  );
}

function TransitionBadge({ label, active }: { label: string; active: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] ${
        active
          ? "border-[var(--tc-accent,#ef0001)] bg-[rgba(239,0,1,0.08)] text-[var(--tc-accent,#ef0001)]"
          : "border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] text-[var(--tc-text-muted,#6b7280)]"
      }`}
    >
      {label}
    </span>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex rounded-full border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] px-3 py-1 text-[var(--tc-text,#0b1a3c)]">{children}</span>;
}
