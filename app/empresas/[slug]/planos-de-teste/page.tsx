"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  FiBookOpen,
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
} from "react-icons/fi";
import { useAppShellCoverSlot } from "@/components/AppShellCoverSlotContext";
import { fetchApi } from "@/lib/api";
import { useI18n } from "@/hooks/useI18n";
import { useAuthUser } from "@/hooks/useAuthUser";
import { useProjectContext } from "@/lib/core/project/ProjectContext";
import {
  buildQaseCaseLink,
  createEmptyCaseStep,
  createEmptyManualCase,
  isCaseEffectivelyEmpty,
  parseQaseCaseIdsInput,
  type TestPlanCase,
  type TestPlanCaseStep,
} from "@/lib/testPlanCases";

const COPY = {
  "pt-BR": {
    coverTotal: "Total",
    coverQase: "Qase",
    coverCases: "Casos",
    filterApp: "AplicaÃ§Ã£o",
    filterAll: "Todas",
    filterSearch: "Buscar",
    searchPlaceholder: "TÃ­tulo, descriÃ§Ã£o, projeto ou origem",
    refresh: "Atualizar",
    newPlan: "Novo plano",
    projectLabel: "Projeto:",
    projectAll: "Todos",
    projectNone: "Sem Qase",
    manualLabel: "Manual:",
    localLabel: "Local:",
    automationLabel: "AutomaÃ§Ã£o:",
    integratedLabel: "Integrado:",
    loadingApps: "Carregando aplicaÃ§Ãµes...",
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
    noDescription: "Plano sem descriÃ§Ã£o detalhada.",
    unknownApp: "AplicaÃ§Ã£o nÃ£o identificada",
    modalEditLabel: "Editar plano",
    modalNewLabel: "Novo plano",
    modalQaseTitle: "Plano integrado Qase",
    modalManualTitle: "Plano manual",
    modalLocalTitle: "Plano local",
    modalAutomationTitle: "Plano automatizado",
    modalQaseDesc: "Visualize os casos vinculados, adicione novos IDs e expanda cada item para consultar os detalhes do Qase.",
    modalManualDesc: "Os casos manuais ficam visiveis no prÃ³prio plano, com tÃ­tulo rÃ¡pido e campos completos para detalhamento.",
    modalLocalDesc: "O plano local fica no repositÃ³rio da empresa e permite montar os casos sem depender do Qase.",
    modalAutomationDesc: "O plano automatizado registra a origem de automaÃ§Ã£o e mantÃ©m os casos preparados para execuÃ§Ã£o integrada.",
    closeModalAria: "Fechar modal",
    titleLabel: "TÃ­tulo",
    titlePlaceholder: "Ex: Regressao sprint 32",
    appLabel: "AplicaÃ§Ã£o",
    selectApp: "Selecione",
    sourceLabel: "Origem",
    sourceManual: "Manual local",
    sourceLocal: "Local",
    sourceAutomation: "Automatizado",
    sourceQase: "Qase",
    noQaseWarning: "A aplicaÃ§Ã£o escolhida nÃ£o possui projeto Qase vinculado. Para criar no Qase, selecione uma aplicaÃ§Ã£o com codigo de projeto.",
    descLabel: "DescriÃ§Ã£o do plano",
    descPlaceholder: "Contexto, objetivo e recorte do plano.",
    casesSection: "Casos do plano",
    casesLinked: (n: number) => `${n} caso${n === 1 ? "" : "s"} vinculado${n === 1 ? "" : "s"}`,
    casesQaseDesc: "Cada caso mostra ID, tÃ­tulo, link direto e expande os detalhes sob demanda.",
    casesManualDesc: "No manual, cada caso pode ser criado sÃ³ com tÃ­tulo e ganhar detalhes completos quando vocÃª expandir.",
    addManualCase: "Adicionar caso manual",
    qaseIdsLabel: "IDs dos casos Qase",
    qaseIdsPlaceholder: "IDs numericos separados por linha ou virgula. Ex: 101, 102, 103",
    linkCases: "Vincular casos",
    qaseIdsNote: "O plano do Qase aceita apenas case IDs numericos. Ao expandir um item, a tela consulta descriÃ§Ã£o, pre-condicoes, pos-condicoes, severidade e passos do caso.",
    loadingPlanDetail: "Carregando detalhes do plano...",
    emptyQaseCases: "Adicione IDs de casos do Qase para visualizar a lista.",
    emptyManualCases: "Adicione um caso manual para montar tÃ­tulo, passos e criterios do plano.",
    openLink: "Abrir link",
    removeCase: "Remover",
    loadingCaseDetail: "Carregando detalhes do caso do Qase...",
    descriptionLabel: "DescriÃ§Ã£o",
    noQaseDescription: "Sem descriÃ§Ã£o detalhada no Qase.",
    preconditionsLabel: "Pre-condicoes",
    noPreconditions: "Sem pre-condicoes cadastradas.",
    postconditionsLabel: "Pos-condicoes e severidade",
    noPostconditions: "Sem pos-condicoes cadastradas.",
    severityLabel: "Severidade:",
    severityNotSet: "NÃ£o informada",
    stepsLabel: "Passos",
    stepLabel: (n: number) => `Passo ${n}`,
    noSteps: "O caso do Qase nÃ£o retornou passos estruturados.",
    expectedResult: "Resultado esperado",
    notSpecified: "NÃ£o informado.",
    dataLabel: "Dados",
    caseIdLabel: "ID do caso",
    caseTitleLabel: "TÃ­tulo do caso",
    caseTitlePlaceholder: "Ex: Login com operador",
    caseDescLabel: "DescriÃ§Ã£o",
    caseDescPlaceholder: "Descreva o objetivo e o contexto do caso.",
    casePrecondLabel: "Pre-condicoes",
    casePrecondPlaceholder: "Estado inicial necessÃ¡rio antes do teste.",
    casePostcondLabel: "Pos-condicoes",
    casePostcondPlaceholder: "Estado esperado apos a execuÃ§Ã£o.",
    caseSeverityLabel: "Severidade",
    stepsDesc: "Crie o caso sÃ³ com tÃ­tulo e detalhe os passos apenas quando precisar.",
    addStep: "Adicionar passo",
    removeStep: "Remover passo",
    actionLabel: "AÃ§Ã£o",
    actionPlaceholder: "O que deve ser executado neste passo.",
    expectedResultLabel: "Resultado esperado",
    expectedResultPlaceholder: "Qual resultado deve aparecer apos o passo.",
    stepDataLabel: "Dados do passo",
    stepDataPlaceholder: "Dados, massa ou observaÃ§Ã£o opcional.",
    noStepsManual: "Este caso ainda nÃ£o tem passos. Se quiser, pode salvar apenas com o tÃ­tulo e detalhar depois.",
    noAction: "Sem aÃ§Ã£o descrita.",
    appInFocus: "AplicaÃ§Ã£o em foco:",
    noApp: "Sem aplicaÃ§Ã£o",
    cancel: "Cancelar",
    saving: "Salvando...",
    savePlan: "Salvar plano",
    createPlan: "Criar plano",
    newPlanQase: "Novo plano Qase",
    newPlanLocal: "Novo plano local",
    newPlanAutomation: "Novo plano automatizado",
    severityOptions: [
      { value: "", label: "Sem severidade" },
      { value: "low", label: "Baixa" },
      { value: "medium", label: "Media" },
      { value: "high", label: "Alta" },
      { value: "critical", label: "Critica" },
    ],
    errLoadApps: "NÃ£o foi possÃ­vel carregar as aplicaÃ§Ãµes da empresa.",
    errLoadPlans: "NÃ£o foi possÃ­vel consultar os planos de teste.",
    errOpenPlan: "NÃ£o foi possÃ­vel abrir o plano selecionado.",
    errDeletePlan: "NÃ£o foi possÃ­vel remover o plano.",
    errSelectApp: "Selecione uma aplicaÃ§Ã£o especifica para salvar um plano.",
    errTitle: "Informe o tÃ­tulo do plano.",
    errCaseTitle: (id: string) => `Informe o tÃ­tulo do caso manual ${id}.`,
    errMinQaseCase: "Informe ao menos um case ID numerico para o plano do Qase.",
    errSavePlan: "NÃ£o foi possÃ­vel salvar o plano.",
    errNoAppQase: "Nenhuma aplicaÃ§Ã£o com projeto Qase vinculado esta disponÃ­vel para criar o plano.",
    errNoApp: "Nenhuma aplicaÃ§Ã£o disponÃ­vel para criar o plano.",
    errAddQaseIds: "Informe pelo menos um case ID numerico para adicionar ao plano do Qase.",
    errNoValidIds: "Nenhum case ID numerico vÃ¡lido foi encontrado.",
    errLoadCase: "NÃ£o foi possÃ­vel carregar o caso do Qase.",
    errLoadApp: "Erro ao carregar aplicaÃ§Ãµes",
    errLoadPlan: "Erro ao carregar planos",
    errOpenPlanShort: "Erro ao abrir plano",
    errDeletePlanShort: "Erro ao remover plano",
    errSavePlanShort: "Erro ao salvar plano",
    errLoadCaseShort: "Erro ao carregar caso",
    caseQaseLabel: (id: string) => `Caso Qase ${id}`,
    caseManualLabel: (n: number) => `Caso manual ${n}`,
    collapseCase: "Recolher",
    expandCase: "Expandir",
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
    localLabel: "Local:",
    automationLabel: "Automation:",
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
    modalLocalTitle: "Local plan",
    modalAutomationTitle: "Automated plan",
    modalQaseDesc: "View linked cases, add new IDs and expand each item to check Qase details.",
    modalManualDesc: "Manual cases are visible in the plan itself, with a quick title and full fields for detailed description.",
    modalLocalDesc: "The local plan stays in the company repository and lets you build cases without depending on Qase.",
    modalAutomationDesc: "The automated plan records the automation origin and keeps cases ready for integrated execution.",
    closeModalAria: "Close modal",
    titleLabel: "Title",
    titlePlaceholder: "E.g.: Sprint 32 regression",
    appLabel: "Application",
    selectApp: "Select",
    sourceLabel: "Source",
    sourceManual: "Manual local",
    sourceLocal: "Local",
    sourceAutomation: "Automated",
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
    newPlanQase: "New Qase plan",
    newPlanLocal: "New local plan",
    newPlanAutomation: "New automated plan",
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
  source: "manual" | "local" | "automation" | "qase";
  applicationId?: string | null;
  applicationName?: string | null;
  cases?: TestPlanCase[];
};

type PlanDraft = {
  id?: string;
  applicationId?: string;
  source: "manual" | "local" | "automation" | "qase";
  title: string;
  description: string;
  cases: TestPlanCase[];
};

const EMPTY_DRAFT: PlanDraft = {
  source: "manual",
  title: "",
  description: "",
  cases: [],
};

const PROFILE_LABEL: Record<string, string> = {
  empresa: "Empresa",
  technical_support: "Suporte TÃ©cnico",
  leader_tc: "LÃ­der TC",
  testing_company_user: "UsuÃ¡rio TC",
  company_user: "UsuÃ¡rio da Empresa",
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

function formatCaseTitle(testCase: TestPlanCase, source: "manual" | "local" | "automation" | "qase", index: number, copy: CopyType) {
  if (trimText(testCase.title)) return trimText(testCase.title) as string;
  return source === "qase" ? copy.caseQaseLabel(testCase.id) : copy.caseManualLabel(index + 1);
}

function formatCaseMeta(testCase: TestPlanCase, copy: CopyType) {
  const parts = [
    trimText(testCase.severity) ? `${copy.severityLabel} ${trimText(testCase.severity)}` : null,
    Array.isArray(testCase.steps) && testCase.steps.length ? `${testCase.steps.length} ${copy.stepsLabel.toLowerCase()}` : null,
  ].filter((item): item is string => Boolean(item));
  return parts.join(" | ");
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

function normalizeCasesForSave(source: "manual" | "local" | "automation" | "qase", cases: TestPlanCase[]) {
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

  const seen = new Set<string>();
  return cases
    .map((testCase) => String(testCase.id ?? "").trim())
    .filter(Boolean)
    .filter((id) => {
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .map((id) => ({ id }));
}

export default function TestPlansPage() {
  const { user } = useAuthUser();
  const { slug } = useParams<{ slug: string }>();
  const { language } = useI18n();
  const { activeProject: selectedProject } = useProjectContext();
  const copy = (COPY[language] ?? COPY["pt-BR"]) as CopyType;
  const roleKey =
    (typeof user?.permissionRole === "string" && user.permissionRole.trim()) ||
    (typeof user?.companyRole === "string" && user.companyRole.trim()) ||
    (typeof user?.role === "string" && user.role.trim()) ||
    "";
  const roleLabel = PROFILE_LABEL[roleKey.toLowerCase()] ?? (roleKey || "Perfil");
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
  const [initialCaseIds, setInitialCaseIds] = useState<string[]>([]);

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
      if (selectedProject) {
        query.set("projectId", selectedProject.id);
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
  }, [selectedApplicationId, selectedProject, slug]);

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
      local: plans.filter((plan) => plan.source === "local").length,
      automation: plans.filter((plan) => plan.source === "automation").length,
    }),
    [plans],
  );

  const coverContent = useMemo(
    () => (
      <div className="grid w-full gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_auto_auto_auto] xl:items-center">
        <Link
          href="/docs"
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#ffffff] px-5 py-2 text-center text-sm font-bold text-[#011848] shadow-[0_2px_12px_rgba(0,0,0,0.18)] transition-colors hover:bg-[#f0f4ff] sm:justify-start"
        >
          <FiBookOpen className="h-4 w-4 shrink-0" />
          Abrir documentaÃ§Ã£o do cÃ³digo
        </Link>
        <div className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-white/18 bg-white/10 px-4 py-2 text-center text-sm font-semibold leading-5 text-white/92">
          <FiLayers className="h-4 w-4 shrink-0" />
          <span className="wrap-break-word">
            {roleLabel}
            {slug ? `: ${slug}` : ""}
          </span>
        </div>
        <div className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-white/18 bg-white/10 px-4 py-2 text-center text-sm font-semibold leading-5 text-white/92">
          <FiClipboard className="h-4 w-4 shrink-0" />
          <span>{totalTests} {copy.coverCases.toLowerCase()}</span>
        </div>
        <div className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-white/18 bg-white/10 px-4 py-2 text-center text-sm font-semibold leading-5 text-white/92">
          <FiLayers className="h-4 w-4 shrink-0" />
          <span>{totals.total} {copy.coverTotal.toLowerCase()}</span>
        </div>
      </div>
    ),
    [copy.coverCases, copy.coverTotal, roleLabel, slug, totalTests, totals.total],
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
    setInitialCaseIds([]);
    setDraft(EMPTY_DRAFT);
  }

  function openCreate(source: "manual" | "local" | "automation" | "qase") {
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
    const initialCases = source === "qase" ? [] : [createEmptyManualCase([])];
    setDraft({
      ...EMPTY_DRAFT,
      applicationId: nextApplicationId,
      source,
      cases: initialCases,
    });
    setInitialCaseIds([]);
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
      });
      setInitialCaseIds(nextCases.map((item) => item.id));
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

    const casesPayload = normalizeCasesForSave(draft.source, draft.cases);
    const manualTestCaseIds = Array.from(
      new Set(
        draft.cases
          .map((testCase) => String(testCase.id ?? "").trim())
          .filter(Boolean),
      ),
    );
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
          ...(draft.source === "qase" ? { cases: casesPayload } : {}),
          projectCode: draftApplication?.qaseProjectCode ?? projectCode,
          ...(selectedProject ? { projectId: selectedProject.id } : {}),
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(typeof payload?.error === "string" ? payload.error : copy.errSavePlanShort);
      }

      if (draft.source !== "qase") {
        const savedPlanId = String(payload?.plan?.id ?? draft.id ?? "").trim();
        if (!savedPlanId) {
          throw new Error(copy.errSavePlanShort);
        }

        const previousIds = new Set(initialCaseIds);
        const nextIds = new Set(manualTestCaseIds);
        const idsToAdd = manualTestCaseIds.filter((id) => !previousIds.has(id));
        const idsToRemove = initialCaseIds.filter((id) => !nextIds.has(id));

        if (idsToAdd.length) {
          const addResponse = await fetchApi(`/api/test-plans/${savedPlanId}/test-cases`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              companySlug: slug,
              testCaseIds: idsToAdd,
            }),
          });
          const addPayload = await addResponse.json().catch(() => null);
          if (!addResponse.ok) {
            throw new Error(typeof addPayload?.message === "string" ? addPayload.message : copy.errSavePlanShort);
          }
        }

        if (idsToRemove.length) {
          const removeResponse = await fetchApi(`/api/test-plans/${savedPlanId}/test-cases`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              companySlug: slug,
              testCaseIds: idsToRemove,
            }),
          });
          const removePayload = await removeResponse.json().catch(() => null);
          if (!removeResponse.ok) {
            throw new Error(typeof removePayload?.message === "string" ? removePayload.message : copy.errSavePlanShort);
          }
        }
      }

      closeModal();
      await loadPlans();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : copy.errSavePlan);
    } finally {
      setSaving(false);
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
    <div data-testid="test-plan-repository" className="min-h-screen bg-(--page-bg,#f5f6fa) px-4 py-8 text-(--page-text,#0b1a3c) sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-none space-y-6">
        <section className="rounded-3xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] p-5 shadow-sm dark:shadow-none">
          <div className="mb-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[var(--tc-accent,#ef0001)]">RepositÃ³rio de Planos de Teste</p>
            <div className="mt-2 flex items-start justify-between gap-3">
              <div>
                <h1 className="text-xl font-black tracking-[-0.03em] text-[var(--tc-text,#0b1a3c)] sm:text-2xl">
                  Planos vinculados ao repositÃ³rio central
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--tc-text-secondary,#4b5563)]">
                  Crie planos manuais ou integrados e vincule apenas casos jÃ¡ existentes no repositÃ³rio central.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== "undefined") {
                    window.dispatchEvent(new CustomEvent("assistant:open", {
                      detail: {
                        source: "planos-de-teste",
                        agentMode: "qa",
                        panelMode: "side",
                        initialMessage: "Analise os planos de teste: cobertura, status de execuÃ§Ã£o, lacunas e prÃ³ximas prioridades.",
                      },
                    }));
                  }
                }}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--tc-border,#d7deea)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--tc-text,#0b1a3c)] transition hover:border-[rgba(1,24,72,0.3)] hover:text-[var(--tc-primary,#011848)]"
              >
                ðŸ§  Perguntar IA
              </button>
            </div>
          </div>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,280px)_minmax(0,1fr)_auto] xl:items-end">
            <label className="block text-xs font-semibold uppercase tracking-[0.24em] text-[var(--tc-text-muted,#6b7280)]">
              {copy.filterApp}
              <select
                value={selectedApplicationId}
                onChange={(event) => setSelectedApplicationId(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-[var(--tc-border,#dfe5f1)] bg-[var(--tc-surface,#f8fafc)] px-4 py-3 text-sm font-semibold text-[var(--tc-text,#0f172a)] outline-none focus:border-[var(--tc-accent,#ef0001)]"
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

            <label className="block text-xs font-semibold uppercase tracking-[0.24em] text-[var(--tc-text-muted,#6b7280)]">
              {copy.filterSearch}
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={copy.searchPlaceholder}
                className="mt-2 w-full rounded-2xl border border-[var(--tc-border,#dfe5f1)] bg-[var(--tc-surface,#f8fafc)] px-4 py-3 text-sm text-[var(--tc-text,#0f172a)] outline-none focus:border-[var(--tc-accent,#ef0001)]"
              />
            </label>

            <div className="flex flex-wrap items-center gap-2 xl:justify-end">
              <button
                type="button"
                onClick={() => void loadPlans()}
                className="inline-flex items-center gap-2 rounded-2xl border border-[var(--tc-border,#dfe5f1)] bg-[var(--tc-surface,#f8fafc)] px-4 py-3 text-sm font-semibold text-[var(--tc-text,#0f172a)]"
              >
                <FiRefreshCcw className="h-4 w-4" />
                {copy.refresh}
              </button>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => openCreate("qase")}
                  disabled={!draftCanUseQase}
                  data-testid="test-plan-new-button"
                  className="inline-flex items-center gap-2 rounded-2xl border border-[var(--tc-border,#dfe5f1)] bg-[var(--tc-surface,#f8fafc)] px-4 py-3 text-sm font-semibold text-[var(--tc-text,#0f172a)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <FiPlus className="h-4 w-4" />
                  {copy.newPlanQase}
                </button>
                <button
                  type="button"
                  onClick={() => openCreate("local")}
                  disabled={!canCreateManual}
                  className="inline-flex items-center gap-2 rounded-2xl border border-[var(--tc-border,#dfe5f1)] bg-[var(--tc-surface,#f8fafc)] px-4 py-3 text-sm font-semibold text-[var(--tc-text,#0f172a)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <FiPlus className="h-4 w-4" />
                  {copy.newPlanLocal}
                </button>
                <button
                  type="button"
                  onClick={() => openCreate("automation")}
                  disabled={!canCreateManual}
                  className="inline-flex items-center gap-2 rounded-2xl border border-[var(--tc-border,#dfe5f1)] bg-[var(--tc-surface,#f8fafc)] px-4 py-3 text-sm font-semibold text-[var(--tc-text,#0f172a)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <FiPlus className="h-4 w-4" />
                  {copy.newPlanAutomation}
                </button>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--tc-text-muted,#6b7280)]">
            <span data-testid="test-plan-context-chip" className="rounded-full border border-[var(--tc-border,#dfe5f1)] px-3 py-1.5">
              {roleLabel}
              {slug ? ` - ${slug}` : ""}
            </span>
            <span className="rounded-full border border-[var(--tc-border,#dfe5f1)] px-3 py-1.5">
              {copy.projectLabel}{" "}
              {projectCode ??
                selectedApplication?.qaseProjectCode ??
                (isAllApplicationsSelected ? copy.projectAll : copy.projectNone)}
            </span>
            <span className="rounded-full border border-[var(--tc-border,#dfe5f1)] px-3 py-1.5">
              {copy.manualLabel} {totals.manual}
            </span>
            <span className="rounded-full border border-[var(--tc-border,#dfe5f1)] px-3 py-1.5">
              {copy.localLabel} {totals.local}
            </span>
            <span className="rounded-full border border-[var(--tc-border,#dfe5f1)] px-3 py-1.5">
              {copy.automationLabel} {totals.automation}
            </span>
            <span className="rounded-full border border-[var(--tc-border,#dfe5f1)] px-3 py-1.5">
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

        <section className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-4">
            <div className="rounded-3xl border border-[var(--tc-border,#d7deea)] bg-white p-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--tc-text-muted,#6b7280)]">
                VisÃ£o geral
              </p>
              <p className="mt-2 text-2xl font-black text-[var(--tc-text,#0b1a3c)]">
                {totals.total}
              </p>
              <p className="mt-1 text-sm text-[var(--tc-text-secondary,#4b5563)]">
                Planos no filtro atual
              </p>
            </div>

            <div className="rounded-3xl border border-[var(--tc-border,#d7deea)] bg-white p-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--tc-text-muted,#6b7280)]">
                Casos vinculados
              </p>
              <p className="mt-2 text-2xl font-black text-[var(--tc-text,#0b1a3c)]">
                {totalTests}
              </p>
              <p className="mt-1 text-sm text-[var(--tc-text-secondary,#4b5563)]">
                Casos disponÃ­veis nos planos
              </p>
            </div>

            <div className="rounded-3xl border border-[var(--tc-border,#d7deea)] bg-white p-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--tc-text-muted,#6b7280)]">
                ExecuÃ§Ãµes
              </p>
              <p className="mt-2 text-2xl font-black text-[var(--tc-text,#0b1a3c)]">
                â€”
              </p>
              <p className="mt-1 text-sm text-[var(--tc-text-secondary,#4b5563)]">
                Usar tela de ExecuÃ§Ãµes
              </p>
            </div>

            <div className="rounded-3xl border border-[var(--tc-border,#d7deea)] bg-white p-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--tc-text-muted,#6b7280)]">
                Defeitos / Brian
              </p>
              <p className="mt-2 text-2xl font-black text-[var(--tc-text,#0b1a3c)]">
                â€”
              </p>
              <p className="mt-1 text-sm text-[var(--tc-text-secondary,#4b5563)]">
                Mantido fora deste patch
              </p>
            </div>
          </div>

          <div className="rounded-3xl border border-[var(--tc-border,#d7deea)] bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--tc-accent,#ef0001)]">
                  Planos de Teste
                </p>
                <h2 className="mt-1 text-lg font-black text-[var(--tc-text,#0b1a3c)]">
                  Plano â†’ Casos vinculados â†’ ExecuÃ§Ã£o â†’ Resultado
                </h2>
              </div>
              <p className="text-sm text-[var(--tc-text-secondary,#4b5563)]">
                {filteredPlans.length} plano{filteredPlans.length === 1 ? "" : "s"} exibido{filteredPlans.length === 1 ? "" : "s"}
              </p>
            </div>
          </div>

          {loadingApplications ? (
            <p className="text-sm text-[var(--tc-text-muted,#6b7280)]">{copy.loadingApps}</p>
          ) : loadingPlans ? (
            <p className="text-sm text-[var(--tc-text-muted,#6b7280)]">{copy.loadingPlans}</p>
          ) : filteredPlans.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--tc-border,#d8dee9)] bg-[var(--tc-surface,#f9fafb)] p-10 text-center">
              <FiClipboard size={30} className="mx-auto text-[var(--tc-text-muted,#6b7280)]" />
              <p className="mt-3 text-sm text-[var(--tc-text-secondary,#4b5563)]">
                {copy.emptyPlans}
              </p>
            </div>
          ) : (
            <div data-testid="test-plan-list" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredPlans.map((plan) => (
                <article
                  data-testid="test-plan-card"
                  key={`${plan.source}:${plan.id}`}
                  className="rounded-3xl border border-[var(--tc-border,#d7deea)] bg-[linear-gradient(180deg,var(--tc-surface-card-1,#f7f9fd)_0%,var(--tc-surface-card-2,#ffffff)_100%)] p-5 shadow-[0_16px_40px_rgba(15,23,42,0.05)] transition hover:border-[rgba(239,0,1,0.28)] hover:shadow-[0_18px_44px_rgba(15,23,42,0.08)] dark:shadow-none"
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
                          <span data-testid="test-plan-key" className="rounded-full border border-[var(--tc-border,#d7deea)] bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-[#55657f]">
                            {plan.id}
                          </span>
                          <span
                            className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] ${
                              plan.source === "qase"
                                ? "border border-emerald-600/30 bg-emerald-100 text-emerald-800"
                                : plan.source === "automation"
                                  ? "border border-violet-300 bg-violet-100 text-violet-800"
                                  : plan.source === "local"
                                    ? "border border-sky-300 bg-sky-100 text-sky-800"
                                    : "border border-slate-300 bg-slate-200 text-slate-800"
                            }`}
                          >
                            {plan.source === "qase"
                              ? copy.sourceQase
                              : plan.source === "automation"
                                ? copy.sourceAutomation
                                : plan.source === "local"
                                  ? copy.sourceLocal
                                  : copy.sourceManual}
                          </span>
                          {plan.projectCode ? (
                            <span className="rounded-full border border-[#d7deea] bg-[#f5f8ff] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-[#55657f]">
                              {plan.projectCode}
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
          <div data-testid="test-plan-create-modal" className="max-h-[calc(100dvh-2rem)] w-full max-w-6xl overflow-y-auto rounded-4xl border border-[var(--tc-border)] bg-white shadow-[0_30px_120px_rgba(15,23,42,0.42)]">
            <div className="bg-[linear-gradient(135deg,#011848_0%,#082457_38%,#4b0f2f_72%,#ef0001_100%)] px-6 py-5 text-white">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-white/70">
                    {draft.id ? copy.modalEditLabel : copy.modalNewLabel}
                  </p>
                  <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-white">
                    {draft.source === "qase"
                      ? copy.modalQaseTitle
                      : draft.source === "automation"
                        ? copy.modalAutomationTitle
                        : draft.source === "local"
                          ? copy.modalLocalTitle
                          : copy.modalManualTitle}
                  </h2>
                  <p className="mt-2 text-sm text-white/82">
                    {draft.source === "qase"
                      ? copy.modalQaseDesc
                      : draft.source === "automation"
                        ? copy.modalAutomationDesc
                        : draft.source === "local"
                          ? copy.modalLocalDesc
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
                  <span className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--tc-text-muted,#6b7280)]">
                    {copy.titleLabel}
                  </span>
                  <input
                    data-testid="test-plan-title-input"
                    value={draft.title}
                    onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                    className="w-full rounded-2xl border border-[var(--tc-border,#dfe5f1)] bg-[var(--tc-surface,#f8fafc)] px-4 py-3 text-sm text-[var(--tc-text,#0f172a)] outline-none focus:border-[var(--tc-accent,#ef0001)]"
                    placeholder={copy.titlePlaceholder}
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--tc-text-muted,#6b7280)]">
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
                    className="w-full rounded-2xl border border-[var(--tc-border,#dfe5f1)] bg-[var(--tc-surface,#f8fafc)] px-4 py-3 text-sm font-semibold text-[var(--tc-text,#0f172a)] outline-none focus:border-[var(--tc-accent,#ef0001)] disabled:cursor-not-allowed disabled:opacity-70"
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
                  <span className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--tc-text-muted,#6b7280)]">
                    {copy.sourceLabel}
                  </span>
                  <select
                    value={draft.source}
                    onChange={(event) => {
                      const nextValue = event.target.value as PlanDraft["source"];
                      const nextSource = nextValue === "qase" && !draftCanUseQase ? "manual" : nextValue;
                      setDraft((current) => ({
                        ...current,
                        source: nextSource,
                        cases:
                          nextSource === "qase"
                            ? current.cases.map((testCase) => ({
                                id: testCase.id,
                                title: testCase.title ?? "",
                                link:
                                  draftApplication?.qaseProjectCode
                                    ? buildQaseCaseLink(draftApplication.qaseProjectCode, testCase.id)
                                    : null,
                              }))
                            : current.cases.map((testCase) => ({
                                id: testCase.id,
                                title: testCase.title ?? "",
                                description: testCase.description ?? "",
                                preconditions: testCase.preconditions ?? "",
                                postconditions: testCase.postconditions ?? "",
                                severity: testCase.severity ?? "",
                                steps: testCase.steps ?? [],
                              })),
                      }));
                    }}
                    disabled={Boolean(draft.id)}
                    className="w-full rounded-2xl border border-[var(--tc-border,#dfe5f1)] bg-[var(--tc-surface,#f8fafc)] px-4 py-3 text-sm font-semibold text-[var(--tc-text,#0f172a)] outline-none focus:border-[var(--tc-accent,#ef0001)] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <option value="manual">{copy.sourceManual}</option>
                    <option value="local">{copy.sourceLocal}</option>
                    <option value="automation">{copy.sourceAutomation}</option>
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
                <span className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--tc-text-muted,#6b7280)]">
                  {copy.descLabel}
                </span>
                <textarea
                  data-testid="test-plan-description-input"
                  value={draft.description}
                  onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
                  rows={4}
                  className="w-full rounded-3xl border border-[var(--tc-border,#dfe5f1)] bg-[var(--tc-surface,#f8fafc)] px-4 py-3 text-sm text-[var(--tc-text,#0f172a)] outline-none focus:border-[var(--tc-accent,#ef0001)]"
                  placeholder={copy.descPlaceholder}
                />
              </label>

              <section className="rounded-3xl border border-[var(--tc-border,#dfe5f1)] bg-[#f5f7fb] p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--tc-text-muted,#6b7280)]">
                      {copy.casesSection}
                    </p>
                    <h3 className="mt-2 text-2xl font-black text-[var(--tc-text,#0f172a)]">
                      {copy.casesLinked(draft.cases.length)}
                    </h3>
                    <p className="mt-2 text-sm text-[var(--tc-text-muted,#4b5563)]">
                      {draft.source === "qase"
                        ? copy.casesQaseDesc
                        : copy.casesManualDesc}
                    </p>
                  </div>

                  {draft.source !== "qase" ? (
                    <button
                      type="button"
                      onClick={handleAddManualCase}
                      className="inline-flex items-center gap-2 rounded-2xl bg-[var(--tc-accent,#ef0001)] px-4 py-3 text-sm font-semibold text-white shadow-sm"
                    >
                      <FiPlus className="h-4 w-4" />
                      {copy.addManualCase}
                    </button>
                  ) : null}
                </div>

                {draft.source === "qase" ? (
                  <div className="mt-5 rounded-3xl border border-[var(--tc-border,#dfe5f1)] bg-white p-4">
                    <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
                      <label className="space-y-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--tc-text-muted,#6b7280)]">
                          {copy.qaseIdsLabel}
                        </span>
                        <textarea
                          data-testid="test-plan-case-search-input"
                          value={qaseCaseIdsInput}
                          onChange={(event) => setQaseCaseIdsInput(event.target.value)}
                          rows={3}
                          className="w-full rounded-3xl border border-[var(--tc-border,#dfe5f1)] bg-[var(--tc-surface,#f8fafc)] px-4 py-3 text-sm text-[var(--tc-text,#0f172a)] outline-none focus:border-[var(--tc-accent,#ef0001)]"
                          placeholder={copy.qaseIdsPlaceholder}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={handleAddQaseCases}
                        data-testid="test-plan-add-case-button"
                        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[var(--tc-border,#dfe5f1)] bg-[var(--tc-surface,#f8fafc)] px-4 py-3 text-sm font-semibold text-[var(--tc-text,#0f172a)]"
                      >
                        <FiPlus className="h-4 w-4" />
                        {copy.linkCases}
                      </button>
                    </div>
                    <p className="mt-3 text-xs text-[var(--tc-text-muted,#6b7280)]">
                      {copy.qaseIdsNote}
                    </p>
                  </div>
                ) : null}

                <div data-testid="test-plan-linked-cases" className="mt-5 space-y-3">
                  {loadingPlanDetail ? (
                    <div className="rounded-2xl border border-[var(--tc-border,#dfe5f1)] bg-white px-4 py-4 text-sm text-[var(--tc-text-muted,#6b7280)]">
                      {copy.loadingPlanDetail}
                    </div>
                  ) : draft.cases.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-[var(--tc-border,#dfe5f1)] bg-white px-4 py-6 text-center text-sm text-[var(--tc-text-muted,#6b7280)]">
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
                          data-testid="test-plan-case-option"
                          key={`${draft.source}:${testCase.id}:${index}`}
                          className="overflow-hidden rounded-3xl border border-[var(--tc-border,#dfe5f1)] bg-white shadow-sm"
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
                                <span className="rounded-full border border-[var(--tc-border,#dfe5f1)] px-3 py-1 text-[10px] font-mono font-semibold uppercase tracking-[0.24em] text-[var(--tc-text-muted,#6b7280)]">
                                  ID {testCase.id}
                                </span>
                                {testCase.link ? (
                                  <a
                                    href={testCase.link}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 rounded-full border border-[var(--tc-border,#dfe5f1)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--tc-text,#0f172a)]"
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
                                  <h4 className="truncate text-base font-bold text-[var(--tc-text,#0f172a)]">
                                    {formatCaseTitle(testCase, draft.source, index, copy)}
                                  </h4>
                                  {meta ? (
                                    <p className="mt-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--tc-text-muted,#6b7280)]">
                                      {meta}
                                    </p>
                                  ) : null}
                                </div>

                                <span className="mt-1 text-[var(--tc-text-muted,#6b7280)]">
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
                            <div className="border-t border-[var(--tc-border,#e5e7eb)] bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-white/10 dark:bg-amber-400/10 dark:text-amber-100">
                              {detailError}
                            </div>
                          ) : null}

                          {isExpanded ? (
                            <div data-testid="test-plan-detail" className="border-t border-[var(--tc-border,#e5e7eb)] px-4 py-4 dark:border-white/10">
                              {draft.source === "qase" ? (
                                detailLoading ? (
                                  <div className="rounded-2xl border border-[var(--tc-border,#dfe5f1)] bg-[var(--tc-surface-alt,#f8fafc)] px-4 py-4 text-sm text-[var(--tc-text-muted,#6b7280)]">
                                    {copy.loadingCaseDetail}
                                  </div>
                                ) : (
                                  <div className="space-y-4">
                                    <div className="grid gap-4 xl:grid-cols-2">
                                      <div className="rounded-2xl border border-[var(--tc-border,#dfe5f1)] bg-[var(--tc-surface-alt,#f8fafc)] p-4">
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--tc-text-muted,#6b7280)]">
                                          {copy.descriptionLabel}
                                        </p>
                                        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[var(--tc-text-muted,#4b5563)]">
                                          {trimText(testCase.description) ?? copy.noQaseDescription}
                                        </p>
                                      </div>
                                      <div className="grid gap-4">
                                        <div className="rounded-2xl border border-[var(--tc-border,#dfe5f1)] bg-[var(--tc-surface-alt,#f8fafc)] p-4">
                                          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--tc-text-muted,#6b7280)]">
                                            {copy.preconditionsLabel}
                                          </p>
                                          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[var(--tc-text-muted,#4b5563)]">
                                            {trimText(testCase.preconditions) ?? copy.noPreconditions}
                                          </p>
                                        </div>
                                        <div className="rounded-2xl border border-[var(--tc-border,#dfe5f1)] bg-[var(--tc-surface-alt,#f8fafc)] p-4">
                                          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--tc-text-muted,#6b7280)]">
                                            {copy.postconditionsLabel}
                                          </p>
                                          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[var(--tc-text-muted,#4b5563)]">
                                            {trimText(testCase.postconditions) ?? copy.noPostconditions}
                                          </p>
                                          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--tc-text-muted,#6b7280)]">
                                            {copy.severityLabel} {trimText(testCase.severity) ?? copy.severityNotSet}
                                          </p>
                                        </div>
                                      </div>
                                    </div>

                                    <div className="rounded-2xl border border-[var(--tc-border,#dfe5f1)] bg-[var(--tc-surface-alt,#f8fafc)] p-4">
                                      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--tc-text-muted,#6b7280)]">
                                        {copy.stepsLabel}
                                      </p>
                                      {Array.isArray(testCase.steps) && testCase.steps.length ? (
                                        <div className="mt-4 space-y-3">
                                          {testCase.steps.map((step, stepIndex) => (
                                            <div
                                              key={`${testCase.id}:${step.id}:${stepIndex}`}
                                              className="rounded-2xl border border-[var(--tc-border,#dfe5f1)] bg-white p-4"
                                            >
                                              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--tc-text-muted,#6b7280)]">
                                                {copy.stepLabel(stepIndex + 1)}
                                              </p>
                                              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[var(--tc-text,#0f172a)]">
                                                {trimText(step.action) ?? copy.noAction}
                                              </p>
                                              <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--tc-text-muted,#6b7280)]">
                                                {copy.expectedResult}
                                              </p>
                                              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--tc-text-muted,#4b5563)]">
                                                {trimText(step.expectedResult) ?? copy.notSpecified}
                                              </p>
                                              {trimText(step.data) ? (
                                                <>
                                                  <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--tc-text-muted,#6b7280)]">
                                                    {copy.dataLabel}
                                                  </p>
                                                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--tc-text-muted,#4b5563)]">
                                                    {trimText(step.data)}
                                                  </p>
                                                </>
                                              ) : null}
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <p className="mt-3 text-sm text-[var(--tc-text-muted,#4b5563)]">
                                          {copy.noSteps}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                )
                              ) : (
                                <div className="space-y-4">
                                  <div className="grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)]">
                                    <label className="space-y-2">
                                      <span className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--tc-text-muted,#6b7280)]">
                                        {copy.caseIdLabel}
                                      </span>
                                      <input
                                        value={testCase.id}
                                        onChange={(event) => {
                                          const nextId = event.target.value;
                                          updateDraftCase(testCase.id, (current) => ({
                                            ...current,
                                            id: nextId,
                                          }));
                                        }}
                                        className="w-full rounded-2xl border border-[var(--tc-border,#dfe5f1)] bg-[var(--tc-surface,#f8fafc)] px-4 py-3 text-sm font-mono text-[var(--tc-text,#0f172a)] outline-none focus:border-[var(--tc-accent,#ef0001)]"
                                        placeholder="TC-000"
                                      />
                                    </label>

                                    <label className="space-y-2">
                                      <span className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--tc-text-muted,#6b7280)]">
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
                                        className="w-full rounded-2xl border border-[var(--tc-border,#dfe5f1)] bg-[var(--tc-surface,#f8fafc)] px-4 py-3 text-sm text-[var(--tc-text,#0f172a)] outline-none focus:border-[var(--tc-accent,#ef0001)]"
                                        placeholder={copy.caseTitlePlaceholder}
                                      />
                                    </label>
                                  </div>

                                  <div className="grid gap-4 xl:grid-cols-2">
                                    <label className="space-y-2">
                                      <span className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--tc-text-muted,#6b7280)]">
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
                                        className="w-full rounded-3xl border border-[var(--tc-border,#dfe5f1)] bg-[var(--tc-surface,#f8fafc)] px-4 py-3 text-sm text-[var(--tc-text,#0f172a)] outline-none focus:border-[var(--tc-accent,#ef0001)]"
                                        placeholder={copy.caseDescPlaceholder}
                                      />
                                    </label>

                                    <div className="grid gap-4">
                                      <label className="space-y-2">
                                        <span className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--tc-text-muted,#6b7280)]">
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
                                          className="w-full rounded-3xl border border-[var(--tc-border,#dfe5f1)] bg-[var(--tc-surface,#f8fafc)] px-4 py-3 text-sm text-[var(--tc-text,#0f172a)] outline-none focus:border-[var(--tc-accent,#ef0001)]"
                                          placeholder={copy.casePrecondPlaceholder}
                                        />
                                      </label>

                                      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_220px]">
                                        <label className="space-y-2">
                                          <span className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--tc-text-muted,#6b7280)]">
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
                                            className="w-full rounded-3xl border border-[var(--tc-border,#dfe5f1)] bg-[var(--tc-surface,#f8fafc)] px-4 py-3 text-sm text-[var(--tc-text,#0f172a)] outline-none focus:border-[var(--tc-accent,#ef0001)]"
                                            placeholder={copy.casePostcondPlaceholder}
                                          />
                                        </label>

                                        <label className="space-y-2">
                                          <span className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--tc-text-muted,#6b7280)]">
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
                                            className="w-full rounded-2xl border border-[var(--tc-border,#dfe5f1)] bg-[var(--tc-surface,#f8fafc)] px-4 py-3 text-sm font-semibold text-[var(--tc-text,#0f172a)] outline-none focus:border-[var(--tc-accent,#ef0001)]"
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

                                  <div className="rounded-2xl border border-[var(--tc-border,#dfe5f1)] bg-[var(--tc-surface-alt,#f8fafc)] p-4">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                      <div>
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--tc-text-muted,#6b7280)]">
                                          {copy.stepsLabel}
                                        </p>
                                        <p className="mt-2 text-sm text-[var(--tc-text-muted,#4b5563)]">
                                          {copy.stepsDesc}
                                        </p>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => handleAddManualStep(testCase.id)}
                                        className="inline-flex items-center gap-2 rounded-2xl border border-[var(--tc-border,#dfe5f1)] bg-white px-4 py-3 text-sm font-semibold text-[var(--tc-text,#0f172a)]"
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
                                            className="rounded-2xl border border-[var(--tc-border,#dfe5f1)] bg-white p-4 dark:border-white/10 dark:bg-[#101827]"
                                          >
                                            <div className="flex flex-wrap items-center justify-between gap-3">
                                              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--tc-text-muted,#6b7280)]">
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
                                                <span className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--tc-text-muted,#6b7280)]">
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
                                                  className="w-full rounded-3xl border border-[var(--tc-border,#dfe5f1)] bg-[var(--tc-surface,#f8fafc)] px-4 py-3 text-sm text-[var(--tc-text,#0f172a)] outline-none focus:border-[var(--tc-accent,#ef0001)]"
                                                  placeholder={copy.actionPlaceholder}
                                                />
                                              </label>

                                              <label className="space-y-2">
                                                <span className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--tc-text-muted,#6b7280)]">
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
                                                  className="w-full rounded-3xl border border-[var(--tc-border,#dfe5f1)] bg-[var(--tc-surface,#f8fafc)] px-4 py-3 text-sm text-[var(--tc-text,#0f172a)] outline-none focus:border-[var(--tc-accent,#ef0001)]"
                                                  placeholder={copy.expectedResultPlaceholder}
                                                />
                                              </label>
                                            </div>

                                            <label className="mt-4 block space-y-2">
                                              <span className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--tc-text-muted,#6b7280)]">
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
                                                className="w-full rounded-2xl border border-[var(--tc-border,#dfe5f1)] bg-[var(--tc-surface,#f8fafc)] px-4 py-3 text-sm text-[var(--tc-text,#0f172a)] outline-none focus:border-[var(--tc-accent,#ef0001)]"
                                                placeholder={copy.stepDataPlaceholder}
                                              />
                                            </label>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <div className="mt-4 rounded-2xl border border-dashed border-[var(--tc-border,#dfe5f1)] bg-white px-4 py-5 text-sm text-[var(--tc-text-muted,#4b5563)]">
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

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--tc-border,#e5e7eb)] pt-4">
                <div className="text-xs text-[var(--tc-text-muted,#6b7280)]">
                  {copy.appInFocus}{" "}
                  <span className="font-semibold text-[var(--tc-text,#0f172a)]">
                    {draftApplication?.name ?? copy.noApp}
                  </span>
                  {draftApplication?.qaseProjectCode ? ` | Qase ${draftApplication.qaseProjectCode}` : ""}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="rounded-2xl border border-[var(--tc-border,#dfe5f1)] bg-[var(--tc-surface,#f8fafc)] px-4 py-3 text-sm font-semibold text-[var(--tc-text,#0f172a)]"
                  >
                    {copy.cancel}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSave()}
                    disabled={saving || loadingPlanDetail}
                    data-testid="test-plan-save-button"
                    className="rounded-2xl bg-[var(--tc-accent,#ef0001)] px-5 py-3 text-sm font-semibold text-white shadow-sm disabled:opacity-60"
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


