"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  FiChevronDown,
  FiChevronUp,
  FiClipboard,
  FiEdit2,
  FiExternalLink,
  FiLayers,
  FiPlus,
  FiRefreshCcw,
  FiTrash2,
  FiX,
  FiZap,
} from "react-icons/fi";
import { useAppShellCoverSlot } from "@/components/AppShellCoverSlotContext";
import { fetchApi } from "@/lib/api";
import { useI18n } from "@/hooks/useI18n";
import {
  buildQaseCaseLink,
  createEmptyCaseStep,
  createEmptyManualCase,
  createDefaultTestPlanAutomationState,
  isCaseEffectivelyEmpty,
  parseQaseCaseIdsInput,
  type TestPlanAutomationState,
  type TestPlanCase,
  type TestPlanCaseStep,
} from "@/lib/testPlanCases";

const COPY = {
  "pt-BR": {
    coverTotal: "Total",
    coverQase: "Qase",
    coverCases: "Casos",
    filterApp: "Aplicação",
    filterAll: "Todas",
    filterSearch: "Buscar",
    searchPlaceholder: "Título, descrição, projeto ou origem",
    refresh: "Atualizar",
    newPlan: "Novo plano",
    projectLabel: "Projeto:",
    projectAll: "Todos",
    projectNone: "Sem Qase",
    manualLabel: "Manual:",
    integratedLabel: "Integrado:",
    loadingApps: "Carregando aplicações...",
    loadingPlans: "Carregando planos de teste...",
    emptyPlans: "Nenhum plano encontrado para os filtros atuais.",
    noDate: "Sem data",
    createdLabel: "Criado:",
    updatedLabel: "Atualizado:",
    clickToDetails: "Clique para ver casos e detalhes",
    open: "Abrir",
    edit: "Editar",
    deletePlan: "Excluir",
    confirmDelete: (title: string) => `Remover o plano "${title}"?`,
    casesCount: (n: number) => `${n} casos`,
    noDescription: "Plano sem descrição detalhada.",
    unknownApp: "Aplicação não identificada",
    modalEditLabel: "Editar plano",
    modalNewLabel: "Novo plano",
    modalQaseTitle: "Plano integrado Qase",
    modalManualTitle: "Plano manual",
    modalQaseDesc: "Visualize os casos vinculados, adicione novos IDs e expanda cada item para consultar os detalhes do Qase.",
    modalManualDesc: "Os casos manuais ficam visiveis no próprio plano, com título rápido e campos completos para detalhamento.",
    closeModalAria: "Fechar modal",
    titleLabel: "Título",
    titlePlaceholder: "Ex: Regressao sprint 32",
    appLabel: "Aplicação",
    selectApp: "Selecione",
    sourceLabel: "Origem",
    sourceManual: "Manual local",
    sourceQase: "Qase",
    noQaseWarning: "A aplicação escolhida não possui projeto Qase vinculado. Para criar no Qase, selecione uma aplicação com codigo de projeto.",
    descLabel: "Descrição do plano",
    descPlaceholder: "Contexto, objetivo e recorte do plano.",
    casesSection: "Casos do plano",
    casesLinked: (n: number) => `${n} caso${n === 1 ? "" : "s"} vinculado${n === 1 ? "" : "s"}`,
    casesQaseDesc: "Cada caso mostra ID, título, link direto e expande os detalhes sob demanda.",
    casesManualDesc: "No manual, cada caso pode ser criado só com título e ganhar detalhes completos quando você expandir.",
    addManualCase: "Adicionar caso manual",
    qaseIdsLabel: "IDs dos casos Qase",
    qaseIdsPlaceholder: "IDs numericos separados por linha ou virgula. Ex: 101, 102, 103",
    linkCases: "Vincular casos",
    qaseIdsNote: "O plano do Qase aceita apenas case IDs numericos. Ao expandir um item, a tela consulta descrição, pre-condicoes, pos-condicoes, severidade e passos do caso.",
    loadingPlanDetail: "Carregando detalhes do plano...",
    emptyQaseCases: "Adicione IDs de casos do Qase para visualizar a lista.",
    emptyManualCases: "Adicione um caso manual para montar título, passos e criterios do plano.",
    openLink: "Abrir link",
    removeCase: "Remover",
    loadingCaseDetail: "Carregando detalhes do caso do Qase...",
    descriptionLabel: "Descrição",
    noQaseDescription: "Sem descrição detalhada no Qase.",
    preconditionsLabel: "Pre-condicoes",
    noPreconditions: "Sem pre-condicoes cadastradas.",
    postconditionsLabel: "Pos-condicoes e severidade",
    noPostconditions: "Sem pos-condicoes cadastradas.",
    severityLabel: "Severidade:",
    severityNotSet: "Não informada",
    stepsLabel: "Passos",
    stepLabel: (n: number) => `Passo ${n}`,
    noSteps: "O caso do Qase não retornou passos estruturados.",
    expectedResult: "Resultado esperado",
    notSpecified: "Não informado.",
    dataLabel: "Dados",
    caseIdLabel: "ID do caso",
    caseTitleLabel: "Título do caso",
    caseTitlePlaceholder: "Ex: Login com operador",
    caseDescLabel: "Descrição",
    caseDescPlaceholder: "Descreva o objetivo e o contexto do caso.",
    casePrecondLabel: "Pre-condicoes",
    casePrecondPlaceholder: "Estado inicial necessário antes do teste.",
    casePostcondLabel: "Pos-condicoes",
    casePostcondPlaceholder: "Estado esperado apos a execução.",
    caseSeverityLabel: "Severidade",
    stepsDesc: "Crie o caso só com título e detalhe os passos apenas quando precisar.",
    addStep: "Adicionar passo",
    removeStep: "Remover passo",
    actionLabel: "Ação",
    actionPlaceholder: "O que deve ser executado neste passo.",
    expectedResultLabel: "Resultado esperado",
    expectedResultPlaceholder: "Qual resultado deve aparecer apos o passo.",
    stepDataLabel: "Dados do passo",
    stepDataPlaceholder: "Dados, massa ou observação opcional.",
    noStepsManual: "Este caso ainda não tem passos. Se quiser, pode salvar apenas com o título e detalhar depois.",
    noAction: "Sem ação descrita.",
    appInFocus: "Aplicação em foco:",
    noApp: "Sem aplicação",
    cancel: "Cancelar",
    saving: "Salvando...",
    savePlan: "Salvar plano",
    createPlan: "Criar plano",
    severityOptions: [
      { value: "", label: "Sem severidade" },
      { value: "low", label: "Baixa" },
      { value: "medium", label: "Media" },
      { value: "high", label: "Alta" },
      { value: "critical", label: "Critica" },
    ],
    errLoadApps: "Não foi possível carregar as aplicações da empresa.",
    errLoadPlans: "Não foi possível consultar os planos de teste.",
    errOpenPlan: "Não foi possível abrir o plano selecionado.",
    errDeletePlan: "Não foi possível remover o plano.",
    errSelectApp: "Selecione uma aplicação especifica para salvar um plano.",
    errTitle: "Informe o título do plano.",
    errCaseTitle: (id: string) => `Informe o título do caso manual ${id}.`,
    errMinQaseCase: "Informe ao menos um case ID numerico para o plano do Qase.",
    errSavePlan: "Não foi possível salvar o plano.",
    errNoAppQase: "Nenhuma aplicação com projeto Qase vinculado esta disponível para criar o plano.",
    errNoApp: "Nenhuma aplicação disponível para criar o plano.",
    errAddQaseIds: "Informe pelo menos um case ID numerico para adicionar ao plano do Qase.",
    errNoValidIds: "Nenhum case ID numerico válido foi encontrado.",
    errLoadCase: "Não foi possível carregar o caso do Qase.",
    errLoadApp: "Erro ao carregar aplicações",
    errLoadPlan: "Erro ao carregar planos",
    errOpenPlanShort: "Erro ao abrir plano",
    errDeletePlanShort: "Erro ao remover plano",
    errSavePlanShort: "Erro ao salvar plano",
    errLoadCaseShort: "Erro ao carregar caso",
    caseQaseLabel: (id: string) => `Caso Qase ${id}`,
    caseManualLabel: (n: number) => `Caso manual ${n}`,
    collapseCase: "Recolher",
    expandCase: "Expandir",
    planAutomationLabel: "Plano na automacao",
    planAutomationDesc: "Quando marcado, o plano passa a aparecer tambem no modulo de automacao da empresa.",
    planAutomationToggle: "Exibir este plano na automacao",
    caseAutomationToggle: "Marcar para automacao",
    caseAutomationDesc: "Esse caso passa a aparecer na tela de casos de automacao da empresa.",
    automationLinkedCount: (n: number) => `${n} marcado${n === 1 ? "" : "s"} para automacao`,
    automationStatusLabel: "Status da automacao",
    automationStatusNotStarted: "Nao iniciado",
    automationStatusDraft: "Rascunho",
    automationStatusPublished: "Publicado",
    automationPlanBadge: "Plano em automacao",
    automationCaseBadge: "Caso em automacao",
    caseDetailsAria: (action: string, title: string) => `${action} detalhes do caso ${title}`,
    planDetailsAria: (title: string) => `Abrir detalhes do plano ${title}`,
  },
  "en-US": {
    coverTotal: "Total",
    coverQase: "Qase",
    coverCases: "Cases",
    filterApp: "Application",
    filterAll: "All",
    filterSearch: "Search",
    searchPlaceholder: "Title, description, project or source",
    refresh: "Refresh",
    newPlan: "New plan",
    projectLabel: "Project:",
    projectAll: "All",
    projectNone: "No Qase",
    manualLabel: "Manual:",
    integratedLabel: "Integrated:",
    loadingApps: "Loading applications...",
    loadingPlans: "Loading test plans...",
    emptyPlans: "No plans found for the current filters.",
    noDate: "No date",
    createdLabel: "Created:",
    updatedLabel: "Updated:",
    clickToDetails: "Click to view cases and details",
    open: "Open",
    edit: "Edit",
    deletePlan: "Delete",
    confirmDelete: (title: string) => `Remove plan "${title}"?`,
    casesCount: (n: number) => `${n} cases`,
    noDescription: "Plan has no detailed description.",
    unknownApp: "Unknown application",
    modalEditLabel: "Edit plan",
    modalNewLabel: "New plan",
    modalQaseTitle: "Qase integrated plan",
    modalManualTitle: "Manual plan",
    modalQaseDesc: "View linked cases, add new IDs and expand each item to check Qase details.",
    modalManualDesc: "Manual cases are visible in the plan itself, with a quick title and full fields for detailed description.",
    closeModalAria: "Close modal",
    titleLabel: "Title",
    titlePlaceholder: "E.g.: Sprint 32 regression",
    appLabel: "Application",
    selectApp: "Select",
    sourceLabel: "Source",
    sourceManual: "Manual local",
    sourceQase: "Qase",
    noQaseWarning: "The selected application has no linked Qase project. To create in Qase, select an application with a project code.",
    descLabel: "Plan description",
    descPlaceholder: "Context, objective and scope of the plan.",
    casesSection: "Plan cases",
    casesLinked: (n: number) => `${n} case${n === 1 ? "" : "s"} linked`,
    casesQaseDesc: "Each case shows ID, title, direct link and expands details on demand.",
    casesManualDesc: "In manual mode, each case can be created with just a title and get full details when you expand it.",
    addManualCase: "Add manual case",
    qaseIdsLabel: "Qase case IDs",
    qaseIdsPlaceholder: "Numeric IDs separated by line or comma. E.g.: 101, 102, 103",
    linkCases: "Link cases",
    qaseIdsNote: "The Qase plan only accepts numeric case IDs. When expanding an item, the screen queries description, preconditions, postconditions, severity and case steps.",
    loadingPlanDetail: "Loading plan details...",
    emptyQaseCases: "Add Qase case IDs to view the list.",
    emptyManualCases: "Add a manual case to build the title, steps and criteria for the plan.",
    openLink: "Open link",
    removeCase: "Remove",
    loadingCaseDetail: "Loading Qase case details...",
    descriptionLabel: "Description",
    noQaseDescription: "No detailed description in Qase.",
    preconditionsLabel: "Preconditions",
    noPreconditions: "No preconditions registered.",
    postconditionsLabel: "Postconditions and severity",
    noPostconditions: "No postconditions registered.",
    severityLabel: "Severity:",
    severityNotSet: "Not specified",
    stepsLabel: "Steps",
    stepLabel: (n: number) => `Step ${n}`,
    noSteps: "The Qase case did not return structured steps.",
    expectedResult: "Expected result",
    notSpecified: "Not specified.",
    dataLabel: "Data",
    caseIdLabel: "Case ID",
    caseTitleLabel: "Case title",
    caseTitlePlaceholder: "E.g.: Login with operator",
    caseDescLabel: "Description",
    caseDescPlaceholder: "Describe the objective and context of the case.",
    casePrecondLabel: "Preconditions",
    casePrecondPlaceholder: "Initial state required before the test.",
    casePostcondLabel: "Postconditions",
    casePostcondPlaceholder: "Expected state after execution.",
    caseSeverityLabel: "Severity",
    stepsDesc: "Create the case with just a title and add step details only when needed.",
    addStep: "Add step",
    removeStep: "Remove step",
    actionLabel: "Action",
    actionPlaceholder: "What should be executed in this step.",
    expectedResultLabel: "Expected result",
    expectedResultPlaceholder: "What result should appear after the step.",
    stepDataLabel: "Step data",
    stepDataPlaceholder: "Data, test data or optional observation.",
    noStepsManual: "This case has no steps yet. You can save with just the title and add details later.",
    noAction: "No action described.",
    appInFocus: "Application in focus:",
    noApp: "No application",
    cancel: "Cancel",
    saving: "Saving...",
    savePlan: "Save plan",
    createPlan: "Create plan",
    severityOptions: [
      { value: "", label: "No severity" },
      { value: "low", label: "Low" },
      { value: "medium", label: "Medium" },
      { value: "high", label: "High" },
      { value: "critical", label: "Critical" },
    ],
    errLoadApps: "Could not load the company applications.",
    errLoadPlans: "Could not query test plans.",
    errOpenPlan: "Could not open the selected plan.",
    errDeletePlan: "Could not remove the plan.",
    errSelectApp: "Select a specific application to save a plan.",
    errTitle: "Please enter the plan title.",
    errCaseTitle: (id: string) => `Please enter the title for manual case ${id}.`,
    errMinQaseCase: "Please provide at least one numeric case ID for the Qase plan.",
    errSavePlan: "Could not save the plan.",
    errNoAppQase: "No application with a linked Qase project is available to create the plan.",
    errNoApp: "No application available to create the plan.",
    errAddQaseIds: "Please provide at least one numeric case ID to add to the Qase plan.",
    errNoValidIds: "No valid numeric case ID was found.",
    errLoadCase: "Could not load the Qase case.",
    errLoadApp: "Failed to load applications",
    errLoadPlan: "Failed to load plans",
    errOpenPlanShort: "Failed to open plan",
    errDeletePlanShort: "Failed to remove plan",
    errSavePlanShort: "Failed to save plan",
    errLoadCaseShort: "Failed to load case",
    caseQaseLabel: (id: string) => `Qase case ${id}`,
    caseManualLabel: (n: number) => `Manual case ${n}`,
    collapseCase: "Collapse",
    expandCase: "Expand",
    planAutomationLabel: "Automation plan",
    planAutomationDesc: "When enabled, this plan also shows up in the company's automation module.",
    planAutomationToggle: "Show this plan in automation",
    caseAutomationToggle: "Mark for automation",
    caseAutomationDesc: "This case starts showing up in the company automation cases screen.",
    automationLinkedCount: (n: number) => `${n} marked for automation`,
    automationStatusLabel: "Automation status",
    automationStatusNotStarted: "Not started",
    automationStatusDraft: "Draft",
    automationStatusPublished: "Published",
    automationPlanBadge: "Plan in automation",
    automationCaseBadge: "Case in automation",
    caseDetailsAria: (action: string, title: string) => `${action} case details for ${title}`,
    planDetailsAria: (title: string) => `Open plan details for ${title}`,
  },
} as const;

type CopyType = (typeof COPY)["pt-BR"];

type ApplicationItem = {
  id: string;
  name: string;
  slug: string;
  qaseProjectCode?: string | null;
  source?: string | null;
};

type TestPlanItem = {
  id: string;
  title: string;
  description?: string | null;
  casesCount: number;
  createdAt?: string | null;
  updatedAt?: string | null;
  projectCode?: string | null;
  source: "manual" | "qase";
  applicationId?: string | null;
  applicationName?: string | null;
  cases?: TestPlanCase[];
  automation?: TestPlanAutomationState | null;
  automationCasesCount?: number;
};

type PlanDraft = {
  id?: string;
  applicationId?: string;
  source: "manual" | "qase";
  title: string;
  description: string;
  cases: TestPlanCase[];
  automation: TestPlanAutomationState;
};

const EMPTY_DRAFT: PlanDraft = {
  source: "manual",
  title: "",
  description: "",
  cases: [],
  automation: createDefaultTestPlanAutomationState(false),
};

function formatDate(value?: string | null, noDateLabel = "Sem data") {
  if (!value) return noDateLabel;
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return noDateLabel;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(time);
}

function trimText(value?: string | null) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
}

function hasLoadedCaseDetails(testCase: TestPlanCase) {
  return Boolean(
    trimText(testCase.description) ||
      trimText(testCase.preconditions) ||
      trimText(testCase.postconditions) ||
      trimText(testCase.severity) ||
      (Array.isArray(testCase.steps) && testCase.steps.length > 0),
  );
}

function formatCaseTitle(testCase: TestPlanCase, source: "manual" | "qase", index: number, copy: CopyType) {
  if (trimText(testCase.title)) return trimText(testCase.title) as string;
  return source === "qase" ? copy.caseQaseLabel(testCase.id) : copy.caseManualLabel(index + 1);
}

function formatCaseMeta(testCase: TestPlanCase, copy: CopyType) {
  const parts = [
    trimText(testCase.severity) ? `${copy.severityLabel} ${trimText(testCase.severity)}` : null,
    Array.isArray(testCase.steps) && testCase.steps.length ? `${testCase.steps.length} ${copy.stepsLabel.toLowerCase()}` : null,
    testCase.automation?.enabled
      ? `${copy.automationStatusLabel} ${formatAutomationStatus(testCase.automation.status, copy)}`
      : null,
  ].filter((item): item is string => Boolean(item));
  return parts.join(" | ");
}

function formatAutomationStatus(status: TestPlanAutomationState["status"], copy: CopyType) {
  if (status === "published") return copy.automationStatusPublished;
  if (status === "draft") return copy.automationStatusDraft;
  return copy.automationStatusNotStarted;
}

function countAutomationCases(cases: TestPlanCase[]) {
  return cases.filter((testCase) => testCase.automation?.enabled).length;
}

function buildAutomationCasesHref(planId: string, caseId?: string | null) {
  const params = new URLSearchParams({ planId });
  if (caseId) params.set("caseId", caseId);
  return `/automacoes/casos?${params.toString()}`;
}

function normalizeStepsForSave(steps?: TestPlanCaseStep[]) {
  return (steps ?? [])
    .map((step) => ({
      ...step,
      action: trimText(step.action),
      expectedResult: trimText(step.expectedResult),
      data: trimText(step.data),
    }))
    .filter((step) => step.action || step.expectedResult || step.data);
}

function normalizeCasesForSave(source: "manual" | "qase", cases: TestPlanCase[]) {
  if (source === "qase") {
    const seen = new Set<string>();
    return cases
      .map((testCase) => String(testCase.id ?? "").trim())
      .filter((id) => /^\d+$/.test(id))
      .filter((id) => {
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      })
      .map((id) => ({ id }));
  }

  return cases
    .map((testCase) => ({
      id: String(testCase.id ?? "").trim(),
      title: trimText(testCase.title),
      description: trimText(testCase.description),
      preconditions: trimText(testCase.preconditions),
      postconditions: trimText(testCase.postconditions),
      severity: trimText(testCase.severity),
      steps: normalizeStepsForSave(testCase.steps),
      automation: testCase.automation ?? undefined,
    }))
    .filter((testCase) => testCase.id)
    .filter((testCase) => Boolean(testCase.automation?.enabled) || !isCaseEffectivelyEmpty(testCase));
}

export default function TestPlansPage() {
  const { slug } = useParams<{ slug: string }>();
  const { language } = useI18n();
  const copy = (COPY[language] ?? COPY["pt-BR"]) as CopyType;
  const [applications, setApplications] = useState<ApplicationItem[]>([]);
  const [selectedApplicationId, setSelectedApplicationId] = useState<string>("");
  const [plans, setPlans] = useState<TestPlanItem[]>([]);
  const [loadingApplications, setLoadingApplications] = useState(true);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [projectCode, setProjectCode] = useState<string | null>(null);
  const [totalTests, setTotalTests] = useState(0);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<PlanDraft>(EMPTY_DRAFT);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingPlanDetail, setLoadingPlanDetail] = useState(false);
  const [expandedCaseId, setExpandedCaseId] = useState<string | null>(null);
  const [qaseCaseIdsInput, setQaseCaseIdsInput] = useState("");
  const [loadingCaseDetails, setLoadingCaseDetails] = useState<Record<string, boolean>>({});
  const [caseErrors, setCaseErrors] = useState<Record<string, string | null>>({});

  useEffect(() => {
    if (!slug) return;
    let canceled = false;

    async function loadApplications() {
      setLoadingApplications(true);
      setError(null);
      try {
        const response = await fetchApi(`/api/applications?companySlug=${encodeURIComponent(slug)}`);
        const payload = await response.json().catch(() => null);
        if (!response.ok) throw new Error(copy.errLoadApp);
        const items = Array.isArray(payload?.items) ? (payload.items as ApplicationItem[]) : [];
        if (canceled) return;
        setApplications(items);
        setSelectedApplicationId("");
      } catch {
        if (!canceled) setError(copy.errLoadApps);
      } finally {
        if (!canceled) setLoadingApplications(false);
      }
    }

    void loadApplications();

    return () => {
      canceled = true;
    };
  }, [slug]);

  const selectedApplication = useMemo(
    () => applications.find((item) => item.id === selectedApplicationId) ?? null,
    [applications, selectedApplicationId],
  );
  const isAllApplicationsSelected = !selectedApplicationId;
  const qaseEnabledApplications = useMemo(
    () => applications.filter((item) => Boolean(item.qaseProjectCode)),
    [applications],
  );
  const canCreateManual = applications.length > 0;
  const draftApplication = useMemo(
    () => applications.find((item) => item.id === draft.applicationId) ?? null,
    [applications, draft.applicationId],
  );
  const draftCanUseQase = Boolean(draftApplication?.qaseProjectCode);

  const loadPlans = useCallback(async () => {
    if (!slug) {
      setPlans([]);
      setWarning(null);
      setProjectCode(null);
      setTotalTests(0);
      return;
    }

    setLoadingPlans(true);
    setError(null);
    try {
      const query = new URLSearchParams({
        companySlug: slug,
      });
      if (selectedApplicationId) {
        query.set("applicationId", selectedApplicationId);
      }
      const response = await fetchApi(`/api/test-plans?${query.toString()}`);
      const payload = await response.json().catch(() => null);

      if (!response.ok && !payload?.warning) {
        throw new Error(copy.errLoadPlan);
      }

      setPlans(Array.isArray(payload?.plans) ? payload.plans : []);
      setWarning(typeof payload?.warning === "string" ? payload.warning : null);
      setProjectCode(typeof payload?.projectCode === "string" ? payload.projectCode : null);
      setTotalTests(typeof payload?.totalTests === "number" ? payload.totalTests : 0);
    } catch {
      setPlans([]);
      setProjectCode(null);
      setTotalTests(0);
      setWarning(null);
      setError(copy.errLoadPlans);
    } finally {
      setLoadingPlans(false);
    }
  }, [selectedApplicationId, slug]);

  useEffect(() => {
    void loadPlans();
  }, [loadPlans]);

  useEffect(() => {
    const activeProjectCode = draftApplication?.qaseProjectCode ?? projectCode;
    if (draft.source !== "qase" || !activeProjectCode || !draft.cases.length) return;

    setDraft((current) => {
      const nextCases = current.cases.map((testCase) => {
        const nextLink = buildQaseCaseLink(activeProjectCode, testCase.id);
        return nextLink && testCase.link !== nextLink ? { ...testCase, link: nextLink } : testCase;
      });
      const changed = nextCases.some((testCase, index) => testCase !== current.cases[index]);
      return changed ? { ...current, cases: nextCases } : current;
    });
  }, [draft.source, draft.cases.length, draftApplication?.qaseProjectCode, projectCode]);

  const filteredPlans = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return plans;
    return plans.filter((plan) =>
      [plan.title, plan.description, plan.projectCode, plan.source, plan.applicationName]
        .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
        .some((value) => value.toLowerCase().includes(term)),
    );
  }, [plans, search]);

  const totals = useMemo(
    () => ({
      total: plans.length,
      qase: plans.filter((plan) => plan.source === "qase").length,
      manual: plans.filter((plan) => plan.source === "manual").length,
    }),
    [plans],
  );

  const coverContent = useMemo(
    () => (
      <div className="flex justify-start lg:justify-end">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/16 bg-white/10 px-4 py-3 backdrop-blur">
            <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/68">
              {copy.coverTotal}
            </div>
            <div className="mt-2 text-3xl font-black text-white">{totals.total}</div>
          </div>
          <div className="rounded-2xl border border-white/16 bg-white/10 px-4 py-3 backdrop-blur">
            <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/68">
              {copy.coverQase}
            </div>
            <div className="mt-2 text-3xl font-black text-white">{totals.qase}</div>
          </div>
          <div className="rounded-2xl border border-white/16 bg-white/10 px-4 py-3 backdrop-blur">
            <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/68">
              {copy.coverCases}
            </div>
            <div className="mt-2 text-3xl font-black text-white">{totalTests}</div>
          </div>
        </div>
      </div>
    ),
    [totalTests, totals.qase, totals.total, copy],
  );

  useAppShellCoverSlot(coverContent);

  function resetModalAuxState() {
    setExpandedCaseId(null);
    setQaseCaseIdsInput("");
    setLoadingCaseDetails({});
    setCaseErrors({});
  }

  function closeModal() {
    setModalOpen(false);
    setLoadingPlanDetail(false);
    resetModalAuxState();
    setDraft(EMPTY_DRAFT);
  }

  function openCreate(source: "manual" | "qase") {
    const nextApplicationId =
      source === "qase"
        ? (selectedApplication?.qaseProjectCode
            ? selectedApplication.id
            : qaseEnabledApplications[0]?.id ?? "")
        : selectedApplication?.id ?? applications[0]?.id ?? "";

    if (!nextApplicationId) {
      setError(
        source === "qase"
          ? copy.errNoAppQase
          : copy.errNoApp,
      );
      return;
    }

    resetModalAuxState();
    const initialCases = source === "manual" ? [createEmptyManualCase([])] : [];
    setDraft({
      ...EMPTY_DRAFT,
      applicationId: nextApplicationId,
      source,
      cases: initialCases,
      automation: createDefaultTestPlanAutomationState(false),
    });
    setExpandedCaseId(initialCases[0]?.id ?? null);
    setModalOpen(true);
  }

  async function openEdit(plan: TestPlanItem) {
    if (!slug) return;
    const effectiveApplicationId = plan.applicationId ?? selectedApplicationId;
    resetModalAuxState();
    setLoadingPlanDetail(true);
    setModalOpen(true);
    setDraft({
      id: plan.id,
      applicationId: effectiveApplicationId || undefined,
      source: plan.source,
      title: plan.title,
      description: plan.description ?? "",
      cases: [],
      automation: plan.automation ?? createDefaultTestPlanAutomationState(false),
    });

    try {
      const query = new URLSearchParams({
        companySlug: slug,
        source: plan.source,
        planId: plan.id,
      });
      if (effectiveApplicationId) {
        query.set("applicationId", effectiveApplicationId);
      }
      if (plan.projectCode) {
        query.set("project", plan.projectCode);
      }
      const response = await fetchApi(`/api/test-plans?${query.toString()}`);
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.plan) {
        throw new Error(copy.errOpenPlanShort);
      }
      const fullPlan = payload.plan as TestPlanItem;
      const nextCases = Array.isArray(fullPlan.cases) ? fullPlan.cases : [];
      setDraft({
        id: fullPlan.id,
        applicationId: effectiveApplicationId || fullPlan.applicationId || undefined,
        source: fullPlan.source,
        title: fullPlan.title,
        description: fullPlan.description ?? "",
        cases: nextCases,
        automation: fullPlan.automation ?? createDefaultTestPlanAutomationState(false),
      });
      setExpandedCaseId(nextCases[0]?.id ?? null);
    } catch {
      setError(copy.errOpenPlan);
      closeModal();
    } finally {
      setLoadingPlanDetail(false);
    }
  }

  async function handleDelete(plan: TestPlanItem) {
    if (!slug) return;
    const confirmed =
      typeof window === "undefined" ? true : window.confirm(copy.confirmDelete(plan.title));
    if (!confirmed) return;

    setError(null);
    try {
      const response = await fetchApi("/api/test-plans", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companySlug: slug,
          applicationId: plan.applicationId ?? selectedApplicationId,
          planId: plan.id,
          source: plan.source,
          projectCode: plan.projectCode,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(typeof payload?.error === "string" ? payload.error : copy.errDeletePlanShort);
      }
      await loadPlans();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : copy.errDeletePlan);
    }
  }

  async function handleSave() {
    const effectiveApplicationId = draft.applicationId ?? selectedApplication?.id ?? null;
    if (!slug || !effectiveApplicationId) {
      setError(copy.errSelectApp);
      return;
    }

    const title = draft.title.trim();
    if (!title) {
      setError(copy.errTitle);
      return;
    }

    if (draft.source === "manual") {
      const untitledCase = draft.cases.find(
        (testCase) =>
          (!isCaseEffectivelyEmpty(testCase) || Boolean(testCase.automation?.enabled)) &&
          !trimText(testCase.title),
      );
      if (untitledCase) {
        setError(copy.errCaseTitle(untitledCase.id));
        return;
      }
    }

    const casesPayload = normalizeCasesForSave(draft.source, draft.cases);
    if (draft.source === "qase" && !casesPayload.length) {
      setError(copy.errMinQaseCase);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const method = draft.id ? "PATCH" : "POST";
      const response = await fetchApi("/api/test-plans", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companySlug: slug,
          applicationId: effectiveApplicationId,
          source: draft.source,
          planId: draft.id,
          title,
          description: draft.description,
          cases: casesPayload,
          automation: draft.automation,
          projectCode: draftApplication?.qaseProjectCode ?? projectCode,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(typeof payload?.error === "string" ? payload.error : copy.errSavePlanShort);
      }
      closeModal();
      await loadPlans();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : copy.errSavePlan);
    } finally {
      setSaving(false);
    }
  }

  async function handleQuickMarkAutomation(plan: TestPlanItem, enabled: boolean) {
    if (plan.source !== "manual") return;
    try {
      const response = await fetchApi("/api/test-plans", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companySlug: slug,
          applicationId: plan.applicationId,
          source: plan.source,
          planId: plan.id,
          title: plan.title,
          description: plan.description ?? "",
          cases: [],
          automation: { enabled, status: "not_started" },
        }),
      });
      if (response.ok) {
        setPlans((prev) =>
          prev.map((p) =>
            p.id === plan.id
              ? { ...p, automation: { ...p.automation, enabled, status: "not_started" } as TestPlanAutomationState }
              : p,
          ),
        );
      }
    } catch {
      // silently ignore quick-action failures — user can still use the modal
    }
  }

  function updateDraftCase(caseId: string, updater: (current: TestPlanCase) => TestPlanCase) {
    setDraft((current) => ({
      ...current,
      cases: current.cases.map((testCase) =>
        testCase.id === caseId ? updater(testCase) : testCase,
      ),
    }));
  }

  function handleAddManualCase() {
    const nextCase = createEmptyManualCase(draft.cases);
    setDraft((current) => ({
      ...current,
      cases: [...current.cases, nextCase],
    }));
    setExpandedCaseId(nextCase.id);
  }

  function handleRemoveCase(caseId: string) {
    setDraft((current) => ({
      ...current,
      cases: current.cases.filter((testCase) => testCase.id !== caseId),
    }));
    setExpandedCaseId((current) => (current === caseId ? null : current));
    setLoadingCaseDetails((current) => {
      const next = { ...current };
      delete next[caseId];
      return next;
    });
    setCaseErrors((current) => {
      const next = { ...current };
      delete next[caseId];
      return next;
    });
  }

  function handleManualStepChange(
    caseId: string,
    stepId: string,
    field: keyof Pick<TestPlanCaseStep, "action" | "expectedResult" | "data">,
    value: string,
  ) {
    updateDraftCase(caseId, (current) => ({
      ...current,
      steps: (current.steps ?? []).map((step) =>
        step.id === stepId ? { ...step, [field]: value } : step,
      ),
    }));
  }

  function handleAddManualStep(caseId: string) {
    updateDraftCase(caseId, (current) => ({
      ...current,
      steps: [...(current.steps ?? []), createEmptyCaseStep(current.steps)],
    }));
  }

  function handleRemoveManualStep(caseId: string, stepId: string) {
    updateDraftCase(caseId, (current) => ({
      ...current,
      steps: (current.steps ?? []).filter((step) => step.id !== stepId),
    }));
  }

  function handleAddQaseCases() {
    if (!trimText(qaseCaseIdsInput)) {
      setError(copy.errAddQaseIds);
      return;
    }

    const activeProjectCode = draftApplication?.qaseProjectCode ?? projectCode;
    const nextCases = parseQaseCaseIdsInput(qaseCaseIdsInput, draft.cases).map((testCase) => ({
      ...testCase,
      link: activeProjectCode
        ? buildQaseCaseLink(activeProjectCode, testCase.id)
        : testCase.link ?? null,
    }));

    if (!nextCases.length) {
      setError(copy.errNoValidIds);
      return;
    }

    setDraft((current) => ({ ...current, cases: nextCases }));
    const addedIds = nextCases.filter((testCase) =>
      !draft.cases.some((existingCase) => existingCase.id === testCase.id),
    );
    setExpandedCaseId(addedIds[0]?.id ?? nextCases[nextCases.length - 1]?.id ?? null);
    setQaseCaseIdsInput("");
  }

  async function loadQaseCaseDetail(caseId: string) {
    if (!slug || !draftApplication?.id || !draftCanUseQase) return;
    if (loadingCaseDetails[caseId]) return;

    const currentCase = draft.cases.find((testCase) => testCase.id === caseId) ?? null;
    if (!currentCase || hasLoadedCaseDetails(currentCase)) return;

    setLoadingCaseDetails((current) => ({ ...current, [caseId]: true }));
    setCaseErrors((current) => ({ ...current, [caseId]: null }));

    try {
      const query = new URLSearchParams({
        companySlug: slug,
        applicationId: draftApplication.id,
        source: "qase",
        caseId,
      });
      const currentProjectCode = draftApplication.qaseProjectCode?.trim();
      if (currentProjectCode) {
        query.set("project", currentProjectCode);
      }
      const response = await fetchApi(`/api/test-plans/cases?${query.toString()}`);
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.case) {
        throw new Error(typeof payload?.error === "string" ? payload.error : copy.errLoadCaseShort);
      }

      const detailedCase = payload.case as TestPlanCase;
      updateDraftCase(caseId, (testCase) => ({
        ...testCase,
        ...detailedCase,
        title: trimText(detailedCase.title) ?? trimText(testCase.title) ?? testCase.id,
        link:
          detailedCase.link ??
          testCase.link ??
          (currentProjectCode ? buildQaseCaseLink(currentProjectCode, caseId) : null),
      }));
    } catch (cause) {
      setCaseErrors((current) => ({
        ...current,
        [caseId]: cause instanceof Error ? cause.message : copy.errLoadCase,
      }));
    } finally {
      setLoadingCaseDetails((current) => ({ ...current, [caseId]: false }));
    }
  }

  async function toggleCase(caseId: string) {
    const nextExpanded = expandedCaseId === caseId ? null : caseId;
    setExpandedCaseId(nextExpanded);
    if (nextExpanded && draft.source === "qase") {
      await loadQaseCaseDetail(caseId);
    }
  }

  return (
    <div className="min-h-screen bg-(--page-bg,#f5f6fa) px-4 py-8 text-(--page-text,#0b1a3c) sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-none space-y-6">
        <section className="rounded-3xl border border-(--tc-border,#d7deea) bg-[linear-gradient(180deg,var(--tc-surface-filter-1,#ffffff)_0%,var(--tc-surface-filter-2,#fbfcff)_100%)] p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)] dark:shadow-none">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,280px)_minmax(0,1fr)_auto] xl:items-end">
            <label className="block text-xs font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">
              {copy.filterApp}
              <select
                value={selectedApplicationId}
                onChange={(event) => setSelectedApplicationId(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-(--tc-border,#dfe5f1) bg-(--tc-surface,#f8fafc) px-4 py-3 text-sm font-semibold text-(--tc-text,#0f172a) outline-none focus:border-(--tc-accent,#ef0001)"
              >
                <option value="">{copy.filterAll}</option>
                {applications.map((application) => (
                  <option key={application.id} value={application.id}>
                    {application.name}
                    {application.qaseProjectCode ? ` (${application.qaseProjectCode})` : " (manual)"}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-xs font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">
              {copy.filterSearch}
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={copy.searchPlaceholder}
                className="mt-2 w-full rounded-2xl border border-(--tc-border,#dfe5f1) bg-(--tc-surface,#f8fafc) px-4 py-3 text-sm text-(--tc-text,#0f172a) outline-none focus:border-(--tc-accent,#ef0001)"
              />
            </label>

            <div className="flex flex-wrap items-center gap-2 xl:justify-end">
              <button
                type="button"
                onClick={() => void loadPlans()}
                className="inline-flex items-center gap-2 rounded-2xl border border-(--tc-border,#dfe5f1) bg-(--tc-surface,#f8fafc) px-4 py-3 text-sm font-semibold text-(--tc-text,#0f172a)"
              >
                <FiRefreshCcw className="h-4 w-4" />
                {copy.refresh}
              </button>
              <button
                type="button"
                onClick={() => openCreate("manual")}
                disabled={!canCreateManual}
                className="inline-flex items-center gap-2 rounded-2xl border border-(--tc-border,#dfe5f1) bg-(--tc-surface,#f8fafc) px-4 py-3 text-sm font-semibold text-(--tc-text,#0f172a)"
              >
                <FiPlus className="h-4 w-4" />
                {copy.newPlan}
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.18em] text-(--tc-text-muted,#6b7280)">
            <span className="rounded-full border border-(--tc-border,#dfe5f1) px-3 py-1.5">
              {copy.projectLabel}{" "}
              {projectCode ??
                selectedApplication?.qaseProjectCode ??
                (isAllApplicationsSelected ? copy.projectAll : copy.projectNone)}
            </span>
            <span className="rounded-full border border-(--tc-border,#dfe5f1) px-3 py-1.5">
              {copy.manualLabel} {totals.manual}
            </span>
            <span className="rounded-full border border-(--tc-border,#dfe5f1) px-3 py-1.5">
              {copy.integratedLabel} {totals.qase}
            </span>
          </div>
        </section>

        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        {warning ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-100">
            {warning}
          </div>
        ) : null}

        <section>
          {loadingApplications ? (
            <p className="text-sm text-(--tc-text-muted,#6b7280)">{copy.loadingApps}</p>
          ) : loadingPlans ? (
            <p className="text-sm text-(--tc-text-muted,#6b7280)">{copy.loadingPlans}</p>
          ) : filteredPlans.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-(--tc-border,#d8dee9) bg-(--tc-surface,#f9fafb) p-10 text-center">
              <FiClipboard size={30} className="mx-auto text-(--tc-text-muted,#6b7280)" />
              <p className="mt-3 text-sm text-(--tc-text-secondary,#4b5563)">
                {copy.emptyPlans}
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredPlans.map((plan) => (
                <article
                  key={`${plan.source}:${plan.id}`}
                  className="rounded-3xl border border-(--tc-border,#d7deea) bg-[linear-gradient(180deg,var(--tc-surface-card-1,#f7f9fd)_0%,var(--tc-surface-card-2,#ffffff)_100%)] p-5 shadow-[0_16px_40px_rgba(15,23,42,0.05)] transition hover:border-[rgba(239,0,1,0.28)] hover:shadow-[0_18px_44px_rgba(15,23,42,0.08)] dark:shadow-none"
                >
                  <button
                    type="button"
                    onClick={() => void openEdit(plan)}
                    className="block w-full text-left text-[#10234d]"
                    aria-label={copy.planDetailsAria(plan.title)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] ${
                              plan.source === "qase"
                                ? "border border-emerald-600/30 bg-emerald-100 text-emerald-800"
                                : "border border-slate-300 bg-slate-200 text-slate-800"
                            }`}
                          >
                            {plan.source === "qase" ? copy.sourceQase : copy.sourceManual}
                          </span>
                          {plan.projectCode ? (
                            <span className="rounded-full border border-[#d7deea] bg-[#f5f8ff] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-[#55657f]">
                              {plan.projectCode}
                            </span>
                          ) : null}
                          {plan.source === "manual" && ((plan.automation?.enabled ?? false) || (plan.automationCasesCount ?? 0) > 0) ? (
                            <span className="rounded-full border border-[#f59e0b33] bg-[#fff7e8] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-[#b45309]">
                              {copy.automationPlanBadge}
                            </span>
                          ) : null}
                        </div>
                        <h2 className="mt-3 text-lg font-extrabold text-[#10234d]">
                          {plan.title}
                        </h2>
                        <p className="mt-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#44536c]">
                          {plan.applicationName ?? copy.unknownApp}
                        </p>
                      </div>

                      <div className="inline-flex items-center gap-2 rounded-full border border-[#d7deea] bg-[#f5f8ff] px-3 py-1.5 text-xs font-semibold text-[#10234d]">
                        <FiLayers className="h-3.5 w-3.5" />
                        {copy.casesCount(plan.casesCount)}
                      </div>
                    </div>

                    <p className="mt-4 min-h-18 text-sm leading-6 text-[#5a6984]">
                      {plan.description?.trim() || copy.noDescription}
                    </p>

                    <div className="mt-4 text-xs text-[#55657f]">
                      {copy.createdLabel} {formatDate(plan.createdAt, copy.noDate)} | {copy.updatedLabel} {formatDate(plan.updatedAt, copy.noDate)}
                    </div>

                    {plan.source === "manual" && ((plan.automation?.enabled ?? false) || (plan.automationCasesCount ?? 0) > 0) ? (
                      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-[#8a5a0b]">
                        <span className="rounded-full border border-[#f59e0b33] bg-[#fff7e8] px-3 py-1 font-semibold uppercase tracking-[0.18em]">
                          {copy.automationStatusLabel} {formatAutomationStatus(plan.automation?.status ?? "not_started", copy)}
                        </span>
                        <span className="rounded-full border border-[#f59e0b33] bg-[#fffdf6] px-3 py-1 font-semibold uppercase tracking-[0.18em]">
                          {copy.automationLinkedCount(plan.automationCasesCount ?? 0)}
                        </span>
                      </div>
                    ) : null}

                    <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#44536c]">
                        {copy.clickToDetails}
                      </p>
                      <span className="inline-flex items-center gap-2 rounded-xl border border-[#d7deea] bg-[#f8fbff] px-3 py-2 text-xs font-semibold text-[#10234d]">
                        <FiEdit2 className="h-3.5 w-3.5" />
                        {copy.open}
                      </span>
                    </div>
                  </button>

                  <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-[#d7deea] pt-4">
                    {plan.source === "manual" && !(plan.automation?.enabled) && (
                      <button
                        type="button"
                        onClick={() => void handleQuickMarkAutomation(plan, true)}
                        className="inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-100 transition-colors"
                        title={copy.planAutomationToggle}
                      >
                        <FiZap className="h-3.5 w-3.5" />
                        {copy.planAutomationToggle}
                      </button>
                    )}
                    {plan.source === "manual" && plan.automation?.enabled && (
                      <button
                        type="button"
                        onClick={() => void handleQuickMarkAutomation(plan, false)}
                        className="inline-flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors"
                      >
                        <FiZap className="h-3.5 w-3.5" />
                        Desativar automacao
                      </button>
                    )}
                    {plan.source === "manual" && ((plan.automation?.enabled ?? false) || (plan.automationCasesCount ?? 0) > 0) ? (
                      <Link
                        href={buildAutomationCasesHref(plan.id)}
                        className="inline-flex items-center gap-2 rounded-xl border border-[#d7deea] bg-[#f8fbff] px-3 py-2 text-xs font-semibold text-[#10234d]"
                      >
                        <FiExternalLink className="h-3.5 w-3.5" />
                        Ver na automacao
                      </Link>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => void openEdit(plan)}
                      className="inline-flex items-center gap-2 rounded-xl border border-[#d7deea] bg-[#f8fbff] px-3 py-2 text-xs font-semibold text-[#10234d]"
                    >
                      <FiEdit2 className="h-3.5 w-3.5" />
                      {copy.edit}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(plan)}
                      className="inline-flex items-center gap-2 rounded-xl border border-rose-300 bg-rose-100 px-3 py-2 text-xs font-semibold text-rose-800"
                    >
                      <FiTrash2 className="h-3.5 w-3.5" />
                      {copy.deletePlan}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      {modalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4 py-6 backdrop-blur-sm"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeModal();
            }
          }}
        >
          <div className="max-h-[calc(100dvh-2rem)] w-full max-w-6xl overflow-y-auto rounded-4xl border border-(--tc-border) bg-white shadow-[0_30px_120px_rgba(15,23,42,0.42)]">
            <div className="bg-[linear-gradient(135deg,#011848_0%,#082457_38%,#4b0f2f_72%,#ef0001_100%)] px-6 py-5 text-white">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-white/70">
                    {draft.id ? copy.modalEditLabel : copy.modalNewLabel}
                  </p>
                  <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-white">
                    {draft.source === "qase" ? copy.modalQaseTitle : copy.modalManualTitle}
                  </h2>
                  <p className="mt-2 text-sm text-white/82">
                    {draft.source === "qase"
                      ? copy.modalQaseDesc
                      : copy.modalManualDesc}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeModal}
                  className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-white"
                  aria-label={copy.closeModalAria}
                >
                  <FiX className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="space-y-6 px-6 py-6">
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_260px_220px]">
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.25em] text-(--tc-text-muted,#6b7280)">
                    {copy.titleLabel}
                  </span>
                  <input
                    value={draft.title}
                    onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                    className="w-full rounded-2xl border border-(--tc-border,#dfe5f1) bg-(--tc-surface,#f8fafc) px-4 py-3 text-sm text-(--tc-text,#0f172a) outline-none focus:border-(--tc-accent,#ef0001)"
                    placeholder={copy.titlePlaceholder}
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.25em] text-(--tc-text-muted,#6b7280)">
                    {copy.appLabel}
                  </span>
                  <select
                    value={draft.applicationId ?? ""}
                    onChange={(event) => {
                      const nextApplicationId = event.target.value;
                      const nextApplication =
                        applications.find((item) => item.id === nextApplicationId) ?? null;
                      setDraft((current) => ({
                        ...current,
                        applicationId: nextApplicationId || undefined,
                        source:
                          current.source === "qase" && !nextApplication?.qaseProjectCode
                            ? "manual"
                            : current.source,
                        cases:
                          current.source === "qase" && !nextApplication?.qaseProjectCode
                            ? []
                            : current.cases,
                      }));
                    }}
                    disabled={Boolean(draft.id)}
                    className="w-full rounded-2xl border border-(--tc-border,#dfe5f1) bg-(--tc-surface,#f8fafc) px-4 py-3 text-sm font-semibold text-(--tc-text,#0f172a) outline-none focus:border-(--tc-accent,#ef0001) disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <option value="">{copy.selectApp}</option>
                    {applications.map((application) => (
                      <option key={application.id} value={application.id}>
                        {application.name}
                        {application.qaseProjectCode ? ` (${application.qaseProjectCode})` : " (manual)"}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.25em] text-(--tc-text-muted,#6b7280)">
                    {copy.sourceLabel}
                  </span>
                  <select
                    value={draft.source}
                    onChange={(event) => {
                      const nextSource =
                        event.target.value === "qase" && draftCanUseQase ? "qase" : "manual";
                      setDraft((current) => ({
                        ...current,
                        source: nextSource,
                        cases:
                          nextSource === "manual"
                            ? current.cases.map((testCase) => ({
                                id: testCase.id,
                                title: testCase.title ?? "",
                                description: testCase.description ?? "",
                                preconditions: testCase.preconditions ?? "",
                                postconditions: testCase.postconditions ?? "",
                                severity: testCase.severity ?? "",
                                steps: testCase.steps ?? [],
                                automation: testCase.automation,
                              }))
                            : current.cases.map((testCase) => ({
                                id: testCase.id,
                                title: testCase.title ?? "",
                                link:
                                  draftApplication?.qaseProjectCode
                                    ? buildQaseCaseLink(draftApplication.qaseProjectCode, testCase.id)
                                    : null,
                              })),
                      }));
                    }}
                    disabled={Boolean(draft.id)}
                    className="w-full rounded-2xl border border-(--tc-border,#dfe5f1) bg-(--tc-surface,#f8fafc) px-4 py-3 text-sm font-semibold text-(--tc-text,#0f172a) outline-none focus:border-(--tc-accent,#ef0001) disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <option value="manual">{copy.sourceManual}</option>
                    {draftCanUseQase ? <option value="qase">{copy.sourceQase}</option> : null}
                  </select>
                </label>
              </div>

              {!draft.id && !draftCanUseQase ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-100">
                  {copy.noQaseWarning}
                </div>
              ) : null}

              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.25em] text-(--tc-text-muted,#6b7280)">
                  {copy.descLabel}
                </span>
                <textarea
                  value={draft.description}
                  onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
                  rows={4}
                  className="w-full rounded-3xl border border-(--tc-border,#dfe5f1) bg-(--tc-surface,#f8fafc) px-4 py-3 text-sm text-(--tc-text,#0f172a) outline-none focus:border-(--tc-accent,#ef0001)"
                  placeholder={copy.descPlaceholder}
                />
              </label>

              {draft.source === "manual" ? (
                <section className="rounded-3xl border border-amber-200 bg-amber-50/70 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#b45309]">
                        {copy.planAutomationLabel}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-[#8a5a0b]">
                        {copy.planAutomationDesc}
                      </p>
                    </div>
                    <label className="inline-flex min-h-11 items-center gap-3 rounded-2xl border border-amber-300 bg-white px-4 py-3 text-sm font-semibold text-[#8a5a0b]">
                      <input
                        type="checkbox"
                        checked={draft.automation.enabled}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            automation: {
                              ...current.automation,
                              enabled: event.target.checked,
                              status: event.target.checked
                                ? current.automation.status ?? "not_started"
                                : "not_started",
                            },
                          }))
                        }
                        className="h-4 w-4 accent-[#b45309]"
                      />
                      {copy.planAutomationToggle}
                    </label>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full border border-amber-300 bg-white px-3 py-1 font-semibold uppercase tracking-[0.2em] text-[#8a5a0b]">
                      {copy.automationStatusLabel} {formatAutomationStatus(draft.automation.status, copy)}
                    </span>
                    <span className="rounded-full border border-amber-300 bg-white px-3 py-1 font-semibold uppercase tracking-[0.2em] text-[#8a5a0b]">
                      {copy.automationLinkedCount(countAutomationCases(draft.cases))}
                    </span>
                  </div>
                </section>
              ) : null}

              <section className="rounded-3xl border border-(--tc-border,#dfe5f1) bg-[#f5f7fb] p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-(--tc-text-muted,#6b7280)">
                      {copy.casesSection}
                    </p>
                    <h3 className="mt-2 text-2xl font-black text-(--tc-text,#0f172a)">
                      {copy.casesLinked(draft.cases.length)}
                    </h3>
                    <p className="mt-2 text-sm text-(--tc-text-muted,#4b5563)">
                      {draft.source === "qase"
                        ? copy.casesQaseDesc
                        : copy.casesManualDesc}
                    </p>
                  </div>

                  {draft.source === "manual" ? (
                    <button
                      type="button"
                      onClick={handleAddManualCase}
                      className="inline-flex items-center gap-2 rounded-2xl bg-(--tc-accent,#ef0001) px-4 py-3 text-sm font-semibold text-white shadow-sm"
                    >
                      <FiPlus className="h-4 w-4" />
                      {copy.addManualCase}
                    </button>
                  ) : null}
                </div>

                {draft.source === "qase" ? (
                  <div className="mt-5 rounded-3xl border border-(--tc-border,#dfe5f1) bg-white p-4">
                    <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
                      <label className="space-y-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.25em] text-(--tc-text-muted,#6b7280)">
                          {copy.qaseIdsLabel}
                        </span>
                        <textarea
                          value={qaseCaseIdsInput}
                          onChange={(event) => setQaseCaseIdsInput(event.target.value)}
                          rows={3}
                          className="w-full rounded-3xl border border-(--tc-border,#dfe5f1) bg-(--tc-surface,#f8fafc) px-4 py-3 text-sm text-(--tc-text,#0f172a) outline-none focus:border-(--tc-accent,#ef0001)"
                          placeholder={copy.qaseIdsPlaceholder}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={handleAddQaseCases}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-(--tc-border,#dfe5f1) bg-(--tc-surface,#f8fafc) px-4 py-3 text-sm font-semibold text-(--tc-text,#0f172a)"
                      >
                        <FiPlus className="h-4 w-4" />
                        {copy.linkCases}
                      </button>
                    </div>
                    <p className="mt-3 text-xs text-(--tc-text-muted,#6b7280)">
                      {copy.qaseIdsNote}
                    </p>
                  </div>
                ) : null}

                <div className="mt-5 space-y-3">
                  {loadingPlanDetail ? (
                    <div className="rounded-2xl border border-(--tc-border,#dfe5f1) bg-white px-4 py-4 text-sm text-(--tc-text-muted,#6b7280)">
                      {copy.loadingPlanDetail}
                    </div>
                  ) : draft.cases.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-(--tc-border,#dfe5f1) bg-white px-4 py-6 text-center text-sm text-(--tc-text-muted,#6b7280)">
                      {draft.source === "qase"
                        ? copy.emptyQaseCases
                        : copy.emptyManualCases}
                    </div>
                  ) : (
                    draft.cases.map((testCase, index) => {
                      const isExpanded = expandedCaseId === testCase.id;
                      const detailError = caseErrors[testCase.id];
                      const detailLoading = Boolean(loadingCaseDetails[testCase.id]);
                      const meta = formatCaseMeta(testCase, copy);

                      return (
                        <div
                          key={`${draft.source}:${testCase.id}:${index}`}
                          className="overflow-hidden rounded-3xl border border-(--tc-border,#dfe5f1) bg-white shadow-sm"
                        >
                          <div className="flex items-stretch gap-3 px-4 py-4">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] ${
                                    draft.source === "qase"
                                      ? "border border-emerald-600/30 bg-emerald-100 text-emerald-800"
                                      : "border border-slate-300 bg-slate-200 text-slate-800"
                                  }`}
                                >
                                  {draft.source === "qase" ? copy.sourceQase : copy.sourceManual}
                                </span>
                                <span className="rounded-full border border-(--tc-border,#dfe5f1) px-3 py-1 text-[10px] font-mono font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">
                                  ID {testCase.id}
                                </span>
                                {draft.source === "manual" && testCase.automation?.enabled ? (
                                  <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-[#b45309]">
                                    {copy.automationCaseBadge}
                                  </span>
                                ) : null}
                                {draft.source === "manual" && draft.id && testCase.automation?.enabled ? (
                                  <Link
                                    href={buildAutomationCasesHref(draft.id, testCase.id)}
                                    className="inline-flex items-center gap-1 rounded-full border border-[#d7deea] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-[#10234d]"
                                  >
                                    Abrir na automacao
                                    <FiExternalLink className="h-3 w-3" />
                                  </Link>
                                ) : null}
                                {testCase.link ? (
                                  <a
                                    href={testCase.link}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 rounded-full border border-(--tc-border,#dfe5f1) px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-(--tc-text,#0f172a)"
                                  >
                                    {copy.openLink}
                                    <FiExternalLink className="h-3 w-3" />
                                  </a>
                                ) : null}
                              </div>

                              <button
                                type="button"
                                onClick={() => void toggleCase(testCase.id)}
                                aria-label={copy.caseDetailsAria(isExpanded ? copy.collapseCase : copy.expandCase, formatCaseTitle(testCase, draft.source, index, copy))}
                                data-expanded={isExpanded ? "true" : "false"}
                                className="mt-3 flex w-full items-start justify-between gap-4 text-left"
                              >
                                <div className="min-w-0">
                                  <h4 className="truncate text-base font-bold text-(--tc-text,#0f172a)">
                                    {formatCaseTitle(testCase, draft.source, index, copy)}
                                  </h4>
                                  {meta ? (
                                    <p className="mt-2 text-xs font-semibold uppercase tracking-[0.2em] text-(--tc-text-muted,#6b7280)">
                                      {meta}
                                    </p>
                                  ) : null}
                                </div>

                                <span className="mt-1 text-(--tc-text-muted,#6b7280)">
                                  {isExpanded ? (
                                    <FiChevronUp className="h-5 w-5" />
                                  ) : (
                                    <FiChevronDown className="h-5 w-5" />
                                  )}
                                </span>
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleRemoveCase(testCase.id)}
                              className="self-start rounded-2xl border border-rose-300 bg-rose-100 px-3 py-2 text-xs font-semibold text-rose-800"
                            >
                              {copy.removeCase}
                            </button>
                          </div>

                          {detailError ? (
                            <div className="border-t border-(--tc-border,#e5e7eb) bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-white/10 dark:bg-amber-400/10 dark:text-amber-100">
                              {detailError}
                            </div>
                          ) : null}

                          {isExpanded ? (
                            <div className="border-t border-(--tc-border,#e5e7eb) px-4 py-4 dark:border-white/10">
                              {draft.source === "qase" ? (
                                detailLoading ? (
                                  <div className="rounded-2xl border border-(--tc-border,#dfe5f1) bg-(--tc-surface-alt,#f8fafc) px-4 py-4 text-sm text-(--tc-text-muted,#6b7280)">
                                    {copy.loadingCaseDetail}
                                  </div>
                                ) : (
                                  <div className="space-y-4">
                                    <div className="grid gap-4 xl:grid-cols-2">
                                      <div className="rounded-2xl border border-(--tc-border,#dfe5f1) bg-(--tc-surface-alt,#f8fafc) p-4">
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-(--tc-text-muted,#6b7280)">
                                          {copy.descriptionLabel}
                                        </p>
                                        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-(--tc-text-muted,#4b5563)">
                                          {trimText(testCase.description) ?? copy.noQaseDescription}
                                        </p>
                                      </div>
                                      <div className="grid gap-4">
                                        <div className="rounded-2xl border border-(--tc-border,#dfe5f1) bg-(--tc-surface-alt,#f8fafc) p-4">
                                          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-(--tc-text-muted,#6b7280)">
                                            {copy.preconditionsLabel}
                                          </p>
                                          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-(--tc-text-muted,#4b5563)">
                                            {trimText(testCase.preconditions) ?? copy.noPreconditions}
                                          </p>
                                        </div>
                                        <div className="rounded-2xl border border-(--tc-border,#dfe5f1) bg-(--tc-surface-alt,#f8fafc) p-4">
                                          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-(--tc-text-muted,#6b7280)">
                                            {copy.postconditionsLabel}
                                          </p>
                                          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-(--tc-text-muted,#4b5563)">
                                            {trimText(testCase.postconditions) ?? copy.noPostconditions}
                                          </p>
                                          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">
                                            {copy.severityLabel} {trimText(testCase.severity) ?? copy.severityNotSet}
                                          </p>
                                        </div>
                                      </div>
                                    </div>

                                    <div className="rounded-2xl border border-(--tc-border,#dfe5f1) bg-(--tc-surface-alt,#f8fafc) p-4">
                                      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-(--tc-text-muted,#6b7280)">
                                        {copy.stepsLabel}
                                      </p>
                                      {Array.isArray(testCase.steps) && testCase.steps.length ? (
                                        <div className="mt-4 space-y-3">
                                          {testCase.steps.map((step, stepIndex) => (
                                            <div
                                              key={`${testCase.id}:${step.id}:${stepIndex}`}
                                              className="rounded-2xl border border-(--tc-border,#dfe5f1) bg-white p-4"
                                            >
                                              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">
                                                {copy.stepLabel(stepIndex + 1)}
                                              </p>
                                              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-(--tc-text,#0f172a)">
                                                {trimText(step.action) ?? copy.noAction}
                                              </p>
                                              <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">
                                                {copy.expectedResult}
                                              </p>
                                              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-(--tc-text-muted,#4b5563)">
                                                {trimText(step.expectedResult) ?? copy.notSpecified}
                                              </p>
                                              {trimText(step.data) ? (
                                                <>
                                                  <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">
                                                    {copy.dataLabel}
                                                  </p>
                                                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-(--tc-text-muted,#4b5563)">
                                                    {trimText(step.data)}
                                                  </p>
                                                </>
                                              ) : null}
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <p className="mt-3 text-sm text-(--tc-text-muted,#4b5563)">
                                          {copy.noSteps}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                )
                              ) : (
                                <div className="space-y-4">
                                  <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
                                    <div className="flex flex-wrap items-start justify-between gap-4">
                                      <div>
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#b45309]">
                                          {copy.caseAutomationToggle}
                                        </p>
                                        <p className="mt-2 text-sm leading-6 text-[#8a5a0b]">
                                          {copy.caseAutomationDesc}
                                        </p>
                                      </div>
                                      <label className="inline-flex min-h-11 items-center gap-3 rounded-2xl border border-amber-300 bg-white px-4 py-3 text-sm font-semibold text-[#8a5a0b]">
                                        <input
                                          type="checkbox"
                                          checked={Boolean(testCase.automation?.enabled)}
                                          onChange={(event) =>
                                            updateDraftCase(testCase.id, (current) => ({
                                              ...current,
                                              automation: {
                                                ...(current.automation ?? {}),
                                                enabled: event.target.checked,
                                                status: event.target.checked
                                                  ? current.automation?.status ?? "not_started"
                                                  : "not_started",
                                              },
                                            }))
                                          }
                                          className="h-4 w-4 accent-[#b45309]"
                                        />
                                        {copy.caseAutomationToggle}
                                      </label>
                                    </div>
                                    <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                                      <span className="rounded-full border border-amber-300 bg-white px-3 py-1 font-semibold uppercase tracking-[0.2em] text-[#8a5a0b]">
                                        {copy.automationStatusLabel} {formatAutomationStatus(testCase.automation?.status ?? "not_started", copy)}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)]">
                                    <label className="space-y-2">
                                      <span className="text-xs font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">
                                        {copy.caseIdLabel}
                                      </span>
                                      <input
                                        value={testCase.id}
                                        readOnly
                                        className="w-full rounded-2xl border border-(--tc-border,#dfe5f1) bg-(--tc-surface,#eef2ff) px-4 py-3 text-sm font-mono text-(--tc-text,#0f172a) outline-none"
                                      />
                                    </label>

                                    <label className="space-y-2">
                                      <span className="text-xs font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">
                                        {copy.caseTitleLabel}
                                      </span>
                                      <input
                                        value={testCase.title ?? ""}
                                        onChange={(event) =>
                                          updateDraftCase(testCase.id, (current) => ({
                                            ...current,
                                            title: event.target.value,
                                          }))
                                        }
                                        className="w-full rounded-2xl border border-(--tc-border,#dfe5f1) bg-(--tc-surface,#f8fafc) px-4 py-3 text-sm text-(--tc-text,#0f172a) outline-none focus:border-(--tc-accent,#ef0001)"
                                        placeholder={copy.caseTitlePlaceholder}
                                      />
                                    </label>
                                  </div>

                                  <div className="grid gap-4 xl:grid-cols-2">
                                    <label className="space-y-2">
                                      <span className="text-xs font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">
                                        {copy.caseDescLabel}
                                      </span>
                                      <textarea
                                        value={testCase.description ?? ""}
                                        onChange={(event) =>
                                          updateDraftCase(testCase.id, (current) => ({
                                            ...current,
                                            description: event.target.value,
                                          }))
                                        }
                                        rows={4}
                                        className="w-full rounded-3xl border border-(--tc-border,#dfe5f1) bg-(--tc-surface,#f8fafc) px-4 py-3 text-sm text-(--tc-text,#0f172a) outline-none focus:border-(--tc-accent,#ef0001)"
                                        placeholder={copy.caseDescPlaceholder}
                                      />
                                    </label>

                                    <div className="grid gap-4">
                                      <label className="space-y-2">
                                        <span className="text-xs font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">
                                          {copy.casePrecondLabel}
                                        </span>
                                        <textarea
                                          value={testCase.preconditions ?? ""}
                                          onChange={(event) =>
                                            updateDraftCase(testCase.id, (current) => ({
                                              ...current,
                                              preconditions: event.target.value,
                                            }))
                                          }
                                          rows={3}
                                          className="w-full rounded-3xl border border-(--tc-border,#dfe5f1) bg-(--tc-surface,#f8fafc) px-4 py-3 text-sm text-(--tc-text,#0f172a) outline-none focus:border-(--tc-accent,#ef0001)"
                                          placeholder={copy.casePrecondPlaceholder}
                                        />
                                      </label>

                                      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_220px]">
                                        <label className="space-y-2">
                                          <span className="text-xs font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">
                                            {copy.casePostcondLabel}
                                          </span>
                                          <textarea
                                            value={testCase.postconditions ?? ""}
                                            onChange={(event) =>
                                              updateDraftCase(testCase.id, (current) => ({
                                                ...current,
                                                postconditions: event.target.value,
                                              }))
                                            }
                                            rows={3}
                                            className="w-full rounded-3xl border border-(--tc-border,#dfe5f1) bg-(--tc-surface,#f8fafc) px-4 py-3 text-sm text-(--tc-text,#0f172a) outline-none focus:border-(--tc-accent,#ef0001)"
                                            placeholder={copy.casePostcondPlaceholder}
                                          />
                                        </label>

                                        <label className="space-y-2">
                                          <span className="text-xs font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">
                                            {copy.caseSeverityLabel}
                                          </span>
                                          <select
                                            value={testCase.severity ?? ""}
                                            onChange={(event) =>
                                              updateDraftCase(testCase.id, (current) => ({
                                                ...current,
                                                severity: event.target.value,
                                              }))
                                            }
                                            className="w-full rounded-2xl border border-(--tc-border,#dfe5f1) bg-(--tc-surface,#f8fafc) px-4 py-3 text-sm font-semibold text-(--tc-text,#0f172a) outline-none focus:border-(--tc-accent,#ef0001)"
                                          >
                                            {copy.severityOptions.map((option) => (
                                              <option key={option.value || "none"} value={option.value}>
                                                {option.label}
                                              </option>
                                            ))}
                                          </select>
                                        </label>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="rounded-2xl border border-(--tc-border,#dfe5f1) bg-(--tc-surface-alt,#f8fafc) p-4">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                      <div>
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-(--tc-text-muted,#6b7280)">
                                          {copy.stepsLabel}
                                        </p>
                                        <p className="mt-2 text-sm text-(--tc-text-muted,#4b5563)">
                                          {copy.stepsDesc}
                                        </p>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => handleAddManualStep(testCase.id)}
                                        className="inline-flex items-center gap-2 rounded-2xl border border-(--tc-border,#dfe5f1) bg-white px-4 py-3 text-sm font-semibold text-(--tc-text,#0f172a)"
                                      >
                                        <FiPlus className="h-4 w-4" />
                                        {copy.addStep}
                                      </button>
                                    </div>

                                    {Array.isArray(testCase.steps) && testCase.steps.length ? (
                                      <div className="mt-4 space-y-3">
                                        {testCase.steps.map((step, stepIndex) => (
                                          <div
                                            key={`${testCase.id}:${step.id}:${stepIndex}`}
                                            className="rounded-2xl border border-(--tc-border,#dfe5f1) bg-white p-4 dark:border-white/10 dark:bg-[#101827]"
                                          >
                                            <div className="flex flex-wrap items-center justify-between gap-3">
                                              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">
                                                {copy.stepLabel(stepIndex + 1)}
                                              </p>
                                              <button
                                                type="button"
                                                onClick={() => handleRemoveManualStep(testCase.id, step.id)}
                                                className="rounded-xl border border-rose-300 bg-rose-100 px-3 py-2 text-xs font-semibold text-rose-800"
                                              >
                                                {copy.removeStep}
                                              </button>
                                            </div>

                                            <div className="mt-4 grid gap-4 xl:grid-cols-2">
                                              <label className="space-y-2">
                                                <span className="text-xs font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">
                                                  {copy.actionLabel}
                                                </span>
                                                <textarea
                                                  value={step.action ?? ""}
                                                  onChange={(event) =>
                                                    handleManualStepChange(
                                                      testCase.id,
                                                      step.id,
                                                      "action",
                                                      event.target.value,
                                                    )
                                                  }
                                                  rows={3}
                                                  className="w-full rounded-3xl border border-(--tc-border,#dfe5f1) bg-(--tc-surface,#f8fafc) px-4 py-3 text-sm text-(--tc-text,#0f172a) outline-none focus:border-(--tc-accent,#ef0001)"
                                                  placeholder={copy.actionPlaceholder}
                                                />
                                              </label>

                                              <label className="space-y-2">
                                                <span className="text-xs font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">
                                                  {copy.expectedResultLabel}
                                                </span>
                                                <textarea
                                                  value={step.expectedResult ?? ""}
                                                  onChange={(event) =>
                                                    handleManualStepChange(
                                                      testCase.id,
                                                      step.id,
                                                      "expectedResult",
                                                      event.target.value,
                                                    )
                                                  }
                                                  rows={3}
                                                  className="w-full rounded-3xl border border-(--tc-border,#dfe5f1) bg-(--tc-surface,#f8fafc) px-4 py-3 text-sm text-(--tc-text,#0f172a) outline-none focus:border-(--tc-accent,#ef0001)"
                                                  placeholder={copy.expectedResultPlaceholder}
                                                />
                                              </label>
                                            </div>

                                            <label className="mt-4 block space-y-2">
                                              <span className="text-xs font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">
                                                {copy.stepDataLabel}
                                              </span>
                                              <input
                                                value={step.data ?? ""}
                                                onChange={(event) =>
                                                  handleManualStepChange(
                                                    testCase.id,
                                                    step.id,
                                                    "data",
                                                    event.target.value,
                                                  )
                                                }
                                                className="w-full rounded-2xl border border-(--tc-border,#dfe5f1) bg-(--tc-surface,#f8fafc) px-4 py-3 text-sm text-(--tc-text,#0f172a) outline-none focus:border-(--tc-accent,#ef0001)"
                                                placeholder={copy.stepDataPlaceholder}
                                              />
                                            </label>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <div className="mt-4 rounded-2xl border border-dashed border-(--tc-border,#dfe5f1) bg-white px-4 py-5 text-sm text-(--tc-text-muted,#4b5563)">
                                        {copy.noStepsManual}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : null}
                        </div>
                      );
                    })
                  )}
                </div>
              </section>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-(--tc-border,#e5e7eb) pt-4">
                <div className="text-xs text-(--tc-text-muted,#6b7280)">
                  {copy.appInFocus}{" "}
                  <span className="font-semibold text-(--tc-text,#0f172a)">
                    {draftApplication?.name ?? copy.noApp}
                  </span>
                  {draftApplication?.qaseProjectCode ? ` | Qase ${draftApplication.qaseProjectCode}` : ""}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="rounded-2xl border border-(--tc-border,#dfe5f1) bg-(--tc-surface,#f8fafc) px-4 py-3 text-sm font-semibold text-(--tc-text,#0f172a)"
                  >
                    {copy.cancel}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSave()}
                    disabled={saving || loadingPlanDetail}
                    className="rounded-2xl bg-(--tc-accent,#ef0001) px-5 py-3 text-sm font-semibold text-white shadow-sm disabled:opacity-60"
                  >
                    {saving ? copy.saving : draft.id ? copy.savePlan : copy.createPlan}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
