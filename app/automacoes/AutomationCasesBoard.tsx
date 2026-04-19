"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  FiActivity,
  FiArrowRight,
  FiCheckCircle,
  FiClipboard,
  FiCode,
  FiFileText,
  FiFilter,
  FiFolder,
  FiGitBranch,
  FiLayers,
  FiPlay,
  FiSearch,
  FiShield,
} from "react-icons/fi";

import type { AutomationAccess } from "@/lib/automations/access";
import { AUTOMATION_CASES, type AutomationCaseDefinition } from "@/data/automationCases";
import { AUTOMATION_STUDIO_ASSETS, AUTOMATION_STUDIO_BLUEPRINTS, AUTOMATION_STUDIO_SCRIPT_TEMPLATES } from "@/data/automationStudio";
import { matchesAutomationCompanyScope } from "@/lib/automations/companyScope";

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
  automated: { label: "Automatizado", tone: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  ready: { label: "Pronto", tone: "border-sky-200 bg-sky-50 text-sky-700" },
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

export default function AutomationCasesBoard({ access, activeCompanySlug, companies }: Props) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<AutomationCaseDefinition["status"] | "all">("all");
  const [sourceFilter, setSourceFilter] = useState<AutomationCaseDefinition["source"] | "all">("all");
  const [applicationFilter, setApplicationFilter] = useState("all");
  const [selectedCaseId, setSelectedCaseId] = useState<string>(AUTOMATION_CASES[0]?.id ?? "");
  const [isCaseModalOpen, setIsCaseModalOpen] = useState(false);
  const [caseModalMode, setCaseModalMode] = useState<"view" | "edit">("view");
  const [caseOverrides, setCaseOverrides] = useState<
    Record<
      string,
      Partial<Pick<AutomationCaseDefinition, "title" | "summary" | "objective" | "expectedResult" | "tags">>
    >
  >({});

  const casesCatalog = useMemo(
    () =>
      AUTOMATION_CASES.map((testCase) => {
        const override = caseOverrides[testCase.id];
        if (!override) return testCase;
        return {
          ...testCase,
          ...override,
          tags: override.tags ?? testCase.tags,
        };
      }),
    [caseOverrides],
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

  const effectiveSelectedCaseId = filteredCases.some((testCase) => testCase.id === selectedCaseId) ? selectedCaseId : (filteredCases[0]?.id ?? "");

  const selectedCase = useMemo(
    () => filteredCases.find((testCase) => testCase.id === effectiveSelectedCaseId) ?? filteredCases[0] ?? null,
    [effectiveSelectedCaseId, filteredCases],
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

  const metrics = useMemo(
    () => [
      { label: "Casos", value: `${AUTOMATION_CASES.length}`, hint: "catálogo inicial", icon: FiClipboard },
      {
        label: "Automatizados",
        value: `${casesCatalog.filter((testCase) => testCase.status === "automated").length}`,
        hint: "rodando por fluxo",
        icon: FiCheckCircle,
      },
      {
        label: "Críticos",
        value: `${casesCatalog.filter((testCase) => testCase.priority === "critical").length}`,
        hint: "prioridade alta",
        icon: FiShield,
      },
      {
        label: "Com plano",
        value: `${casesCatalog.filter((testCase) => Boolean(testCase.linkedPlanName || testCase.externalCaseRef)).length}`,
        hint: "manual ou Qase",
        icon: FiFileText,
      },
    ],
    [casesCatalog],
  );

  function updateSelectedCaseDraft<K extends "title" | "summary" | "objective" | "expectedResult" | "tags">(
    field: K,
    value: AutomationCaseDefinition[K],
  ) {
    if (!selectedCase) return;
    setCaseOverrides((current) => ({
      ...current,
      [selectedCase.id]: {
        ...current[selectedCase.id],
        [field]: value,
      },
    }));
  }

  function resetSelectedCaseDraft() {
    if (!selectedCase) return;
    setCaseOverrides((current) => {
      const next = { ...current };
      delete next[selectedCase.id];
      return next;
    });
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

      <article className="rounded-[28px] border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) p-4">
        {usingCatalogFallback ? (
          <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            A empresa atual não possui casos dedicados no escopo. Exibindo catálogo geral para você abrir e editar os detalhes.
          </div>
        ) : null}
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
          <label className="grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
            Buscar caso
            <span className="relative">
              <FiSearch className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-(--tc-text-muted,#6b7280)" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Título, tag, domínio ou referência"
                className="min-h-11 w-full rounded-2xl border border-(--tc-border,#d7deea) bg-white pr-4 pl-11 text-sm outline-none transition focus:border-(--tc-accent,#ef0001)"
              />
            </span>
          </label>

          <label className="grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
            Status
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
              className="min-h-11 rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4 text-sm outline-none transition focus:border-(--tc-accent,#ef0001)"
            >
              <option value="all">Todos</option>
              <option value="draft">Rascunho</option>
              <option value="ready">Pronto</option>
              <option value="automated">Automatizado</option>
              <option value="review">Revisão</option>
            </select>
          </label>

          <label className="grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
            Origem
            <select
              value={sourceFilter}
              onChange={(event) => setSourceFilter(event.target.value as typeof sourceFilter)}
              className="min-h-11 rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4 text-sm outline-none transition focus:border-(--tc-accent,#ef0001)"
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
              className="min-h-11 rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4 text-sm outline-none transition focus:border-(--tc-accent,#ef0001)"
            >
              <option value="all">Todas</option>
              {applications.map((application) => (
                <option key={application} value={application}>
                  {application}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4 grid auto-rows-fr gap-3 grid-cols-[repeat(auto-fit,minmax(180px,1fr))]">
          {metrics.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">{item.label}</p>
                  <Icon className="h-4 w-4 text-(--tc-accent,#ef0001)" />
                </div>
                <p className="mt-2 text-lg font-black tracking-[-0.03em] text-(--tc-text,#0b1a3c)">{item.value}</p>
                <p className="mt-1 text-xs text-(--tc-text-secondary,#4b5563)">{item.hint}</p>
              </div>
            );
          })}
        </div>
      </article>

      <div className="grid items-start gap-4 xl:grid-cols-12">
        <aside className="rounded-[28px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) p-4 xl:col-span-4 xl:sticky xl:top-6 2xl:col-span-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-(--tc-text-muted,#6b7280)">Casos</p>
              <p className="mt-2 text-sm text-(--tc-text-secondary,#4b5563)">{filteredCases.length} resultado(s)</p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-(--tc-text-muted,#6b7280)">
              <FiFilter className="h-3.5 w-3.5" />
              QA
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {filteredCases.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-(--tc-border,#d7deea) px-4 py-6 text-sm text-(--tc-text-muted,#6b7280)">
                Nenhum caso encontrado para os filtros atuais.
              </div>
            ) : (
              filteredCases.map((testCase) => {
                const active = effectiveSelectedCaseId === testCase.id;
                const statusMeta = STATUS_META[testCase.status];
                const priorityMeta = PRIORITY_META[testCase.priority];
                const sourceMeta = SOURCE_META[testCase.source];

                return (
                  <article
                    key={testCase.id}
                    className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                      active
                        ? "border-(--tc-accent,#ef0001) bg-[#fff5f5] shadow-[0_10px_24px_rgba(239,0,1,0.08)]"
                        : "border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) hover:border-(--tc-accent,#ef0001)"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCaseId(testCase.id);
                        setCaseModalMode("view");
                        setIsCaseModalOpen(true);
                      }}
                      className="block w-full text-left"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">{testCase.application}</p>
                          <h3 className="mt-1 wrap-break-word text-base font-black tracking-[-0.03em] text-(--tc-text,#0b1a3c)">{testCase.title}</h3>
                        </div>
                        <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] ${priorityMeta.tone}`}>
                          {priorityMeta.label}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-(--tc-text-secondary,#4b5563)">{testCase.summary}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] ${statusMeta.tone}`}>
                          {statusMeta.label}
                        </span>
                        <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] ${sourceMeta.tone}`}>
                          {sourceMeta.label}
                        </span>
                        <span className="inline-flex rounded-full border border-(--tc-border,#d7deea) bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-(--tc-text,#0b1a3c)">
                          {COVERAGE_META[testCase.coverage]}
                        </span>
                      </div>
                    </button>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCaseId(testCase.id);
                          setCaseModalMode("view");
                          setIsCaseModalOpen(true);
                        }}
                        className="inline-flex min-h-9 items-center justify-center rounded-xl border border-(--tc-border,#d7deea) bg-white px-3 py-1 text-xs font-semibold text-(--tc-text,#0b1a3c)"
                      >
                        Ver detalhes
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCaseId(testCase.id);
                          setCaseModalMode("edit");
                          setIsCaseModalOpen(true);
                        }}
                        className="inline-flex min-h-9 items-center justify-center rounded-xl border border-(--tc-accent,#ef0001) bg-[#fff5f5] px-3 py-1 text-xs font-semibold text-(--tc-accent,#ef0001)"
                      >
                        Editar
                      </button>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </aside>

        <article className="rounded-[28px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) p-5 xl:col-span-8 2xl:col-span-9">
          {selectedCase ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-(--tc-accent,#ef0001)">Caso selecionado</p>
                  <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-(--tc-text,#0b1a3c)">{selectedCase.title}</h2>
                  <p className="mt-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">{selectedCase.objective}</p>
                  <p className="mt-1 text-sm text-(--tc-text-secondary,#4b5563)">{selectedCase.summary}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${STATUS_META[selectedCase.status].tone}`}>
                    {STATUS_META[selectedCase.status].label}
                  </span>
                  <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${PRIORITY_META[selectedCase.priority].tone}`}>
                    {PRIORITY_META[selectedCase.priority].label}
                  </span>
                  <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${SOURCE_META[selectedCase.source].tone}`}>
                    {SOURCE_META[selectedCase.source].label}
                  </span>
                </div>
              </div>

              <div className="mt-5 grid items-start gap-4 2xl:grid-cols-[minmax(0,1fr)_340px]">
                <div className="space-y-4">
                  <section>
                    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">
                      <FiCheckCircle className="h-4 w-4" />
                      Resultado esperado
                    </div>
                    <p className="mt-2 text-sm leading-7 text-(--tc-text,#0b1a3c)">{selectedCase.expectedResult}</p>
                  </section>

                  <section>
                    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">
                      <FiLayers className="h-4 w-4" />
                      Pré-condições
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selectedCase.preconditions.map((item) => (
                        <span
                          key={item}
                          className="inline-flex items-center rounded-full border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-3 py-1 text-xs font-semibold text-(--tc-text,#0b1a3c)"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  </section>

                  <section>
                    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">
                      <FiFolder className="h-4 w-4" />
                      Entradas e assets
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selectedCase.inputBindings.map((item) => (
                        <span
                          key={item}
                          className="inline-flex items-center rounded-full border border-(--tc-border,#d7deea) bg-white px-3 py-1 text-xs font-semibold text-(--tc-text,#0b1a3c)"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                    {selectedAssets.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {selectedAssets.map((asset) => (
                          <span
                            key={asset.id}
                            className="inline-flex items-center rounded-full border border-fuchsia-200 bg-fuchsia-50 px-3 py-1 text-xs font-semibold text-fuchsia-700"
                          >
                            {asset.title}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </section>
                </div>

                <aside className="space-y-4">
                  <section className="rounded-3xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) p-4">
                    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">
                      <FiGitBranch className="h-4 w-4" />
                      Fluxo vinculado
                    </div>
                    <p className="mt-2 text-lg font-black tracking-[-0.03em] text-(--tc-text,#0b1a3c)">{selectedFlow?.title ?? "Sem fluxo"}</p>
                    <p className="mt-1 text-sm text-(--tc-text-secondary,#4b5563)">{selectedFlow?.description ?? "Caso ainda sem fluxo publicado."}</p>
                    {selectedFlow ? (
                      <div className="mt-3 grid gap-2">
                        <div className="rounded-2xl border border-(--tc-border,#d7deea) bg-white px-3 py-2 text-sm text-(--tc-text,#0b1a3c)">
                          <strong>{selectedFlow.steps.length}</strong> etapas no fluxo
                        </div>
                        <div className="rounded-2xl border border-(--tc-border,#d7deea) bg-white px-3 py-2 text-sm text-(--tc-text,#0b1a3c)">{selectedFlow.stack}</div>
                      </div>
                    ) : null}
                  </section>

                  <section className="rounded-3xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) p-4">
                    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">
                      <FiCode className="h-4 w-4" />
                      Script
                    </div>
                    <p className="mt-2 text-lg font-black tracking-[-0.03em] text-(--tc-text,#0b1a3c)">{selectedScriptTemplate?.title ?? "Sem template"}</p>
                    <p className="mt-1 text-sm text-(--tc-text-secondary,#4b5563)">{selectedScriptTemplate?.summary ?? "Caso ainda sem estratégia de script."}</p>
                  </section>

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
                </aside>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCaseModalMode("view");
                    setIsCaseModalOpen(true);
                  }}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-(--tc-accent,#ef0001) bg-[#fff5f5] px-4 py-2 text-sm font-semibold text-(--tc-accent,#ef0001)"
                >
                  <FiClipboard className="h-4 w-4" />
                  Abrir modal do caso
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCaseModalMode("edit");
                    setIsCaseModalOpen(true);
                  }}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4 py-2 text-sm font-semibold text-(--tc-text,#0b1a3c)"
                >
                  <FiCode className="h-4 w-4" />
                  Editar no modal
                </button>
                <Link
                  href={`/automacoes/fluxos?flow=${encodeURIComponent(selectedCase.flowId)}`}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-(--tc-primary,#011848) px-4 py-2 text-sm font-semibold text-white"
                >
                  <FiGitBranch className="h-4 w-4" />
                  Abrir fluxo
                </Link>
                <Link
                  href={`/automacoes/scripts?flow=${encodeURIComponent(selectedCase.flowId)}`}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4 py-2 text-sm font-semibold text-(--tc-text,#0b1a3c)"
                >
                  <FiCode className="h-4 w-4" />
                  Abrir script
                </Link>
                <Link
                  href={`/automacoes/execucoes?flow=${encodeURIComponent(selectedCase.flowId)}`}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4 py-2 text-sm font-semibold text-(--tc-text,#0b1a3c)"
                >
                  <FiActivity className="h-4 w-4" />
                  Execuções
                </Link>
                {linkedPlansHref ? (
                  <Link
                    href={linkedPlansHref}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4 py-2 text-sm font-semibold text-(--tc-text,#0b1a3c)"
                  >
                    <FiPlay className="h-4 w-4" />
                    Plano manual
                  </Link>
                ) : null}
              </div>

              {selectedFlow?.steps.length ? (
                <div className="mt-5">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">
                    <FiArrowRight className="h-4 w-4" />
                    Etapas do fluxo
                  </div>
                  <div className="mt-2 grid gap-2">
                    {selectedFlow.steps.map((step, index) => (
                      <div key={`${selectedFlow.id}-${index}`} className="rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-4 py-3 text-sm text-(--tc-text,#0b1a3c)">
                        <span className="font-semibold text-(--tc-accent,#ef0001)">#{index + 1}</span> {step.title}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-(--tc-border,#d7deea) px-4 py-6 text-sm text-(--tc-text-muted,#6b7280)">
              Nenhum caso disponível.
            </div>
          )}
        </article>
      </div>

      {isCaseModalOpen && selectedCase ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-[#06112acc] p-3 sm:p-6">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-[28px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) p-4 shadow-[0_24px_70px_rgba(2,6,23,0.45)] sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-(--tc-accent,#ef0001)">Caso</p>
                <h3 className="mt-2 text-xl font-black tracking-[-0.03em] text-(--tc-text,#0b1a3c)">{selectedCase.title}</h3>
                <p className="mt-1 text-sm text-(--tc-text-secondary,#4b5563)">Abra, ajuste e valide os detalhes do caso sem sair da lista.</p>
                <span className={`mt-2 inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${caseModalMode === "edit" ? "border-(--tc-accent,#ef0001) bg-[#fff5f5] text-(--tc-accent,#ef0001)" : "border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) text-(--tc-text-muted,#6b7280)"}`}>
                  {caseModalMode === "edit" ? "Editando" : "Visualização"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsCaseModalOpen(false)}
                className="inline-flex min-h-10 items-center justify-center rounded-xl border border-(--tc-border,#d7deea) bg-white px-4 py-2 text-sm font-semibold text-(--tc-text,#0b1a3c)"
              >
                Fechar
              </button>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
                Título
                <input
                  value={selectedCase.title}
                  onChange={(event) => updateSelectedCaseDraft("title", event.target.value)}
                  readOnly={caseModalMode !== "edit"}
                  className="min-h-11 rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-4 text-sm outline-none read-only:cursor-default"
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
                  placeholder="smoke, regressao, api"
                  readOnly={caseModalMode !== "edit"}
                  className="min-h-11 rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-4 text-sm outline-none read-only:cursor-default"
                />
              </label>
            </div>

            <label className="mt-3 grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
              Resumo
              <textarea
                value={selectedCase.summary}
                onChange={(event) => updateSelectedCaseDraft("summary", event.target.value)}
                readOnly={caseModalMode !== "edit"}
                rows={3}
                className="rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-4 py-3 text-sm leading-7 outline-none read-only:cursor-default"
              />
            </label>

            <label className="mt-3 grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
              Objetivo
              <textarea
                value={selectedCase.objective}
                onChange={(event) => updateSelectedCaseDraft("objective", event.target.value)}
                readOnly={caseModalMode !== "edit"}
                rows={3}
                className="rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-4 py-3 text-sm leading-7 outline-none read-only:cursor-default"
              />
            </label>

            <label className="mt-3 grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
              Resultado esperado
              <textarea
                value={selectedCase.expectedResult}
                onChange={(event) => updateSelectedCaseDraft("expectedResult", event.target.value)}
                readOnly={caseModalMode !== "edit"}
                rows={3}
                className="rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-4 py-3 text-sm leading-7 outline-none read-only:cursor-default"
              />
            </label>

            <div className="mt-4 flex flex-wrap gap-2">
              {caseModalMode !== "edit" ? (
                <button
                  type="button"
                  onClick={() => setCaseModalMode("edit")}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-(--tc-accent,#ef0001) bg-[#fff5f5] px-4 py-2 text-sm font-semibold text-(--tc-accent,#ef0001)"
                >
                  Editar
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setIsCaseModalOpen(false)}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-(--tc-primary,#011848) px-4 py-2 text-sm font-semibold text-white"
              >
                {caseModalMode === "edit" ? "Salvar e fechar" : "Fechar"}
              </button>
              {caseModalMode === "edit" ? (
                <button
                  type="button"
                  onClick={resetSelectedCaseDraft}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4 py-2 text-sm font-semibold text-(--tc-text,#0b1a3c)"
                >
                  Restaurar original
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
