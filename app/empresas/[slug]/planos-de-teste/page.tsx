"use client";

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
} from "react-icons/fi";
import { useAppShellCoverSlot } from "@/components/AppShellCoverSlotContext";
import { fetchApi } from "@/lib/api";
import {
  buildQaseCaseLink,
  createEmptyCaseStep,
  createEmptyManualCase,
  isCaseEffectivelyEmpty,
  parseQaseCaseIdsInput,
  type TestPlanCase,
  type TestPlanCaseStep,
} from "@/lib/testPlanCases";

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
};

type PlanDraft = {
  id?: string;
  applicationId?: string;
  source: "manual" | "qase";
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

const MANUAL_SEVERITY_OPTIONS = [
  { value: "", label: "Sem severidade" },
  { value: "low", label: "Baixa" },
  { value: "medium", label: "Media" },
  { value: "high", label: "Alta" },
  { value: "critical", label: "Critica" },
];

function formatDate(value?: string | null) {
  if (!value) return "Sem data";
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return "Sem data";
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

function formatCaseTitle(testCase: TestPlanCase, source: "manual" | "qase", index: number) {
  if (trimText(testCase.title)) return trimText(testCase.title) as string;
  return source === "qase" ? `Caso Qase ${testCase.id}` : `Caso manual ${index + 1}`;
}

function formatCaseMeta(testCase: TestPlanCase) {
  const parts = [
    trimText(testCase.severity) ? `Severidade ${trimText(testCase.severity)}` : null,
    Array.isArray(testCase.steps) && testCase.steps.length ? `${testCase.steps.length} passos` : null,
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
    }))
    .filter((testCase) => testCase.id)
    .filter((testCase) => !isCaseEffectivelyEmpty(testCase));
}

export default function TestPlansPage() {
  const { slug } = useParams<{ slug: string }>();
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
        if (!response.ok) throw new Error("Erro ao carregar aplicacoes");
        const items = Array.isArray(payload?.items) ? (payload.items as ApplicationItem[]) : [];
        if (canceled) return;
        setApplications(items);
        setSelectedApplicationId("");
      } catch {
        if (!canceled) setError("Nao foi possivel carregar as aplicacoes da empresa.");
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
        throw new Error("Erro ao carregar planos");
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
      setError("Nao foi possivel consultar os planos de teste.");
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
              Total
            </div>
            <div className="mt-2 text-3xl font-black text-white">{totals.total}</div>
          </div>
          <div className="rounded-2xl border border-white/16 bg-white/10 px-4 py-3 backdrop-blur">
            <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/68">
              Qase
            </div>
            <div className="mt-2 text-3xl font-black text-white">{totals.qase}</div>
          </div>
          <div className="rounded-2xl border border-white/16 bg-white/10 px-4 py-3 backdrop-blur">
            <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/68">
              Casos
            </div>
            <div className="mt-2 text-3xl font-black text-white">{totalTests}</div>
          </div>
        </div>
      </div>
    ),
    [totalTests, totals.qase, totals.total],
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
          ? "Nenhuma aplicacao com projeto Qase vinculado esta disponivel para criar o plano."
          : "Nenhuma aplicacao disponivel para criar o plano.",
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
        throw new Error("Erro ao abrir plano");
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
      setExpandedCaseId(nextCases[0]?.id ?? null);
    } catch {
      setError("Nao foi possivel abrir o plano selecionado.");
      closeModal();
    } finally {
      setLoadingPlanDetail(false);
    }
  }

  async function handleDelete(plan: TestPlanItem) {
    if (!slug) return;
    const confirmed =
      typeof window === "undefined" ? true : window.confirm(`Remover o plano "${plan.title}"?`);
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
        throw new Error(typeof payload?.error === "string" ? payload.error : "Erro ao remover plano");
      }
      await loadPlans();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Nao foi possivel remover o plano.");
    }
  }

  async function handleSave() {
    const effectiveApplicationId = draft.applicationId ?? selectedApplication?.id ?? null;
    if (!slug || !effectiveApplicationId) {
      setError("Selecione uma aplicacao especifica para salvar um plano.");
      return;
    }

    const title = draft.title.trim();
    if (!title) {
      setError("Informe o titulo do plano.");
      return;
    }

    if (draft.source === "manual") {
      const untitledCase = draft.cases.find(
        (testCase) => !isCaseEffectivelyEmpty(testCase) && !trimText(testCase.title),
      );
      if (untitledCase) {
        setError(`Informe o titulo do caso manual ${untitledCase.id}.`);
        return;
      }
    }

    const casesPayload = normalizeCasesForSave(draft.source, draft.cases);
    if (draft.source === "qase" && !casesPayload.length) {
      setError("Informe ao menos um case ID numerico para o plano do Qase.");
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
          projectCode: draftApplication?.qaseProjectCode ?? projectCode,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(typeof payload?.error === "string" ? payload.error : "Erro ao salvar plano");
      }
      closeModal();
      await loadPlans();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Nao foi possivel salvar o plano.");
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
      setError("Informe pelo menos um case ID numerico para adicionar ao plano do Qase.");
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
      setError("Nenhum case ID numerico valido foi encontrado.");
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
        throw new Error(typeof payload?.error === "string" ? payload.error : "Erro ao carregar caso");
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
        [caseId]: cause instanceof Error ? cause.message : "Nao foi possivel carregar o caso do Qase.",
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
        <section className="rounded-3xl border border-(--tc-border,#e5e7eb) bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#121b2d]">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,280px)_minmax(0,1fr)_auto] xl:items-end">
            <label className="block text-xs font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">
              Aplicacao
              <select
                value={selectedApplicationId}
                onChange={(event) => setSelectedApplicationId(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-(--tc-border,#dfe5f1) bg-(--tc-surface,#f8fafc) px-4 py-3 text-sm font-semibold text-(--tc-text,#0f172a) outline-none focus:border-(--tc-accent,#ef0001)"
              >
                <option value="">Todas</option>
                {applications.map((application) => (
                  <option key={application.id} value={application.id}>
                    {application.name}
                    {application.qaseProjectCode ? ` (${application.qaseProjectCode})` : " (manual)"}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-xs font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">
              Buscar
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Titulo, descricao, projeto ou origem"
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
                Atualizar
              </button>
              <button
                type="button"
                onClick={() => openCreate("manual")}
                disabled={!canCreateManual}
                className="inline-flex items-center gap-2 rounded-2xl border border-(--tc-border,#dfe5f1) bg-(--tc-surface,#f8fafc) px-4 py-3 text-sm font-semibold text-(--tc-text,#0f172a)"
              >
                <FiPlus className="h-4 w-4" />
                Novo plano
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.18em] text-(--tc-text-muted,#6b7280)">
            <span className="rounded-full border border-(--tc-border,#dfe5f1) px-3 py-1.5">
              Projeto:{" "}
              {projectCode ??
                selectedApplication?.qaseProjectCode ??
                (isAllApplicationsSelected ? "Todos" : "Sem Qase")}
            </span>
            <span className="rounded-full border border-(--tc-border,#dfe5f1) px-3 py-1.5">
              Manual: {totals.manual}
            </span>
            <span className="rounded-full border border-(--tc-border,#dfe5f1) px-3 py-1.5">
              Integrado: {totals.qase}
            </span>
          </div>
        </section>

        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-100">
            {error}
          </div>
        ) : null}

        {warning ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-100">
            {warning}
          </div>
        ) : null}

        <section className="rounded-3xl border border-(--tc-border,#e5e7eb) bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#121b2d]">
          {loadingApplications ? (
            <p className="text-sm text-(--tc-text-muted,#6b7280)">Carregando aplicacoes...</p>
          ) : loadingPlans ? (
            <p className="text-sm text-(--tc-text-muted,#6b7280)">Carregando planos de teste...</p>
          ) : filteredPlans.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-(--tc-border,#d8dee9) bg-(--tc-surface,#f9fafb) p-10 text-center dark:border-white/10 dark:bg-[#0f172a]">
              <FiClipboard size={30} className="mx-auto text-(--tc-text-muted,#6b7280)" />
              <p className="mt-3 text-sm text-(--tc-text-secondary,#4b5563)">
                Nenhum plano encontrado para os filtros atuais.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
              {filteredPlans.map((plan) => (
                <article
                  key={`${plan.source}:${plan.id}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => void openEdit(plan)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      void openEdit(plan);
                    }
                  }}
                  className="cursor-pointer rounded-3xl border border-(--tc-border,#dfe5f1) bg-(--tc-surface,#f9fafb) p-5 shadow-sm transition hover:border-(--tc-accent,#ef0001)/45 dark:border-white/10 dark:bg-[#0f172a]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] ${
                            plan.source === "qase"
                              ? "border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-100"
                              : "border border-slate-200 bg-slate-100 text-slate-700 dark:border-white/15 dark:bg-white/10 dark:text-white/85"
                          }`}
                        >
                          {plan.source === "qase" ? "Qase" : "Manual"}
                        </span>
                        {plan.projectCode ? (
                          <span className="rounded-full border border-(--tc-border,#dfe5f1) px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">
                            {plan.projectCode}
                          </span>
                        ) : null}
                      </div>
                      <h2 className="mt-3 text-lg font-extrabold text-(--tc-text,#0b1a3c) dark:text-white">
                        {plan.title}
                      </h2>
                      <p className="mt-2 text-xs font-semibold uppercase tracking-[0.22em] text-(--tc-text-muted,#6b7280)">
                        {plan.applicationName ?? "Aplicacao nao identificada"}
                      </p>
                    </div>

                    <div className="inline-flex items-center gap-2 rounded-full border border-(--tc-border,#dfe5f1) bg-white px-3 py-1.5 text-xs font-semibold text-(--tc-text,#0f172a) dark:border-white/10 dark:bg-[#182235] dark:text-white">
                      <FiLayers className="h-3.5 w-3.5" />
                      {plan.casesCount} casos
                    </div>
                  </div>

                  <p className="mt-4 min-h-18 text-sm leading-6 text-(--tc-text-secondary,#4b5563) dark:text-white/74">
                    {plan.description?.trim() || "Plano sem descricao detalhada."}
                  </p>

                  <div className="mt-4 text-xs text-(--tc-text-muted,#6b7280)">
                    Criado: {formatDate(plan.createdAt)} | Atualizado: {formatDate(plan.updatedAt)}
                  </div>

                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-(--tc-text-muted,#6b7280)">
                      Clique para ver casos e detalhes
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          void openEdit(plan);
                        }}
                        className="inline-flex items-center gap-2 rounded-xl border border-(--tc-border,#dfe5f1) bg-white px-3 py-2 text-xs font-semibold text-(--tc-text,#0f172a) dark:border-white/10 dark:bg-[#182235] dark:text-white"
                      >
                        <FiEdit2 className="h-3.5 w-3.5" />
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleDelete(plan);
                        }}
                        className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:border-rose-400/25 dark:bg-rose-500/10 dark:text-rose-100"
                      >
                        <FiTrash2 className="h-3.5 w-3.5" />
                        Excluir
                      </button>
                    </div>
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
          <div className="max-h-[calc(100dvh-2rem)] w-full max-w-6xl overflow-y-auto rounded-4xl border border-white/20 bg-white shadow-[0_30px_120px_rgba(15,23,42,0.42)] dark:bg-[#101827]">
            <div className="bg-[linear-gradient(135deg,#011848_0%,#21438f_48%,#ef0001_100%)] px-6 py-5 text-white">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-white/70">
                    {draft.id ? "Editar plano" : "Novo plano"}
                  </p>
                  <h2 className="mt-2 text-3xl font-black tracking-[-0.04em]">
                    {draft.source === "qase" ? "Plano integrado Qase" : "Plano manual"}
                  </h2>
                  <p className="mt-2 text-sm text-white/82">
                    {draft.source === "qase"
                      ? "Visualize os casos vinculados, adicione novos IDs e expanda cada item para consultar os detalhes do Qase."
                      : "Os casos manuais ficam visiveis no proprio plano, com titulo rapido e campos completos para detalhamento."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeModal}
                  className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-white"
                  aria-label="Fechar modal"
                >
                  <FiX className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="space-y-6 px-6 py-6">
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_260px_220px]">
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.25em] text-(--tc-text-muted,#6b7280)">
                    Titulo
                  </span>
                  <input
                    value={draft.title}
                    onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                    className="w-full rounded-2xl border border-(--tc-border,#dfe5f1) bg-(--tc-surface,#f8fafc) px-4 py-3 text-sm text-(--tc-text,#0f172a) outline-none focus:border-(--tc-accent,#ef0001)"
                    placeholder="Ex: Regressao sprint 32"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.25em] text-(--tc-text-muted,#6b7280)">
                    Aplicacao
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
                    <option value="">Selecione</option>
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
                    Origem
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
                    <option value="manual">Manual local</option>
                    {draftCanUseQase ? <option value="qase">Qase</option> : null}
                  </select>
                </label>
              </div>

              {!draft.id && !draftCanUseQase ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-100">
                  A aplicacao escolhida nao possui projeto Qase vinculado. Para criar no Qase, selecione uma aplicacao com codigo de projeto.
                </div>
              ) : null}

              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.25em] text-(--tc-text-muted,#6b7280)">
                  Descricao do plano
                </span>
                <textarea
                  value={draft.description}
                  onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
                  rows={4}
                  className="w-full rounded-3xl border border-(--tc-border,#dfe5f1) bg-(--tc-surface,#f8fafc) px-4 py-3 text-sm text-(--tc-text,#0f172a) outline-none focus:border-(--tc-accent,#ef0001)"
                  placeholder="Contexto, objetivo e recorte do plano."
                />
              </label>

              <section className="rounded-3xl border border-(--tc-border,#dfe5f1) bg-(--tc-surface,#f9fafb) p-5 dark:border-white/10 dark:bg-[#0f172a]">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-(--tc-text-muted,#6b7280)">
                      Casos do plano
                    </p>
                    <h3 className="mt-2 text-2xl font-black text-(--tc-text,#0f172a) dark:text-white">
                      {draft.cases.length} caso{draft.cases.length === 1 ? "" : "s"} vinculado{draft.cases.length === 1 ? "" : "s"}
                    </h3>
                    <p className="mt-2 text-sm text-(--tc-text-secondary,#4b5563) dark:text-white/72">
                      {draft.source === "qase"
                        ? "Cada caso mostra ID, titulo, link direto e expande os detalhes sob demanda."
                        : "No manual, cada caso pode ser criado so com titulo e ganhar detalhes completos quando voce expandir."}
                    </p>
                  </div>

                  {draft.source === "manual" ? (
                    <button
                      type="button"
                      onClick={handleAddManualCase}
                      className="inline-flex items-center gap-2 rounded-2xl bg-(--tc-accent,#ef0001) px-4 py-3 text-sm font-semibold text-white shadow-sm"
                    >
                      <FiPlus className="h-4 w-4" />
                      Adicionar caso manual
                    </button>
                  ) : null}
                </div>

                {draft.source === "qase" ? (
                  <div className="mt-5 rounded-3xl border border-(--tc-border,#dfe5f1) bg-white p-4 dark:border-white/10 dark:bg-[#101827]">
                    <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
                      <label className="space-y-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.25em] text-(--tc-text-muted,#6b7280)">
                          IDs dos casos Qase
                        </span>
                        <textarea
                          value={qaseCaseIdsInput}
                          onChange={(event) => setQaseCaseIdsInput(event.target.value)}
                          rows={3}
                          className="w-full rounded-3xl border border-(--tc-border,#dfe5f1) bg-(--tc-surface,#f8fafc) px-4 py-3 text-sm text-(--tc-text,#0f172a) outline-none focus:border-(--tc-accent,#ef0001)"
                          placeholder="IDs numericos separados por linha ou virgula. Ex: 101, 102, 103"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={handleAddQaseCases}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-(--tc-border,#dfe5f1) bg-(--tc-surface,#f8fafc) px-4 py-3 text-sm font-semibold text-(--tc-text,#0f172a)"
                      >
                        <FiPlus className="h-4 w-4" />
                        Vincular casos
                      </button>
                    </div>
                    <p className="mt-3 text-xs text-(--tc-text-muted,#6b7280)">
                      O plano do Qase aceita apenas case IDs numericos. Ao expandir um item, a tela consulta descricao, pre-condicoes, pos-condicoes, severidade e passos do caso.
                    </p>
                  </div>
                ) : null}

                <div className="mt-5 space-y-3">
                  {loadingPlanDetail ? (
                    <div className="rounded-2xl border border-(--tc-border,#dfe5f1) bg-white px-4 py-4 text-sm text-(--tc-text-secondary,#4b5563) dark:border-white/10 dark:bg-[#101827] dark:text-white/72">
                      Carregando detalhes do plano...
                    </div>
                  ) : draft.cases.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-(--tc-border,#dfe5f1) bg-white px-4 py-6 text-center text-sm text-(--tc-text-secondary,#4b5563) dark:border-white/10 dark:bg-[#101827] dark:text-white/72">
                      {draft.source === "qase"
                        ? "Adicione IDs de casos do Qase para visualizar a lista."
                        : "Adicione um caso manual para montar titulo, passos e criterios do plano."}
                    </div>
                  ) : (
                    draft.cases.map((testCase, index) => {
                      const isExpanded = expandedCaseId === testCase.id;
                      const detailError = caseErrors[testCase.id];
                      const detailLoading = Boolean(loadingCaseDetails[testCase.id]);
                      const meta = formatCaseMeta(testCase);

                      return (
                        <div
                          key={`${draft.source}:${testCase.id}:${index}`}
                          className="overflow-hidden rounded-3xl border border-(--tc-border,#dfe5f1) bg-white shadow-sm dark:border-white/10 dark:bg-[#101827]"
                        >
                          <div className="flex items-stretch gap-3 px-4 py-4">
                            <button
                              type="button"
                              onClick={() => void toggleCase(testCase.id)}
                              className="flex min-w-0 flex-1 items-start justify-between gap-4 text-left"
                            >
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span
                                    className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] ${
                                      draft.source === "qase"
                                        ? "border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-100"
                                        : "border border-slate-200 bg-slate-100 text-slate-700 dark:border-white/15 dark:bg-white/10 dark:text-white/85"
                                    }`}
                                  >
                                    {draft.source === "qase" ? "Qase" : "Manual"}
                                  </span>
                                  <span className="rounded-full border border-(--tc-border,#dfe5f1) px-3 py-1 text-[10px] font-mono font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">
                                    ID {testCase.id}
                                  </span>
                                  {testCase.link ? (
                                    <a
                                      href={testCase.link}
                                      target="_blank"
                                      rel="noreferrer"
                                      onClick={(event) => event.stopPropagation()}
                                      className="inline-flex items-center gap-1 rounded-full border border-(--tc-border,#dfe5f1) px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-(--tc-text,#0f172a) dark:border-white/10 dark:text-white/80"
                                    >
                                      Abrir link
                                      <FiExternalLink className="h-3 w-3" />
                                    </a>
                                  ) : null}
                                </div>
                                <h4 className="mt-3 truncate text-base font-bold text-(--tc-text,#0f172a) dark:text-white">
                                  {formatCaseTitle(testCase, draft.source, index)}
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

                            <button
                              type="button"
                              onClick={() => handleRemoveCase(testCase.id)}
                              className="self-start rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:border-rose-400/25 dark:bg-rose-500/10 dark:text-rose-100"
                            >
                              Remover
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
                                  <div className="rounded-2xl border border-(--tc-border,#dfe5f1) bg-(--tc-surface,#f8fafc) px-4 py-4 text-sm text-(--tc-text-secondary,#4b5563) dark:border-white/10 dark:bg-[#0f172a] dark:text-white/72">
                                    Carregando detalhes do caso do Qase...
                                  </div>
                                ) : (
                                  <div className="space-y-4">
                                    <div className="grid gap-4 xl:grid-cols-2">
                                      <div className="rounded-2xl border border-(--tc-border,#dfe5f1) bg-(--tc-surface,#f8fafc) p-4 dark:border-white/10 dark:bg-[#0f172a]">
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-(--tc-text-muted,#6b7280)">
                                          Descricao
                                        </p>
                                        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-(--tc-text-secondary,#4b5563) dark:text-white/76">
                                          {trimText(testCase.description) ?? "Sem descricao detalhada no Qase."}
                                        </p>
                                      </div>
                                      <div className="grid gap-4">
                                        <div className="rounded-2xl border border-(--tc-border,#dfe5f1) bg-(--tc-surface,#f8fafc) p-4 dark:border-white/10 dark:bg-[#0f172a]">
                                          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-(--tc-text-muted,#6b7280)">
                                            Pre-condicoes
                                          </p>
                                          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-(--tc-text-secondary,#4b5563) dark:text-white/76">
                                            {trimText(testCase.preconditions) ?? "Sem pre-condicoes cadastradas."}
                                          </p>
                                        </div>
                                        <div className="rounded-2xl border border-(--tc-border,#dfe5f1) bg-(--tc-surface,#f8fafc) p-4 dark:border-white/10 dark:bg-[#0f172a]">
                                          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-(--tc-text-muted,#6b7280)">
                                            Pos-condicoes e severidade
                                          </p>
                                          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-(--tc-text-secondary,#4b5563) dark:text-white/76">
                                            {trimText(testCase.postconditions) ?? "Sem pos-condicoes cadastradas."}
                                          </p>
                                          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">
                                            Severidade: {trimText(testCase.severity) ?? "Nao informada"}
                                          </p>
                                        </div>
                                      </div>
                                    </div>

                                    <div className="rounded-2xl border border-(--tc-border,#dfe5f1) bg-(--tc-surface,#f8fafc) p-4 dark:border-white/10 dark:bg-[#0f172a]">
                                      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-(--tc-text-muted,#6b7280)">
                                        Passos
                                      </p>
                                      {Array.isArray(testCase.steps) && testCase.steps.length ? (
                                        <div className="mt-4 space-y-3">
                                          {testCase.steps.map((step, stepIndex) => (
                                            <div
                                              key={`${testCase.id}:${step.id}:${stepIndex}`}
                                              className="rounded-2xl border border-(--tc-border,#dfe5f1) bg-white p-4 dark:border-white/10 dark:bg-[#101827]"
                                            >
                                              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">
                                                Passo {stepIndex + 1}
                                              </p>
                                              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-(--tc-text,#0f172a) dark:text-white/85">
                                                {trimText(step.action) ?? "Sem acao descrita."}
                                              </p>
                                              <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">
                                                Resultado esperado
                                              </p>
                                              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-(--tc-text-secondary,#4b5563) dark:text-white/76">
                                                {trimText(step.expectedResult) ?? "Nao informado."}
                                              </p>
                                              {trimText(step.data) ? (
                                                <>
                                                  <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">
                                                    Dados
                                                  </p>
                                                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-(--tc-text-secondary,#4b5563) dark:text-white/76">
                                                    {trimText(step.data)}
                                                  </p>
                                                </>
                                              ) : null}
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <p className="mt-3 text-sm text-(--tc-text-secondary,#4b5563) dark:text-white/76">
                                          O caso do Qase nao retornou passos estruturados.
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                )
                              ) : (
                                <div className="space-y-4">
                                  <div className="grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)]">
                                    <label className="space-y-2">
                                      <span className="text-xs font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">
                                        ID do caso
                                      </span>
                                      <input
                                        value={testCase.id}
                                        readOnly
                                        className="w-full rounded-2xl border border-(--tc-border,#dfe5f1) bg-(--tc-surface,#eef2ff) px-4 py-3 text-sm font-mono text-(--tc-text,#0f172a) outline-none"
                                      />
                                    </label>

                                    <label className="space-y-2">
                                      <span className="text-xs font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">
                                        Titulo do caso
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
                                        placeholder="Ex: Login com operador"
                                      />
                                    </label>
                                  </div>

                                  <div className="grid gap-4 xl:grid-cols-2">
                                    <label className="space-y-2">
                                      <span className="text-xs font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">
                                        Descricao
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
                                        placeholder="Descreva o objetivo e o contexto do caso."
                                      />
                                    </label>

                                    <div className="grid gap-4">
                                      <label className="space-y-2">
                                        <span className="text-xs font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">
                                          Pre-condicoes
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
                                          placeholder="Estado inicial necessario antes do teste."
                                        />
                                      </label>

                                      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_220px]">
                                        <label className="space-y-2">
                                          <span className="text-xs font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">
                                            Pos-condicoes
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
                                            placeholder="Estado esperado apos a execucao."
                                          />
                                        </label>

                                        <label className="space-y-2">
                                          <span className="text-xs font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">
                                            Severidade
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
                                            {MANUAL_SEVERITY_OPTIONS.map((option) => (
                                              <option key={option.value || "none"} value={option.value}>
                                                {option.label}
                                              </option>
                                            ))}
                                          </select>
                                        </label>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="rounded-2xl border border-(--tc-border,#dfe5f1) bg-(--tc-surface,#f8fafc) p-4 dark:border-white/10 dark:bg-[#0f172a]">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                      <div>
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-(--tc-text-muted,#6b7280)">
                                          Passos
                                        </p>
                                        <p className="mt-2 text-sm text-(--tc-text-secondary,#4b5563) dark:text-white/72">
                                          Crie o caso so com titulo e detalhe os passos apenas quando precisar.
                                        </p>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => handleAddManualStep(testCase.id)}
                                        className="inline-flex items-center gap-2 rounded-2xl border border-(--tc-border,#dfe5f1) bg-white px-4 py-3 text-sm font-semibold text-(--tc-text,#0f172a) dark:border-white/10 dark:bg-[#101827] dark:text-white"
                                      >
                                        <FiPlus className="h-4 w-4" />
                                        Adicionar passo
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
                                                Passo {stepIndex + 1}
                                              </p>
                                              <button
                                                type="button"
                                                onClick={() => handleRemoveManualStep(testCase.id, step.id)}
                                                className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:border-rose-400/25 dark:bg-rose-500/10 dark:text-rose-100"
                                              >
                                                Remover passo
                                              </button>
                                            </div>

                                            <div className="mt-4 grid gap-4 xl:grid-cols-2">
                                              <label className="space-y-2">
                                                <span className="text-xs font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">
                                                  Acao
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
                                                  placeholder="O que deve ser executado neste passo."
                                                />
                                              </label>

                                              <label className="space-y-2">
                                                <span className="text-xs font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">
                                                  Resultado esperado
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
                                                  placeholder="Qual resultado deve aparecer apos o passo."
                                                />
                                              </label>
                                            </div>

                                            <label className="mt-4 block space-y-2">
                                              <span className="text-xs font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">
                                                Dados do passo
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
                                                placeholder="Dados, massa ou observacao opcional."
                                              />
                                            </label>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <div className="mt-4 rounded-2xl border border-dashed border-(--tc-border,#dfe5f1) bg-white px-4 py-5 text-sm text-(--tc-text-secondary,#4b5563) dark:border-white/10 dark:bg-[#101827] dark:text-white/72">
                                        Este caso ainda nao tem passos. Se quiser, pode salvar apenas com o titulo e detalhar depois.
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
                  Aplicacao em foco:{" "}
                  <span className="font-semibold text-(--tc-text,#0f172a)">
                    {draftApplication?.name ?? "Sem aplicacao"}
                  </span>
                  {draftApplication?.qaseProjectCode ? ` | Qase ${draftApplication.qaseProjectCode}` : ""}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="rounded-2xl border border-(--tc-border,#dfe5f1) bg-(--tc-surface,#f8fafc) px-4 py-3 text-sm font-semibold text-(--tc-text,#0f172a)"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSave()}
                    disabled={saving || loadingPlanDetail}
                    className="rounded-2xl bg-(--tc-accent,#ef0001) px-5 py-3 text-sm font-semibold text-white shadow-sm disabled:opacity-60"
                  >
                    {saving ? "Salvando..." : draft.id ? "Salvar plano" : "Criar plano"}
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
