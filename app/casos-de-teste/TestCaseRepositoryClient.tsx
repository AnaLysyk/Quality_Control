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
  FiLayers,
  FiLoader,
  FiPlus,
  FiRefreshCcw,
  FiSave,
  FiSearch,
  FiShield,
  FiTrash2,
  FiX,
} from "react-icons/fi";
import { useAppShellCoverSlot } from "@/components/AppShellCoverSlotContext";
import { fetchApi } from "@/lib/api";
import { useAuthUser } from "@/hooks/useAuthUser";
import { useClientContext } from "@/context/ClientContext";
import { useProjectContext } from "@/lib/core/project/ProjectContext";

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

export default function TestCaseRepositoryClient() {
  const { user, normalizedUser } = useAuthUser();
  const { activeClientSlug } = useClientContext();
  const { activeProject: selectedProject } = useProjectContext();
  const [hydrated, setHydrated] = useState(false);
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("all");
  const [status, setStatus] = useState("all");
  const [automationStatus, setAutomationStatus] = useState("all");
  const [applicationFilter, setApplicationFilter] = useState("all");
  const [moduleFilter, setModuleFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [suiteFilter, setSuiteFilter] = useState("all");
  const [companySlug, setCompanySlug] = useState("all");
  const [items, setItems] = useState<TestCaseRecord[]>([]);
  const [testProjects, setTestProjects] = useState<TestProject[]>([]);
  const [testProjectsWarning, setTestProjectsWarning] = useState<string | null>(null);
  const [testProjectsLoading, setTestProjectsLoading] = useState(false);
  const [metrics, setMetrics] = useState<ApiResponse["metrics"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<"case" | "steps" | "automation" | "runs" | "history">("case");
  const [isCreateMenuOpen, setIsCreateMenuOpen] = useState(false);
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
  const canViewCompanyFilter =
    user?.isGlobalAdmin === true ||
    ["leader_tc", "technical_support", "admin"].includes(roleKey.toLowerCase());
  const defaultCompanyForCreate =
    companySlug !== "all"
      ? companySlug
      : activeClientSlug || normalizedUser.primaryCompanySlug || normalizedUser.companySlugs[0] || "";

  const selected = useMemo(
    () => items.find((item) => item.testCase.id === selectedId) ?? items[0] ?? null,
    [items, selectedId],
  );

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
    if (canViewCompanyFilter) return;
    const fixedCompany = activeClientSlug || normalizedUser.primaryCompanySlug || normalizedUser.companySlugs[0] || "all";
    setCompanySlug(fixedCompany);
  }, [activeClientSlug, canViewCompanyFilter, normalizedUser.companySlugs, normalizedUser.primaryCompanySlug]);

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
  }, [applicationFilter, automationStatus, companySlug, moduleFilter, projectFilter, query, selectedProject, source, status, suiteFilter]);

  useEffect(() => {
    if (!selectedId && items[0]) setSelectedId(items[0].testCase.id);
  }, [items, selectedId]);

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
    if (detailTab !== "automation" || !selected?.testCase.id) return;
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
      className="space-y-4 rounded-4xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#ffffff)] p-5 shadow-sm sm:p-6"
    >
      <header data-testid="test-case-header" className="rounded-3xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] p-4 shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[var(--tc-accent,#ef0001)]">Repositório de Casos de Teste</p>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-black tracking-[-0.04em] text-[var(--tc-text,#0b1a3c)] sm:text-2xl">Fonte central dos casos da operação QA</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--tc-text-secondary,#4b5563)]">
              Fonte oficial dos casos manuais, integrados e automatizados. Planos, runs e Playwright apenas vinculam casos daqui.
            </p>
            <p
              data-testid="test-case-context-chip"
              className="mt-3 inline-flex items-center rounded-full border border-[var(--tc-border,#d7deea)] bg-white px-3 py-1 text-xs font-bold text-[var(--tc-text,#0b1a3c)]"
            >
              {roleLabel}
              {companySlug !== "all" ? ` - ${companySlug}` : ""}
            </p>
          </div>

          <div className="flex items-center gap-2">
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
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--tc-border,#d7deea)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--tc-text,#0b1a3c)] transition hover:border-[rgba(1,24,72,0.3)] hover:text-[var(--tc-primary,#011848)]"
            >
              ðŸ§  Perguntar IA
            </button>
            <div className="relative">
            <button
              type="button"
              onClick={() => setIsCreateMenuOpen((current) => !current)}
              data-testid="test-case-new-button"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[var(--tc-primary,#011848)] px-4 py-2 text-sm font-bold text-white"
            >
              <FiPlus className="h-4 w-4" />
              Novo
              <FiChevronDown className="h-4 w-4" />
            </button>

            {isCreateMenuOpen ? (
              <div data-testid="test-case-new-menu" className="absolute right-0 z-20 mt-2 w-64 rounded-2xl border border-[var(--tc-border,#d7deea)] bg-white p-2 shadow-xl">
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
          </div>
        </div>
      </header>

      <div className="grid gap-3 md:grid-cols-4">
        <Metric label="Total" value={metrics?.total ?? 0} icon={<FiClipboard />} />
        <Metric label="Automatizados" value={metrics?.automated ?? 0} icon={<FiCheckCircle />} />
        <Metric label="Sem automação" value={metrics?.withoutAutomation ?? 0} icon={<FiShield />} />
        <Metric label="Nunca executados" value={metrics?.neverExecuted ?? 0} icon={<FiFilter />} />
      </div>

      <article className="rounded-[28px] border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
          <label className="grid gap-2 text-sm font-semibold text-[var(--tc-text,#0b1a3c)]">
            Buscar
            <span className="relative">
              <FiSearch className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-[var(--tc-text-muted,#6b7280)]" />
              <input
                data-testid="test-case-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Código, título, tag, aplicação ou módulo"
                className="min-h-11 w-full rounded-2xl border border-[var(--tc-border,#d7deea)] bg-white pr-4 pl-11 text-sm outline-none transition focus:border-[var(--tc-accent,#ef0001)]"
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
        </div>
      </article>

      <div className="grid items-start gap-4 xl:grid-cols-12">
        <aside data-testid="test-case-suite-tree" className="rounded-[28px] border border-[var(--tc-border,#d7deea)] bg-white p-4 xl:col-span-4 xl:sticky xl:top-6 2xl:col-span-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--tc-text-muted,#6b7280)]">Casos</p>
              <p className="mt-2 text-sm text-[var(--tc-text-secondary,#4b5563)]">{loading ? "Carregando..." : `${items.length} resultado(s)`}</p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--tc-text-muted,#6b7280)]">
              <FiFilter className="h-3.5 w-3.5" />
              QA
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] p-3">
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
            {testProjectsWarning ? (
              <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
                {testProjectsWarning}
              </p>
            ) : null}
            {companySlug === "all" ? (
              <p className="mt-2 text-xs text-[var(--tc-text-muted,#6b7280)]">Selecione uma empresa para carregar integrações por aplicação.</p>
            ) : testProjectsLoading ? (
              <p className="mt-2 text-xs text-[var(--tc-text-muted,#6b7280)]">Carregando projetos vinculados...</p>
            ) : testProjects.length === 0 ? (
              <p className="mt-2 text-xs text-[var(--tc-text-muted,#6b7280)]">Nenhum projeto de casos vinculado para o contexto atual.</p>
            ) : (
              <div className="mt-3 space-y-3">
                {testProjects.map((project) => {
                  const projectCode = project.code ?? "";
                  const activeProject = projectCode ? projectFilter === projectCode : false;
                  return (
                    <div key={project.id} className="rounded-xl border border-[var(--tc-border,#d7deea)] bg-white p-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (projectCode) setProjectFilter(projectCode);
                          setSuiteFilter("all");
                        }}
                        className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-left text-sm font-bold ${
                          activeProject ? "bg-[#fff5f5] text-[var(--tc-accent,#ef0001)]" : "text-[var(--tc-text,#0b1a3c)]"
                        }`}
                      >
                        <span className="min-w-0 truncate">{project.code ? `${project.code} - ${project.name}` : project.name}</span>
                        <span className="shrink-0 rounded-full bg-[var(--tc-surface-2,#f8fafc)] px-2 py-0.5 text-[10px] text-[var(--tc-text-muted,#6b7280)]">
                          {project.casesCount}
                        </span>
                      </button>
                      {project.suites.length ? (
                        <div className="mt-1 space-y-1 pl-3">
                          {project.suites.slice(0, 8).map((suite) => {
                            const activeSuite = suiteFilter === suite.id;
                            return (
                              <button
                                key={suite.id}
                                type="button"
                                onClick={() => {
                                  if (projectCode) setProjectFilter(projectCode);
                                  setSuiteFilter(suite.id);
                                }}
                                className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-semibold ${
                                  activeSuite ? "bg-[#fff5f5] text-[var(--tc-accent,#ef0001)]" : "text-[var(--tc-text-secondary,#4b5563)]"
                                }`}
                              >
                                <span className="min-w-0 truncate">{suite.name}</span>
                                {suite.casesCount ? <span className="shrink-0">{suite.casesCount}</span> : null}
                              </button>
                            );
                          })}
                          {project.suites.length > 8 ? (
                            <p className="px-2 py-1 text-[11px] font-semibold text-[var(--tc-text-muted,#6b7280)]">
                              +{project.suites.length - 8} suite(s)
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div data-testid="test-case-table" className="mt-4 space-y-2">
            <div data-testid="test-case-list" className="space-y-2">
            {items.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--tc-border,#d7deea)] px-4 py-6 text-sm text-[var(--tc-text-muted,#6b7280)]">
                Nenhum caso encontrado para os filtros atuais.
              </div>
            ) : (
              items.map((record) => {
                const active = selected?.testCase.id === record.testCase.id;
                return (
                  <div key={record.testCase.id} data-testid="test-case-row">
                    <button
                      data-testid="test-case-card"
                      type="button"
                      onClick={() => setSelectedId(record.testCase.id)}
                      className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                        active
                          ? "border-[var(--tc-accent,#ef0001)] bg-[#fff5f5] shadow-[0_10px_24px_rgba(239,0,1,0.08)]"
                          : "border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] hover:border-[var(--tc-accent,#ef0001)]"
                      }`}
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--tc-text-muted,#6b7280)]">
                        <span data-testid="test-case-key">{record.testCase.key}</span> • {SOURCE_LABEL[record.testCase.source] ?? record.testCase.source}
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

        <article data-testid="test-case-detail-panel" className="rounded-[28px] border border-[var(--tc-border,#d7deea)] bg-white p-5 xl:col-span-8 2xl:col-span-9">
          <div data-testid="test-case-detail">
          {selected ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--tc-accent,#ef0001)]">Caso selecionado</p>
                  <h2 data-testid="test-case-detail-title" className="mt-2 text-2xl font-black tracking-[-0.03em] text-[var(--tc-text,#0b1a3c)]">{selected.testCase.title}</h2>
                  <p className="mt-2 text-sm text-[var(--tc-text-secondary,#4b5563)]">{selected.testCase.description || "Sem descrição detalhada."}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/automacoes/playwright?testCaseId=${encodeURIComponent(selected.testCase.id)}`}
                    data-testid="test-case-automation-action"
                    className="inline-flex items-center gap-2 rounded-full border border-[var(--tc-border,#d7deea)] bg-white px-3 py-2 text-sm font-semibold text-[var(--tc-text,#0b1a3c)]"
                  >
                    Automatizar
                  </Link>
                  <button
                    type="button"
                    onClick={() => openEditForm(selected)}
                    className="inline-flex items-center gap-2 rounded-full border border-[var(--tc-border,#d7deea)] bg-white px-3 py-2 text-sm font-semibold text-[var(--tc-text,#0b1a3c)]"
                  >
                    <FiEdit2 className="h-4 w-4" />
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleArchive(selected)}
                    className="inline-flex items-center gap-2 rounded-full border border-[var(--tc-border,#d7deea)] bg-white px-3 py-2 text-sm font-semibold text-[var(--tc-text,#0b1a3c)]"
                  >
                    <FiArchive className="h-4 w-4" />
                    Arquivar
                  </button>
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

              <div className="mt-6 flex flex-wrap gap-2">
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
                        className="inline-flex items-center gap-2 rounded-full border border-[var(--tc-border,#d7deea)] bg-white px-3 py-2 text-sm font-semibold text-[var(--tc-text,#0b1a3c)] disabled:opacity-60"
                      >
                        {generatingDraft ? <FiLoader className="h-4 w-4 animate-spin" /> : <FiCode className="h-4 w-4" />}
                        Gerar draft com IA
                      </button>
                      <Link
                        href={`/automacoes/playwright?testCaseId=${encodeURIComponent(selected.testCase.id)}`}
                        className="inline-flex items-center gap-2 rounded-full border border-[var(--tc-border,#d7deea)] bg-white px-3 py-2 text-sm font-semibold text-[var(--tc-text,#0b1a3c)]"
                      >
                        Abrir contexto Playwright
                      </Link>
                    </div>
                  </div>

                  {selected.automationLink ? (
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <div className="rounded-2xl border border-[var(--tc-border,#d7deea)] bg-white p-3 text-sm text-[var(--tc-text,#0b1a3c)]">
                        <p><strong>Spec file:</strong> {selected.automationLink.specFile}</p>
                        <p className="mt-1"><strong>Test title:</strong> {selected.automationLink.testTitle || "Não informado"}</p>
                        <p className="mt-1"><strong>Project:</strong> {selected.automationLink.playwrightProject || "Não informado"}</p>
                      </div>
                      <div className="rounded-2xl border border-[var(--tc-border,#d7deea)] bg-white p-3 text-sm text-[var(--tc-text,#0b1a3c)]">
                        <p><strong>Status:</strong> {selected.automationLink.status}</p>
                        <p className="mt-1"><strong>Tags:</strong> {selected.automationLink.tags.length ? selected.automationLink.tags.join(" ") : "Sem tags"}</p>
                        <p className="mt-1"><strong>Command:</strong> {selected.automationLink.command || "Não informado"}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 rounded-2xl border border-dashed border-[var(--tc-border,#d7deea)] bg-white px-4 py-3 text-sm text-[var(--tc-text-secondary,#4b5563)]">
                      Este caso ainda não possui vínculo técnico com Playwright.
                    </div>
                  )}

                  <div className="mt-4 flex items-center justify-between">
                    <h4 className="text-sm font-black text-[var(--tc-text,#0b1a3c)]">Drafts IA</h4>
                    <button
                      type="button"
                      onClick={() => setDraftRefreshToken((current) => current + 1)}
                      className="inline-flex items-center gap-2 rounded-full border border-[var(--tc-border,#d7deea)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--tc-text,#0b1a3c)]"
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
                        <div key={draft.id} data-testid="automation-draft-preview" className="rounded-2xl border border-[var(--tc-border,#d7deea)] bg-white p-3 text-sm text-[var(--tc-text,#0b1a3c)]">
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

                  <section className="mt-4 rounded-2xl border border-[var(--tc-border,#d7deea)] bg-white p-3">
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
                        className="min-h-10 flex-1 rounded-xl border border-[var(--tc-border,#d7deea)] bg-white px-3 text-sm"
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
                <section className="mt-4 rounded-2xl border border-dashed border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] px-4 py-3 text-sm text-[var(--tc-text-secondary,#4b5563)]">
                  Execuções deste caso aparecerão aqui conforme runs vinculadas.
                </section>
              ) : null}

              {detailTab === "history" ? (
                <section className="mt-4 rounded-2xl border border-dashed border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] px-4 py-3 text-sm text-[var(--tc-text-secondary,#4b5563)]">
                  Histórico de alterações e versões do caso.
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

      {isFormOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div data-testid="test-case-create-modal" className="max-h-[90vh] w-full max-w-4xl overflow-auto rounded-4xl border border-[var(--tc-border,#d7deea)] bg-white p-5 shadow-2xl">
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

function Metric({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[var(--tc-border,#d7deea)] bg-white px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--tc-text-muted,#6b7280)]">{label}</p>
        <span className="text-[var(--tc-accent,#ef0001)]">{icon}</span>
      </div>
      <p className="mt-2 text-lg font-black tracking-[-0.03em] text-[var(--tc-text,#0b1a3c)]">{value}</p>
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
    <label className="grid gap-2 text-sm font-semibold text-[var(--tc-text,#0b1a3c)]">
      {label}
      <select
        data-testid={testId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 rounded-2xl border border-[var(--tc-border,#d7deea)] bg-white px-4 text-sm outline-none transition focus:border-[var(--tc-accent,#ef0001)]"
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
        className="min-h-11 rounded-2xl border border-[var(--tc-border,#d7deea)] bg-white px-4 text-sm outline-none transition focus:border-[var(--tc-accent,#ef0001)]"
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
        className="rounded-2xl border border-[var(--tc-border,#d7deea)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--tc-accent,#ef0001)]"
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
          ? "border-[var(--tc-accent,#ef0001)] bg-[#fff5f5] text-[var(--tc-accent,#ef0001)]"
          : "border-[var(--tc-border,#d7deea)] bg-white text-[var(--tc-text,#0b1a3c)]"
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
          ? "border-[var(--tc-accent,#ef0001)] bg-[#fff0f0] text-[var(--tc-accent,#ef0001)]"
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

