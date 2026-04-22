"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  FiActivity,
  FiClipboard,
  FiCode,
  FiEdit2,
  FiFileText,
  FiFilter,
  FiFolder,
  FiGitBranch,
  FiLayers,
  FiEye,
  FiPlus,
  FiPlay,
  FiSearch,
  FiShield,
  FiTrash2,
} from "react-icons/fi";

import type { AutomationAccess } from "@/lib/automations/access";
import { AUTOMATION_CASES, type AutomationCaseDefinition, assetsForFlow } from "@/data/automationCases";
import { AUTOMATION_STUDIO_ASSETS, AUTOMATION_STUDIO_BLUEPRINTS, AUTOMATION_STUDIO_SCRIPT_TEMPLATES } from "@/data/automationStudio";
import { matchesAutomationCompanyScope, normalizeAutomationCompanyScope } from "@/lib/automations/companyScope";

type CompanyOption = {
  name: string;
  slug: string;
};

type Props = {
  access: AutomationAccess;
  activeCompanySlug: string | null;
  companies: CompanyOption[];
};

const STATUS_META = {
  not_started: { label: "Nao iniciado", tone: "border-slate-200 bg-slate-50 text-slate-700" },
  published: { label: "Publicado", tone: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  review: { label: "Revisão", tone: "border-amber-200 bg-amber-50 text-amber-700" },
  draft: { label: "Rascunho", tone: "border-slate-200 bg-slate-50 text-slate-700" },
} as const;

const PRIORITY_META = {
  critical: { label: "Crítico", tone: "border-rose-200 bg-rose-50 text-rose-700" },
  high: { label: "Alta", tone: "border-orange-200 bg-orange-50 text-orange-700" },
  medium: { label: "Média", tone: "border-violet-200 bg-violet-50 text-violet-700" },
} as const;

const SOURCE_META = {
  manual: { label: "Manual", tone: "border-(--tc-border,#d7deea) bg-white text-(--tc-text,#0b1a3c)" },
  qase: { label: "Qase", tone: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700" },
  catalog: { label: "Catálogo", tone: "border-emerald-200 bg-emerald-50 text-emerald-700" },
} as const;

const COVERAGE_META = {
  automation: "Automação",
  hybrid: "Manual + automação",
  manual: "Manual",
} as const;

const CASES_STORAGE_PREFIX = "qc:automacoes:casos:v1";
const CASES_PER_PAGE = 8;
const CASE_MODAL_TABS = ["overview", "edit", "flow", "execution", "actions"] as const;
type CaseModalTab = (typeof CASE_MODAL_TABS)[number];

type CaseSortKey = "priority" | "title" | "application" | "status" | "source";

const PRIORITY_RANK: Record<AutomationCaseDefinition["priority"], number> = {
  critical: 0,
  high: 1,
  medium: 2,
};

function compareCases(left: AutomationCaseDefinition, right: AutomationCaseDefinition, key: CaseSortKey) {
  if (key === "priority") {
    return PRIORITY_RANK[left.priority] - PRIORITY_RANK[right.priority] || left.title.localeCompare(right.title);
  }
  if (key === "title") {
    return left.title.localeCompare(right.title);
  }
  if (key === "application") {
    return left.application.localeCompare(right.application) || left.title.localeCompare(right.title);
  }
  if (key === "status") {
    return STATUS_META[left.status].label.localeCompare(STATUS_META[right.status].label) || left.title.localeCompare(right.title);
  }
  return SOURCE_META[left.source].label.localeCompare(SOURCE_META[right.source].label) || left.title.localeCompare(right.title);
}

export default function AutomationCasesBoard({ access, activeCompanySlug, companies }: Props) {
  const storageKey = `${CASES_STORAGE_PREFIX}:${activeCompanySlug ?? "global"}`;
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<AutomationCaseDefinition["status"] | "all">("all");
  const [sourceFilter, setSourceFilter] = useState<AutomationCaseDefinition["source"] | "all">("all");
  const [applicationFilter, setApplicationFilter] = useState("all");
  const [sortKey, setSortKey] = useState<CaseSortKey>("priority");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [selectedCaseId, setSelectedCaseId] = useState<string>(AUTOMATION_CASES[0]?.id ?? "");
  const [currentPage, setCurrentPage] = useState(1);
  const [isCaseModalOpen, setIsCaseModalOpen] = useState(false);
  const [caseModalTab, setCaseModalTab] = useState<CaseModalTab>("overview");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [manualLinkedCases, setManualLinkedCases] = useState<AutomationCaseDefinition[]>([]);
  const [manualLinkedCasesError, setManualLinkedCasesError] = useState<string | null>(null);
  const [customCases, setCustomCases] = useState<AutomationCaseDefinition[]>([]);
  const [removedCaseIds, setRemovedCaseIds] = useState<Set<string>>(new Set());
  const [newCaseDraft, setNewCaseDraft] = useState({
    title: "",
    application: "",
    domain: "",
    summary: "",
    objective: "",
    expectedResult: "",
    flowId: AUTOMATION_STUDIO_BLUEPRINTS[0]?.id ?? "",
    scriptTemplateId: AUTOMATION_STUDIO_SCRIPT_TEMPLATES[0]?.id ?? "",
    status: "not_started" as AutomationCaseDefinition["status"],
    priority: "medium" as AutomationCaseDefinition["priority"],
    source: "manual" as AutomationCaseDefinition["source"],
    coverage: "hybrid" as AutomationCaseDefinition["coverage"],
    linkedPlanName: "",
    externalCaseRef: "",
    preconditions: "",
    inputBindings: "",
    tags: "",
  });
  const [caseOverrides, setCaseOverrides] = useState<
    Record<string, Partial<Omit<AutomationCaseDefinition, "id">>>
  >({});

  useEffect(() => {
    if (!activeCompanySlug) {
      setManualLinkedCases([]);
      setManualLinkedCasesError(null);
      return;
    }

    let active = true;

    async function loadManualLinkedCases() {
      try {
        setManualLinkedCasesError(null);
        const response = await fetch(
          `/api/automations/manual-links?companySlug=${encodeURIComponent(activeCompanySlug)}`,
          { cache: "no-store" },
        );
        const payload = (await response.json().catch(() => null)) as {
          cases?: AutomationCaseDefinition[];
          error?: string;
        } | null;

        if (!response.ok) {
          throw new Error(payload?.error || "Falha ao carregar casos vinculados.");
        }

        if (!active) return;
        setManualLinkedCases(Array.isArray(payload?.cases) ? payload.cases : []);
      } catch (error) {
        if (!active) return;
        setManualLinkedCases([]);
        setManualLinkedCasesError(
          error instanceof Error ? error.message : "Falha ao carregar casos vinculados.",
        );
      }
    }

    void loadManualLinkedCases();

    return () => {
      active = false;
    };
  }, [activeCompanySlug]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const rawValue = window.localStorage.getItem(storageKey);
      if (!rawValue) return;
      const parsed = JSON.parse(rawValue) as {
        customCases?: AutomationCaseDefinition[];
        removedCaseIds?: string[];
        caseOverrides?: Record<string, Partial<Omit<AutomationCaseDefinition, "id">>>;
      };
      setCustomCases(Array.isArray(parsed.customCases) ? parsed.customCases : []);
      setRemovedCaseIds(new Set(Array.isArray(parsed.removedCaseIds) ? parsed.removedCaseIds : []));
      setCaseOverrides(parsed.caseOverrides && typeof parsed.caseOverrides === "object" ? parsed.caseOverrides : {});
    } catch {
      setCustomCases([]);
      setRemovedCaseIds(new Set());
      setCaseOverrides({});
    }
  }, [storageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const payload = {
      customCases,
      removedCaseIds: Array.from(removedCaseIds),
      caseOverrides,
    };
    window.localStorage.setItem(storageKey, JSON.stringify(payload));
  }, [caseOverrides, customCases, removedCaseIds, storageKey]);

  const casesCatalog = useMemo(
    () =>
      [...manualLinkedCases, ...AUTOMATION_CASES, ...customCases]
        .filter((testCase) => !removedCaseIds.has(testCase.id))
        .map((testCase) => {
        const override = caseOverrides[testCase.id];
        if (!override) return testCase;
        return {
          ...testCase,
          ...override,
          preconditions: override.preconditions ?? testCase.preconditions,
          inputBindings: override.inputBindings ?? testCase.inputBindings,
          tags: override.tags ?? testCase.tags,
        };
      }),
    [caseOverrides, customCases, manualLinkedCases, removedCaseIds],
  );

  const scopedCases = useMemo(
    () => casesCatalog.filter((testCase) => matchesAutomationCompanyScope(testCase.companyScope, activeCompanySlug)),
    [activeCompanySlug, casesCatalog],
  );

  const usingCatalogFallback = scopedCases.length === 0 && Boolean(activeCompanySlug);
  const visibleCases = scopedCases.length > 0 ? scopedCases : casesCatalog;

  const applications = useMemo(
    () =>
      Array.from(
        new Set(
            visibleCases.map((testCase) => testCase.application),
        ),
      ).sort((left, right) => left.localeCompare(right)),
    [visibleCases],
  );

  const filteredCases = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return visibleCases.filter((testCase) => {
      if (statusFilter !== "all" && testCase.status !== statusFilter) return false;
      if (sourceFilter !== "all" && testCase.source !== sourceFilter) return false;
      if (applicationFilter !== "all" && testCase.application !== applicationFilter) return false;
      if (!normalizedQuery) return true;

      const haystack = [
        testCase.title,
        testCase.summary,
        testCase.application,
        testCase.domain,
        testCase.tags.join(" "),
        testCase.externalCaseRef ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [applicationFilter, query, sourceFilter, statusFilter, visibleCases]);

  const sortedCases = useMemo(() => {
    const next = [...filteredCases].sort((left, right) => compareCases(left, right, sortKey));
    if (sortDirection === "desc") next.reverse();
    return next;
  }, [filteredCases, sortDirection, sortKey]);

  const totalPages = Math.max(1, Math.ceil(sortedCases.length / CASES_PER_PAGE));
  const paginatedCases = useMemo(() => {
    const start = (currentPage - 1) * CASES_PER_PAGE;
    return sortedCases.slice(start, start + CASES_PER_PAGE);
  }, [currentPage, sortedCases]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeCompanySlug, query, statusFilter, sourceFilter, applicationFilter, sortKey, sortDirection]);

  useEffect(() => {
    setCurrentPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  const effectiveSelectedCaseId = sortedCases.some((testCase) => testCase.id === selectedCaseId) ? selectedCaseId : (sortedCases[0]?.id ?? "");

  const selectedCase = useMemo(
    () => sortedCases.find((testCase) => testCase.id === effectiveSelectedCaseId) ?? sortedCases[0] ?? null,
    [effectiveSelectedCaseId, sortedCases],
  );

  const selectedFlow = useMemo(
    () => AUTOMATION_STUDIO_BLUEPRINTS.find((flow) => flow.id === selectedCase?.flowId) ?? null,
    [selectedCase],
  );

  const selectedScriptTemplate = useMemo(
    () => AUTOMATION_STUDIO_SCRIPT_TEMPLATES.find((template) => template.id === selectedCase?.scriptTemplateId) ?? null,
    [selectedCase],
  );

  const selectedAssets = useMemo(
    () => AUTOMATION_STUDIO_ASSETS.filter((asset) => selectedCase?.assetIds.includes(asset.id)),
    [selectedCase],
  );

  const selectedCompany = companies.find((company) => company.slug === activeCompanySlug) ?? companies[0] ?? null;
  const linkedPlansHref = activeCompanySlug ? `/empresas/${activeCompanySlug}/planos-de-teste` : null;
  const focusPlanId = searchParams.get("planId")?.trim() || "";
  const focusCaseId = searchParams.get("caseId")?.trim() || "";

  function isManualLinkedCase(testCase: AutomationCaseDefinition | null) {
    return Boolean(testCase?.linkedPlanId && testCase?.manualCaseId);
  }

  useEffect(() => {
    if (!focusPlanId && !focusCaseId) return;
    const targetCase =
      casesCatalog.find((testCase) => {
        if (focusCaseId) {
          return (
            testCase.id === focusCaseId ||
            testCase.manualCaseId === focusCaseId ||
            testCase.externalCaseRef === focusCaseId
          );
        }

        return testCase.linkedPlanId === focusPlanId;
      }) ?? null;

    if (!targetCase) return;

    setSelectedCaseId(targetCase.id);
    setCaseModalTab("overview");
    setIsCaseModalOpen(true);
  }, [casesCatalog, focusCaseId, focusPlanId]);

  async function persistManualCaseAutomation(
    testCase: AutomationCaseDefinition,
    patch: {
      enabled?: boolean;
      flowId?: string | null;
      scriptTemplateId?: string | null;
      status?: AutomationCaseDefinition["status"];
    },
  ) {
    if (!activeCompanySlug || !testCase.linkedPlanId || !testCase.manualCaseId) return;

    const response = await fetch("/api/automations/manual-links", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companySlug: activeCompanySlug,
        planId: testCase.linkedPlanId,
        caseId: testCase.manualCaseId,
        automation: patch,
      }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(payload?.error || "Falha ao sincronizar o caso manual.");
    }

    const workflowUpdatedAt = new Date().toISOString();
    if (patch.enabled === false) {
      setManualLinkedCases((current) => current.filter((item) => item.id !== testCase.id));
      return;
    }

    setManualLinkedCases((current) =>
      current.map((item) =>
        item.id === testCase.id
          ? {
              ...item,
              ...("flowId" in patch ? { flowId: patch.flowId ?? item.flowId } : {}),
              ...("scriptTemplateId" in patch
                ? { scriptTemplateId: patch.scriptTemplateId ?? item.scriptTemplateId }
                : {}),
              ...("status" in patch ? { status: patch.status ?? item.status } : {}),
              workflowUpdatedAt,
            }
          : item,
      ),
    );
  }

  function promoteStatusOnEdit(testCase: AutomationCaseDefinition | null) {
    if (!testCase || !isManualLinkedCase(testCase)) return null;
    return testCase.status === "not_started" ? "draft" : null;
  }

  function updateSelectedCaseDraft<
    K extends "title" | "summary" | "objective" | "expectedResult" | "tags" | "preconditions" | "inputBindings",
  >(
    field: K,
    value: AutomationCaseDefinition[K],
  ) {
    if (!selectedCase) return;
    const nextStatus = promoteStatusOnEdit(selectedCase);
    setCaseOverrides((current) => ({
      ...current,
      [selectedCase.id]: {
        ...current[selectedCase.id],
        [field]: value,
        ...(nextStatus ? { status: nextStatus } : {}),
      },
    }));
    if (nextStatus) {
      void persistManualCaseAutomation(selectedCase, { status: nextStatus }).catch(() => null);
    }
  }

  function updateSelectedCaseDraftAny<K extends keyof Omit<AutomationCaseDefinition, "id">>(
    field: K,
    value: Omit<AutomationCaseDefinition, "id">[K],
  ) {
    if (!selectedCase) return;
    const nextStatus = field === "status" ? null : promoteStatusOnEdit(selectedCase);
    setCaseOverrides((current) => ({
      ...current,
      [selectedCase.id]: {
        ...current[selectedCase.id],
        [field]: value,
        ...(nextStatus ? { status: nextStatus } : {}),
      },
    }));

    if (!isManualLinkedCase(selectedCase)) return;

    const patch: {
      flowId?: string | null;
      scriptTemplateId?: string | null;
      status?: AutomationCaseDefinition["status"];
    } = {};

    if (field === "flowId") {
      patch.flowId = value as AutomationCaseDefinition["flowId"];
    }
    if (field === "scriptTemplateId") {
      patch.scriptTemplateId = value as AutomationCaseDefinition["scriptTemplateId"];
    }
    if (field === "status") {
      patch.status = value as AutomationCaseDefinition["status"];
    } else if (nextStatus) {
      patch.status = nextStatus;
    }

    if (Object.keys(patch).length > 0) {
      void persistManualCaseAutomation(selectedCase, patch).catch(() => null);
    }
  }

  function resetSelectedCaseDraft() {
    if (!selectedCase) return;
    setCaseOverrides((current) => {
      const next = { ...current };
      delete next[selectedCase.id];
      return next;
    });
  }

  function openCaseModal(caseId: string, mode: "view" | "edit", tab: CaseModalTab = mode === "edit" ? "edit" : "overview") {
    setSelectedCaseId(caseId);
    setCaseModalTab(tab);
    setIsCaseModalOpen(true);
  }

  function removeCase(caseId: string) {
    const caseItem = casesCatalog.find((testCase) => testCase.id === caseId);
    if (!caseItem) return;
    const confirmed = window.confirm(`Remover o caso \"${caseItem.title}\"?`);
    if (!confirmed) return;
    if (isManualLinkedCase(caseItem)) {
      void persistManualCaseAutomation(caseItem, { enabled: false, status: "not_started" }).catch(() => null);
      if (selectedCaseId === caseId) {
        setIsCaseModalOpen(false);
      }
      return;
    }
    setRemovedCaseIds((current) => {
      const next = new Set(current);
      next.add(caseId);
      return next;
    });
    setCaseOverrides((current) => {
      if (!current[caseId]) return current;
      const next = { ...current };
      delete next[caseId];
      return next;
    });
    if (selectedCaseId === caseId) {
      const fallback = sortedCases.find((testCase) => testCase.id !== caseId);
      setSelectedCaseId(fallback?.id ?? "");
      setIsCaseModalOpen(false);
    }
  }

  function setSortedColumn(key: CaseSortKey) {
    setSortDirection((currentDirection) => {
      if (sortKey === key) {
        return currentDirection === "asc" ? "desc" : "asc";
      }
      return "asc";
    });
    setSortKey(key);
  }

  function createCaseFromDraft() {
    const title = newCaseDraft.title.trim();
    const application = newCaseDraft.application.trim();
    if (!title || !application) return;

    const normalizedScope = normalizeAutomationCompanyScope(activeCompanySlug);
    const newId = `case-custom-${Date.now()}`;
    const caseItem: AutomationCaseDefinition = {
      id: newId,
      title,
      application,
      domain: newCaseDraft.domain.trim() || "Automação",
      summary: newCaseDraft.summary.trim() || "Caso criado no módulo de automação.",
      objective: newCaseDraft.objective.trim() || "Validar fluxo no contexto operacional da empresa.",
      expectedResult: newCaseDraft.expectedResult.trim() || "Fluxo executa sem falhas críticas.",
      flowId: newCaseDraft.flowId,
      scriptTemplateId: newCaseDraft.scriptTemplateId,
      source: newCaseDraft.source,
      status: newCaseDraft.status,
      priority: newCaseDraft.priority,
      coverage: newCaseDraft.coverage,
      linkedPlanName: newCaseDraft.linkedPlanName.trim() || null,
      externalCaseRef: newCaseDraft.externalCaseRef.trim() || null,
      companyScope: normalizedScope ?? "all",
      preconditions: newCaseDraft.preconditions
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean),
      inputBindings: newCaseDraft.inputBindings
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean),
      tags: newCaseDraft.tags
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      assetIds: assetsForFlow(newCaseDraft.flowId),
    };

    setCustomCases((current) => [caseItem, ...current]);
    setSelectedCaseId(newId);
    setIsCreateModalOpen(false);
    setCaseModalTab("edit");
    setIsCaseModalOpen(true);
    setNewCaseDraft((current) => ({
      ...current,
      title: "",
      application: "",
      domain: "",
      summary: "",
      objective: "",
      expectedResult: "",
      linkedPlanName: "",
      externalCaseRef: "",
      preconditions: "",
      inputBindings: "",
      tags: "",
    }));
  }

  return (
    <section className="space-y-4 rounded-4xl border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-4 py-3">
        <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
          <span className="inline-flex items-center gap-2 rounded-full border border-(--tc-border,#d7deea) bg-white px-3 py-1 text-xs font-semibold text-(--tc-text,#0b1a3c)">
            <FiShield className="h-4 w-4 text-(--tc-accent,#ef0001)" />
            {selectedCompany?.name || activeCompanySlug || "Empresa"}
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-(--tc-border,#d7deea) bg-white px-3 py-1 text-xs font-semibold text-(--tc-text,#0b1a3c)">
            <FiLayers className="h-4 w-4 text-(--tc-accent,#ef0001)" />
            {access.profileLabel}
          </span>
          <span className="text-(--tc-text-muted,#6b7280)">›</span>
          <span className="text-(--tc-text-muted,#6b7280)">Casos</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {linkedPlansHref ? (
            <Link
              href={linkedPlansHref}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-(--tc-border,#d7deea) bg-white px-4 py-2 text-sm font-semibold text-(--tc-text,#0b1a3c) transition hover:border-(--tc-accent,#ef0001) hover:text-(--tc-accent,#ef0001)"
            >
              <FiFileText className="h-4 w-4" />
              Planos
            </Link>
          ) : null}
          <Link
            href="/automacoes/fluxos"
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-(--tc-primary,#011848) px-4 py-2 text-sm font-semibold text-white"
          >
            <FiGitBranch className="h-4 w-4" />
            Fluxos
          </Link>
        </div>
      </div>

      <section className="space-y-4 rounded-[28px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) p-4">
        {manualLinkedCasesError ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            {manualLinkedCasesError}
          </div>
        ) : null}
        {manualLinkedCases.length > 0 ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {manualLinkedCases.length} caso{manualLinkedCases.length === 1 ? "" : "s"} marcado{manualLinkedCases.length === 1 ? "" : "s"} para automacao foi{manualLinkedCases.length === 1 ? "" : "ram"} sincronizado{manualLinkedCases.length === 1 ? "" : "s"} a partir dos planos manuais da empresa.
          </div>
        ) : null}
        {usingCatalogFallback ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            A empresa atual não possui casos dedicados no escopo. Exibindo catálogo geral para você abrir e editar os detalhes.
          </div>
        ) : null}
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto_auto_auto_auto_auto]">
          <label className="grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
            Buscar caso
            <span className="relative">
              <FiSearch className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-(--tc-text-muted,#6b7280)" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Título, tag, domínio ou referência"
                className="min-h-11 w-full rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) pr-4 pl-11 text-sm outline-none transition focus:border-(--tc-accent,#ef0001)"
              />
            </span>
          </label>

          <label className="grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
            Status
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
              className="min-h-11 rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-4 text-sm outline-none transition focus:border-(--tc-accent,#ef0001)"
            >
              <option value="all">Todos</option>
              <option value="not_started">Nao iniciado</option>
              <option value="draft">Rascunho</option>
              <option value="published">Publicado</option>
              <option value="review">Revisão</option>
            </select>
          </label>

          <label className="grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
            Origem
            <select
              value={sourceFilter}
              onChange={(event) => setSourceFilter(event.target.value as typeof sourceFilter)}
              className="min-h-11 rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-4 text-sm outline-none transition focus:border-(--tc-accent,#ef0001)"
            >
              <option value="all">Todas</option>
              <option value="manual">Manual</option>
              <option value="qase">Qase</option>
              <option value="catalog">Catálogo</option>
            </select>
          </label>

          <label className="grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
            Aplicação
            <select
              value={applicationFilter}
              onChange={(event) => setApplicationFilter(event.target.value)}
              className="min-h-11 rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-4 text-sm outline-none transition focus:border-(--tc-accent,#ef0001)"
            >
              <option value="all">Todas</option>
              {applications.map((application) => (
                <option key={application} value={application}>
                  {application}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
            Ordenar por
            <select
              value={sortKey}
              onChange={(event) => setSortedColumn(event.target.value as CaseSortKey)}
              className="min-h-11 rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-4 text-sm outline-none transition focus:border-(--tc-accent,#ef0001)"
            >
              <option value="priority">Prioridade</option>
              <option value="title">Título</option>
              <option value="application">Aplicação</option>
              <option value="status">Status</option>
              <option value="source">Origem</option>
            </select>
          </label>

          <div className="grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
            Direção
            <button
              type="button"
              onClick={() => setSortDirection((current) => (current === "asc" ? "desc" : "asc"))}
              className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-4 text-sm"
            >
              {sortDirection === "asc" ? "Ascendente" : "Descendente"}
            </button>
          </div>

          <div className="grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
            Ações
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-(--tc-accent,#ef0001) bg-[#fff5f5] px-4 text-sm text-(--tc-accent,#ef0001)"
            >
              <FiPlus className="h-4 w-4" />
              Novo caso
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-4 py-3">
          <p className="text-sm text-(--tc-text-secondary,#4b5563)">
            {sortedCases.length > 0
              ? `Mostrando ${(currentPage - 1) * CASES_PER_PAGE + 1}-${Math.min(currentPage * CASES_PER_PAGE, sortedCases.length)} de ${sortedCases.length}`
              : "Nenhum caso para exibir"}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage((current) => Math.max(1, current - 1))}
              disabled={currentPage === 1}
              className="inline-flex min-h-10 items-center gap-2 rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4 py-2 text-sm font-semibold text-(--tc-text,#0b1a3c) disabled:cursor-not-allowed disabled:opacity-50"
            >
              Anterior
            </button>
            <div className="flex flex-wrap gap-1">
              {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                <button
                  key={page}
                  type="button"
                  onClick={() => setCurrentPage(page)}
                  className={`inline-flex min-h-10 min-w-10 items-center justify-center rounded-2xl border px-3 text-sm font-semibold ${
                    page === currentPage
                      ? "border-(--tc-accent,#ef0001) bg-[#fff5f5] text-(--tc-accent,#ef0001)"
                      : "border-(--tc-border,#d7deea) bg-white text-(--tc-text,#0b1a3c)"
                  }`}
                >
                  {page}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setCurrentPage((current) => Math.min(totalPages, current + 1))}
              disabled={currentPage >= totalPages}
              className="inline-flex min-h-10 items-center gap-2 rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4 py-2 text-sm font-semibold text-(--tc-text,#0b1a3c) disabled:cursor-not-allowed disabled:opacity-50"
            >
              Próxima
            </button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-3xl border border-(--tc-border,#d7deea)">
          <table className="min-w-full border-separate border-spacing-0">
            <thead className="sticky top-0 z-10 bg-(--tc-surface-2,#f8fafc)">
              <tr className="text-left text-[10px] font-semibold uppercase tracking-[0.2em] text-(--tc-text-muted,#6b7280)">
                {[
                  { key: "title" as const, label: "Caso" },
                  { key: "application" as const, label: "Aplicação" },
                  { key: "priority" as const, label: "Prioridade" },
                  { key: "status" as const, label: "Status" },
                  { key: "source" as const, label: "Origem" },
                  { key: null, label: "Cobertura" },
                  { key: null, label: "Ações" },
                ].map((column) => (
                  <th key={column.label} className="border-b border-(--tc-border,#d7deea) px-4 py-3">
                    {column.key ? (
                      <button
                        type="button"
                        onClick={() => setSortedColumn(column.key)}
                        className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-left transition ${
                          sortKey === column.key
                            ? "bg-[#fff5f5] text-(--tc-accent,#ef0001)"
                            : "text-(--tc-text-muted,#6b7280) hover:text-(--tc-text,#0b1a3c)"
                        }`}
                      >
                        {column.label}
                        {sortKey === column.key ? (
                          <span className="text-xs font-black text-(--tc-accent,#ef0001)">{sortDirection === "asc" ? "↑" : "↓"}</span>
                        ) : (
                          <span className="text-xs opacity-40">↕</span>
                        )}
                      </button>
                    ) : (
                      column.label
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedCases.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-sm text-(--tc-text-muted,#6b7280)">
                    Nenhum caso encontrado para os filtros atuais.
                  </td>
                </tr>
              ) : (
                paginatedCases.map((testCase) => {
                  const statusMeta = STATUS_META[testCase.status];
                  const priorityMeta = PRIORITY_META[testCase.priority];
                  const sourceMeta = SOURCE_META[testCase.source];

                    return (
                    <tr
                      key={testCase.id}
                      className={`border-b border-(--tc-border,#d7deea) transition hover:bg-[#fff5f5] ${
                        effectiveSelectedCaseId === testCase.id ? "bg-[#fff5f5]" : "bg-white"
                      }`}
                    >
                      <td className="px-4 py-4 align-top">
                        <button
                          type="button"
                          onClick={() => openCaseModal(testCase.id, "view")}
                          className="block w-full text-left"
                        >
                          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">{testCase.domain}</p>
                          <p className="mt-1 font-semibold text-(--tc-text,#0b1a3c)">{testCase.title}</p>
                          <p className="mt-1 line-clamp-2 text-xs text-(--tc-text-secondary,#4b5563)">{testCase.summary}</p>
                        </button>
                      </td>
                      <td className="px-4 py-4 align-top text-sm text-(--tc-text,#0b1a3c)">{testCase.application}</td>
                      <td className="px-4 py-4 align-top">
                        <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] ${priorityMeta.tone}`}>
                          {priorityMeta.label}
                        </span>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] ${statusMeta.tone}`}>
                          {statusMeta.label}
                        </span>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] ${sourceMeta.tone}`}>
                          {sourceMeta.label}
                        </span>
                      </td>
                      <td className="px-4 py-4 align-top text-sm text-(--tc-text,#0b1a3c)">{COVERAGE_META[testCase.coverage]}</td>
                      <td className="px-4 py-4 align-top">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            aria-label="Ver caso"
                            title="Ver caso"
                            onClick={(event) => {
                              event.stopPropagation();
                              openCaseModal(testCase.id, "view", "overview");
                            }}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-(--tc-border,#d7deea) bg-white text-(--tc-text,#0b1a3c)"
                          >
                            <FiEye className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            aria-label="Editar caso"
                            title="Editar caso"
                            onClick={(event) => {
                              event.stopPropagation();
                              openCaseModal(testCase.id, "edit", "edit");
                            }}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-(--tc-accent,#ef0001) bg-[#fff5f5] text-(--tc-accent,#ef0001)"
                          >
                            <FiEdit2 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            aria-label="Remover caso"
                            title="Remover caso"
                            onClick={(event) => {
                              event.stopPropagation();
                              removeCase(testCase.id);
                            }}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-700"
                          >
                            <FiTrash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {isCaseModalOpen && selectedCase ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-[#06112acc] p-3 sm:p-6">
          <div className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-[28px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) p-4 shadow-[0_24px_70px_rgba(2,6,23,0.45)] sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-(--tc-accent,#ef0001)">Caso</p>
                <h3 className="mt-2 text-xl font-black tracking-[-0.03em] text-(--tc-text,#0b1a3c)">{selectedCase.title}</h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${STATUS_META[selectedCase.status].tone}`}>
                    {STATUS_META[selectedCase.status].label}
                  </span>
                  <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${PRIORITY_META[selectedCase.priority].tone}`}>
                    {PRIORITY_META[selectedCase.priority].label}
                  </span>
                  <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${SOURCE_META[selectedCase.source].tone}`}>
                    {SOURCE_META[selectedCase.source].label}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsCaseModalOpen(false);
                  setCaseModalTab("overview");
                }}
                className="inline-flex min-h-10 items-center justify-center rounded-xl border border-(--tc-border,#d7deea) bg-white px-4 py-2 text-sm font-semibold text-(--tc-text,#0b1a3c)"
              >
                Fechar
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) p-2">
              {[
                { id: "overview" as const, label: "Resumo", icon: FiClipboard },
                { id: "edit" as const, label: "Editar", icon: FiEdit2 },
                { id: "flow" as const, label: "Fluxo", icon: FiGitBranch },
                { id: "execution" as const, label: "Executar", icon: FiPlay },
                { id: "actions" as const, label: "Ações", icon: FiFilter },
              ].map((tab) => {
                const Icon = tab.icon;
                const active = caseModalTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setCaseModalTab(tab.id)}
                    className={`inline-flex min-h-10 items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                      active
                        ? "border-(--tc-accent,#ef0001) bg-white text-(--tc-accent,#ef0001)"
                        : "border-transparent bg-transparent text-(--tc-text,#0b1a3c) hover:border-(--tc-border,#d7deea) hover:bg-white"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {caseModalTab === "overview" ? (
              <div className="mt-5 grid gap-4 2xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                <div className="space-y-4">
                  <section className="rounded-3xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">Resumo</p>
                    <p className="mt-2 text-sm leading-7 text-(--tc-text,#0b1a3c)">{selectedCase.summary}</p>
                    <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">Objetivo</p>
                    <p className="mt-2 text-sm leading-7 text-(--tc-text,#0b1a3c)">{selectedCase.objective}</p>
                    <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">Resultado esperado</p>
                    <p className="mt-2 text-sm leading-7 text-(--tc-text,#0b1a3c)">{selectedCase.expectedResult}</p>
                  </section>

                  <section className="rounded-3xl border border-(--tc-border,#d7deea) bg-white p-4">
                    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">
                      <FiLayers className="h-4 w-4" />
                      Pré-condições e entradas
                    </div>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-(--tc-text-muted,#6b7280)">Pré-condições</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {selectedCase.preconditions.map((item) => (
                            <span key={item} className="inline-flex rounded-full border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-3 py-1 text-xs font-semibold text-(--tc-text,#0b1a3c)">
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-(--tc-text-muted,#6b7280)">Entradas</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {selectedCase.inputBindings.map((item) => (
                            <span key={item} className="inline-flex rounded-full border border-(--tc-border,#d7deea) bg-white px-3 py-1 text-xs font-semibold text-(--tc-text,#0b1a3c)">
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </section>
                </div>

                <aside className="space-y-4">
                  <section className="rounded-3xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) p-4">
                    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">
                      <FiFileText className="h-4 w-4" />
                      Vínculo QA
                    </div>
                    <div className="mt-3 space-y-2 text-sm text-(--tc-text,#0b1a3c)">
                      <p>Plano: {selectedCase.linkedPlanName ?? "Não vinculado"}</p>
                      <p>Referência: {selectedCase.externalCaseRef ?? "Interno"}</p>
                      <p>Cobertura: {COVERAGE_META[selectedCase.coverage]}</p>
                    </div>
                  </section>

                  <section className="rounded-3xl border border-(--tc-border,#d7deea) bg-white p-4">
                    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">
                      <FiFolder className="h-4 w-4" />
                      Assets
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedAssets.map((asset) => (
                        <span key={asset.id} className="inline-flex rounded-full border border-fuchsia-200 bg-fuchsia-50 px-3 py-1 text-xs font-semibold text-fuchsia-700">
                          {asset.title}
                        </span>
                      ))}
                    </div>
                  </section>
                </aside>
              </div>
            ) : null}

            {caseModalTab === "edit" ? (
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <label className="grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
                  Título
                  <input
                    value={selectedCase.title}
                    onChange={(event) => updateSelectedCaseDraft("title", event.target.value)}
                    className="min-h-11 rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4 text-sm outline-none"
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
                  Aplicação
                  <input
                    value={selectedCase.application}
                    onChange={(event) => updateSelectedCaseDraftAny("application", event.target.value)}
                    className="min-h-11 rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4 text-sm outline-none"
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
                  Domínio
                  <input
                    value={selectedCase.domain}
                    onChange={(event) => updateSelectedCaseDraftAny("domain", event.target.value)}
                    className="min-h-11 rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4 text-sm outline-none"
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
                  Tags
                  <input
                    value={selectedCase.tags.join(", ")}
                    onChange={(event) =>
                      updateSelectedCaseDraft(
                        "tags",
                        event.target.value
                          .split(",")
                          .map((item) => item.trim())
                          .filter(Boolean),
                      )
                    }
                    className="min-h-11 rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4 text-sm outline-none"
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
                  Fluxo
                  <select
                    value={selectedCase.flowId}
                    onChange={(event) => updateSelectedCaseDraftAny("flowId", event.target.value)}
                    className="min-h-11 rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4 text-sm outline-none"
                  >
                    {AUTOMATION_STUDIO_BLUEPRINTS.map((flow) => (
                      <option key={flow.id} value={flow.id}>
                        {flow.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
                  Script
                  <select
                    value={selectedCase.scriptTemplateId}
                    onChange={(event) => updateSelectedCaseDraftAny("scriptTemplateId", event.target.value)}
                    className="min-h-11 rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4 text-sm outline-none"
                  >
                    {AUTOMATION_STUDIO_SCRIPT_TEMPLATES.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
                  Status
                  <select
                    value={selectedCase.status}
                    onChange={(event) => updateSelectedCaseDraftAny("status", event.target.value as AutomationCaseDefinition["status"])}
                    className="min-h-11 rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4 text-sm outline-none"
                  >
                    <option value="not_started">Nao iniciado</option>
                    <option value="draft">Rascunho</option>
                    <option value="published">Publicado</option>
                    <option value="review">Revisão</option>
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
                  Prioridade
                  <select
                    value={selectedCase.priority}
                    onChange={(event) => updateSelectedCaseDraftAny("priority", event.target.value as AutomationCaseDefinition["priority"])}
                    className="min-h-11 rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4 text-sm outline-none"
                  >
                    <option value="critical">Crítico</option>
                    <option value="high">Alta</option>
                    <option value="medium">Média</option>
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
                  Origem
                  <select
                    value={selectedCase.source}
                    onChange={(event) => updateSelectedCaseDraftAny("source", event.target.value as AutomationCaseDefinition["source"])}
                    className="min-h-11 rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4 text-sm outline-none"
                  >
                    <option value="manual">Manual</option>
                    <option value="qase">Qase</option>
                    <option value="catalog">Catálogo</option>
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
                  Cobertura
                  <select
                    value={selectedCase.coverage}
                    onChange={(event) => updateSelectedCaseDraftAny("coverage", event.target.value as AutomationCaseDefinition["coverage"])}
                    className="min-h-11 rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4 text-sm outline-none"
                  >
                    <option value="manual">Manual</option>
                    <option value="automation">Automação</option>
                    <option value="hybrid">Manual + automação</option>
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c) md:col-span-2">
                  Resumo
                  <textarea
                    value={selectedCase.summary}
                    onChange={(event) => updateSelectedCaseDraft("summary", event.target.value)}
                    rows={3}
                    className="rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4 py-3 text-sm leading-7 outline-none"
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c) md:col-span-2">
                  Objetivo
                  <textarea
                    value={selectedCase.objective}
                    onChange={(event) => updateSelectedCaseDraft("objective", event.target.value)}
                    rows={3}
                    className="rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4 py-3 text-sm leading-7 outline-none"
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c) md:col-span-2">
                  Resultado esperado
                  <textarea
                    value={selectedCase.expectedResult}
                    onChange={(event) => updateSelectedCaseDraft("expectedResult", event.target.value)}
                    rows={3}
                    className="rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4 py-3 text-sm leading-7 outline-none"
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
                  Plano vinculado
                  <input
                    value={selectedCase.linkedPlanName ?? ""}
                    onChange={(event) => updateSelectedCaseDraftAny("linkedPlanName", event.target.value || null)}
                    className="min-h-11 rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4 text-sm outline-none"
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
                  Referência externa
                  <input
                    value={selectedCase.externalCaseRef ?? ""}
                    onChange={(event) => updateSelectedCaseDraftAny("externalCaseRef", event.target.value || null)}
                    className="min-h-11 rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4 text-sm outline-none"
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c) md:col-span-2">
                  Pré-condições
                  <textarea
                    value={selectedCase.preconditions.join("\n")}
                    onChange={(event) =>
                      updateSelectedCaseDraft(
                        "preconditions",
                        event.target.value
                          .split("\n")
                          .map((item) => item.trim())
                          .filter(Boolean),
                      )
                    }
                    rows={3}
                    className="rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4 py-3 text-sm leading-7 outline-none"
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c) md:col-span-2">
                  Entradas
                  <textarea
                    value={selectedCase.inputBindings.join("\n")}
                    onChange={(event) =>
                      updateSelectedCaseDraft(
                        "inputBindings",
                        event.target.value
                          .split("\n")
                          .map((item) => item.trim())
                          .filter(Boolean),
                      )
                    }
                    rows={3}
                    className="rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4 py-3 text-sm leading-7 outline-none"
                  />
                </label>
              </div>
            ) : null}

            {caseModalTab === "flow" ? (
              <div className="mt-5 grid gap-4 2xl:grid-cols-[minmax(0,1fr)_320px]">
                <section className="rounded-3xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) p-4">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">
                    <FiGitBranch className="h-4 w-4" />
                    Fluxo vinculado
                  </div>
                  <p className="mt-2 text-lg font-black tracking-[-0.03em] text-(--tc-text,#0b1a3c)">{selectedFlow?.title ?? "Sem fluxo"}</p>
                  <p className="mt-1 text-sm text-(--tc-text-secondary,#4b5563)">{selectedFlow?.description ?? "Sem fluxo associado."}</p>
                  {selectedFlow ? (
                    <div className="mt-4 space-y-2">
                      {selectedFlow.steps.map((step, index) => (
                        <div key={`${selectedFlow.id}-${index}`} className="rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4 py-3 text-sm text-(--tc-text,#0b1a3c)">
                          <span className="font-semibold text-(--tc-accent,#ef0001)">#{index + 1}</span> {step.title}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </section>

                <aside className="space-y-3">
                  <section className="rounded-3xl border border-(--tc-border,#d7deea) bg-white p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">Script</p>
                    <p className="mt-2 text-sm text-(--tc-text,#0b1a3c)">{selectedScriptTemplate?.title ?? "Sem template"}</p>
                    <p className="mt-1 text-sm text-(--tc-text-secondary,#4b5563)">{selectedScriptTemplate?.summary ?? "Sem estratégia de script."}</p>
                  </section>
                  <section className="rounded-3xl border border-(--tc-border,#d7deea) bg-white p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">Referências</p>
                    <div className="mt-2 space-y-1 text-sm text-(--tc-text,#0b1a3c)">
                      <p>Plano: {selectedCase.linkedPlanName ?? "Não vinculado"}</p>
                      <p>Referência: {selectedCase.externalCaseRef ?? "Interno"}</p>
                      <p>Cobertura: {COVERAGE_META[selectedCase.coverage]}</p>
                    </div>
                  </section>
                </aside>
              </div>
            ) : null}

            {caseModalTab === "execution" ? (
              <div className="mt-5 space-y-4">
                <section className="rounded-3xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) p-4">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">
                    <FiActivity className="h-4 w-4" />
                    Execução
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link
                      href={`/automacoes/execucoes?flow=${encodeURIComponent(selectedCase.flowId)}`}
                      className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-(--tc-primary,#011848) px-4 py-2 text-sm font-semibold text-white"
                    >
                      <FiPlay className="h-4 w-4" />
                      Executar
                    </Link>
                    <Link
                      href={`/automacoes/fluxos?flow=${encodeURIComponent(selectedCase.flowId)}`}
                      className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4 py-2 text-sm font-semibold text-(--tc-text,#0b1a3c)"
                    >
                      <FiGitBranch className="h-4 w-4" />
                      Abrir fluxo
                    </Link>
                    <Link
                      href={`/automacoes/scripts?flow=${encodeURIComponent(selectedCase.flowId)}`}
                      className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4 py-2 text-sm font-semibold text-(--tc-text,#0b1a3c)"
                    >
                      <FiCode className="h-4 w-4" />
                      Abrir script
                    </Link>
                  </div>
                </section>

                <section className="rounded-3xl border border-(--tc-border,#d7deea) bg-white p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">Assets associados</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedAssets.length > 0 ? (
                      selectedAssets.map((asset) => (
                        <span key={asset.id} className="inline-flex rounded-full border border-fuchsia-200 bg-fuchsia-50 px-3 py-1 text-xs font-semibold text-fuchsia-700">
                          {asset.title}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-(--tc-text-muted,#6b7280)">Sem assets vinculados.</span>
                    )}
                  </div>
                </section>
              </div>
            ) : null}

            {caseModalTab === "actions" ? (
              <div className="mt-5 space-y-4">
                <section className="rounded-3xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) p-4">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => openCaseModal(selectedCase.id, "edit", "edit")}
                      className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-(--tc-accent,#ef0001) bg-[#fff5f5] px-4 py-2 text-sm font-semibold text-(--tc-accent,#ef0001)"
                    >
                      <FiEdit2 className="h-4 w-4" />
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => removeCase(selectedCase.id)}
                      className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700"
                    >
                      <FiTrash2 className="h-4 w-4" />
                      Remover
                    </button>
                    {isManualLinkedCase(selectedCase) ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            updateSelectedCaseDraftAny("status", "draft");
                          }}
                          className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700"
                        >
                          <FiEdit2 className="h-4 w-4" />
                          Marcar rascunho
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            updateSelectedCaseDraftAny("status", "published");
                          }}
                          className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700"
                        >
                          <FiClipboard className="h-4 w-4" />
                          Publicar caso
                        </button>
                      </>
                    ) : null}
                    <Link
                      href={`/automacoes/execucoes?flow=${encodeURIComponent(selectedCase.flowId)}`}
                      className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-(--tc-primary,#011848) px-4 py-2 text-sm font-semibold text-white"
                    >
                      <FiPlay className="h-4 w-4" />
                      Executar
                    </Link>
                  </div>
                </section>

                <section className="rounded-3xl border border-(--tc-border,#d7deea) bg-white p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">Detalhes completos</p>
                  <div className="mt-3 grid gap-2 text-sm text-(--tc-text,#0b1a3c)">
                    <p>Aplicação: {selectedCase.application}</p>
                    <p>Domínio: {selectedCase.domain}</p>
                    <p>Status: {STATUS_META[selectedCase.status].label}</p>
                    <p>Prioridade: {PRIORITY_META[selectedCase.priority].label}</p>
                    <p>Origem: {SOURCE_META[selectedCase.source].label}</p>
                    <p>Plano: {selectedCase.linkedPlanName ?? "Não vinculado"}</p>
                    <p>Referência: {selectedCase.externalCaseRef ?? "Interno"}</p>
                  </div>
                </section>
              </div>
            ) : null}

          </div>
        </div>
      ) : null}

      {isCreateModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-[#06112acc] p-3 sm:p-6">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[28px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) p-4 shadow-[0_24px_70px_rgba(2,6,23,0.45)] sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-(--tc-accent,#ef0001)">Novo caso</p>
                <h3 className="mt-2 text-xl font-black tracking-[-0.03em] text-(--tc-text,#0b1a3c)">Criar caso de automação</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="inline-flex min-h-10 items-center justify-center rounded-xl border border-(--tc-border,#d7deea) bg-white px-4 py-2 text-sm font-semibold text-(--tc-text,#0b1a3c)"
              >
                Fechar
              </button>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
                Título
                <input
                  value={newCaseDraft.title}
                  onChange={(event) => setNewCaseDraft((current) => ({ ...current, title: event.target.value }))}
                  className="min-h-11 rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-4 text-sm outline-none"
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
                Aplicação
                <input
                  value={newCaseDraft.application}
                  onChange={(event) => setNewCaseDraft((current) => ({ ...current, application: event.target.value }))}
                  className="min-h-11 rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-4 text-sm outline-none"
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
                Fluxo
                <select
                  value={newCaseDraft.flowId}
                  onChange={(event) => setNewCaseDraft((current) => ({ ...current, flowId: event.target.value }))}
                  className="min-h-11 rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-4 text-sm outline-none"
                >
                  {AUTOMATION_STUDIO_BLUEPRINTS.map((flow) => (
                    <option key={flow.id} value={flow.id}>
                      {flow.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
                Script
                <select
                  value={newCaseDraft.scriptTemplateId}
                  onChange={(event) => setNewCaseDraft((current) => ({ ...current, scriptTemplateId: event.target.value }))}
                  className="min-h-11 rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-4 text-sm outline-none"
                >
                  {AUTOMATION_STUDIO_SCRIPT_TEMPLATES.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.title}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="mt-3 grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
              Resumo
              <textarea
                rows={3}
                value={newCaseDraft.summary}
                onChange={(event) => setNewCaseDraft((current) => ({ ...current, summary: event.target.value }))}
                className="rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-4 py-3 text-sm leading-7 outline-none"
              />
            </label>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={createCaseFromDraft}
                disabled={!newCaseDraft.title.trim() || !newCaseDraft.application.trim()}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-(--tc-primary,#011848) px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FiPlus className="h-4 w-4" />
                Criar caso
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
