"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  FiClipboard,
  FiEdit2,
  FiLayers,
  FiPlus,
  FiRefreshCcw,
  FiTrash2,
  FiX,
} from "react-icons/fi";
import { fetchApi } from "@/lib/api";

type ApplicationItem = {
  id: string;
  name: string;
  slug: string;
  qaseProjectCode?: string | null;
  source?: string | null;
};

type PlanCaseRef = {
  id: string;
  title?: string | null;
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
  cases?: PlanCaseRef[];
};

type PlanDraft = {
  id?: string;
  source: "manual" | "qase";
  title: string;
  description: string;
  casesText: string;
};

const EMPTY_DRAFT: PlanDraft = {
  source: "manual",
  title: "",
  description: "",
  casesText: "",
};

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

function formatCasesText(cases?: PlanCaseRef[]) {
  if (!Array.isArray(cases) || !cases.length) return "";
  return cases
    .map((item) => (item.title?.trim() ? `${item.id} | ${item.title.trim()}` : item.id))
    .join("\n");
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
        setSelectedApplicationId(items[0]?.id ?? "");
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

  const canUseQase = Boolean(selectedApplication?.qaseProjectCode);

  const loadPlans = useCallback(async () => {
    if (!slug || !selectedApplicationId) {
      setPlans([]);
      setWarning(null);
      setProjectCode(null);
      setTotalTests(0);
      return;
    }

    setLoadingPlans(true);
    setError(null);
    try {
      const response = await fetchApi(
        `/api/test-plans?companySlug=${encodeURIComponent(slug)}&applicationId=${encodeURIComponent(selectedApplicationId)}`,
      );
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

  const filteredPlans = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return plans;
    return plans.filter((plan) =>
      [
        plan.title,
        plan.description,
        plan.projectCode,
        plan.source,
        plan.applicationName,
      ]
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

  function openCreate(source: "manual" | "qase") {
    setDraft({
      ...EMPTY_DRAFT,
      source: source === "qase" && canUseQase ? "qase" : "manual",
    });
    setModalOpen(true);
    setLoadingPlanDetail(false);
  }

  async function openEdit(plan: TestPlanItem) {
    if (!slug || !selectedApplicationId) return;
    setLoadingPlanDetail(true);
    setModalOpen(true);
    setDraft({
      id: plan.id,
      source: plan.source,
      title: plan.title,
      description: plan.description ?? "",
      casesText: "",
    });

    try {
      const query = new URLSearchParams({
        companySlug: slug,
        applicationId: selectedApplicationId,
        source: plan.source,
        planId: plan.id,
      });
      if (plan.projectCode) {
        query.set("project", plan.projectCode);
      }
      const response = await fetchApi(`/api/test-plans?${query.toString()}`);
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.plan) {
        throw new Error("Erro ao abrir plano");
      }
      const fullPlan = payload.plan as TestPlanItem;
      setDraft({
        id: fullPlan.id,
        source: fullPlan.source,
        title: fullPlan.title,
        description: fullPlan.description ?? "",
        casesText: formatCasesText(fullPlan.cases),
      });
    } catch {
      setError("Nao foi possivel abrir o plano selecionado.");
      setModalOpen(false);
    } finally {
      setLoadingPlanDetail(false);
    }
  }

  async function handleDelete(plan: TestPlanItem) {
    if (!slug || !selectedApplicationId) return;
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
          applicationId: selectedApplicationId,
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
    if (!slug || !selectedApplicationId) return;
    const title = draft.title.trim();
    if (!title) {
      setError("Informe o titulo do plano.");
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
          applicationId: selectedApplicationId,
          source: draft.source,
          planId: draft.id,
          title,
          description: draft.description,
          cases: draft.casesText,
          projectCode: selectedApplication?.qaseProjectCode ?? projectCode,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(typeof payload?.error === "string" ? payload.error : "Erro ao salvar plano");
      }
      setModalOpen(false);
      setDraft(EMPTY_DRAFT);
      await loadPlans();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Nao foi possivel salvar o plano.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-(--page-bg,#f5f6fa) px-4 py-8 text-(--page-text,#0b1a3c) sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-none space-y-6">
        <header className="rounded-3xl bg-[linear-gradient(135deg,#011848_0%,#21438f_48%,#ef0001_100%)] p-6 text-white shadow-[0_22px_60px_rgba(15,23,42,0.2)]">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.38em] text-white/72">
                Planos de teste
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-[-0.04em]">Planos da empresa</h1>
              <p className="mt-2 max-w-3xl text-sm text-white/82">
                Integracao Qase e cadastro manual na mesma base. O plano pode nascer na integracao
                ou ficar local para uso operacional.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/16 bg-white/10 px-4 py-3 backdrop-blur">
                <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/68">
                  Total
                </div>
                <div className="mt-2 text-3xl font-black">{totals.total}</div>
              </div>
              <div className="rounded-2xl border border-white/16 bg-white/10 px-4 py-3 backdrop-blur">
                <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/68">
                  Qase
                </div>
                <div className="mt-2 text-3xl font-black">{totals.qase}</div>
              </div>
              <div className="rounded-2xl border border-white/16 bg-white/10 px-4 py-3 backdrop-blur">
                <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/68">
                  Casos
                </div>
                <div className="mt-2 text-3xl font-black">{totalTests}</div>
              </div>
            </div>
          </div>
        </header>

        <section className="rounded-3xl border border-(--tc-border,#e5e7eb) bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#121b2d]">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,280px)_minmax(0,1fr)_auto] xl:items-end">
            <label className="block text-xs font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">
              Aplicacao
              <select
                value={selectedApplicationId}
                onChange={(event) => setSelectedApplicationId(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-(--tc-border,#dfe5f1) bg-(--tc-surface,#f8fafc) px-4 py-3 text-sm font-semibold text-(--tc-text,#0f172a) outline-none focus:border-(--tc-accent,#ef0001)"
              >
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
                className="inline-flex items-center gap-2 rounded-2xl border border-(--tc-border,#dfe5f1) bg-(--tc-surface,#f8fafc) px-4 py-3 text-sm font-semibold text-(--tc-text,#0f172a)"
              >
                <FiPlus className="h-4 w-4" />
                Novo manual
              </button>
              {canUseQase ? (
                <button
                  type="button"
                  onClick={() => openCreate("qase")}
                  className="inline-flex items-center gap-2 rounded-2xl bg-(--tc-accent,#ef0001) px-4 py-3 text-sm font-semibold text-white shadow-sm"
                >
                  <FiPlus className="h-4 w-4" />
                  Novo no Qase
                </button>
              ) : null}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.18em] text-(--tc-text-muted,#6b7280)">
            <span className="rounded-full border border-(--tc-border,#dfe5f1) px-3 py-1.5">
              Projeto: {projectCode ?? selectedApplication?.qaseProjectCode ?? "Sem Qase"}
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
                Nenhum plano encontrado para a aplicacao atual.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
              {filteredPlans.map((plan) => (
                <article
                  key={`${plan.source}:${plan.id}`}
                  className="rounded-3xl border border-(--tc-border,#dfe5f1) bg-(--tc-surface,#f9fafb) p-5 shadow-sm dark:border-white/10 dark:bg-[#0f172a]"
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
                    </div>

                    <div className="inline-flex items-center gap-2 rounded-full border border-(--tc-border,#dfe5f1) bg-white px-3 py-1.5 text-xs font-semibold text-(--tc-text,#0f172a) dark:border-white/10 dark:bg-[#182235] dark:text-white">
                      <FiLayers className="h-3.5 w-3.5" />
                      {plan.casesCount} casos
                    </div>
                  </div>

                  <p className="mt-4 min-h-[72px] text-sm leading-6 text-(--tc-text-secondary,#4b5563) dark:text-white/74">
                    {plan.description?.trim() || "Plano sem descricao detalhada."}
                  </p>

                  <div className="mt-4 text-xs text-(--tc-text-muted,#6b7280)">
                    Criado: {formatDate(plan.createdAt)} | Atualizado: {formatDate(plan.updatedAt)}
                  </div>

                  <div className="mt-5 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void openEdit(plan)}
                      className="inline-flex items-center gap-2 rounded-xl border border-(--tc-border,#dfe5f1) bg-white px-3 py-2 text-xs font-semibold text-(--tc-text,#0f172a) dark:border-white/10 dark:bg-[#182235] dark:text-white"
                    >
                      <FiEdit2 className="h-3.5 w-3.5" />
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(plan)}
                      className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:border-rose-400/25 dark:bg-rose-500/10 dark:text-rose-100"
                    >
                      <FiTrash2 className="h-3.5 w-3.5" />
                      Excluir
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6 backdrop-blur-sm"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setModalOpen(false);
            }
          }}
        >
          <div className="max-h-[calc(100dvh-2rem)] w-full max-w-3xl overflow-y-auto rounded-[32px] border border-white/20 bg-white shadow-[0_30px_120px_rgba(15,23,42,0.42)] dark:bg-[#101827]">
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
                      ? "Os dados abaixo alimentam diretamente os endpoints oficiais de planos do Qase."
                      : "O plano manual fica salvo na base local da empresa e pode ser aplicado nas runs."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-white"
                  aria-label="Fechar modal"
                >
                  <FiX className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="space-y-5 px-6 py-6">
              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
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
                    Origem
                  </span>
                  <select
                    value={draft.source}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        source: event.target.value === "qase" && canUseQase ? "qase" : "manual",
                      }))
                    }
                    className="w-full rounded-2xl border border-(--tc-border,#dfe5f1) bg-(--tc-surface,#f8fafc) px-4 py-3 text-sm font-semibold text-(--tc-text,#0f172a) outline-none focus:border-(--tc-accent,#ef0001)"
                  >
                    <option value="manual">Manual local</option>
                    {canUseQase ? <option value="qase">Qase</option> : null}
                  </select>
                </label>
              </div>

              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.25em] text-(--tc-text-muted,#6b7280)">
                  Descricao
                </span>
                <textarea
                  value={draft.description}
                  onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
                  rows={4}
                  className="w-full rounded-3xl border border-(--tc-border,#dfe5f1) bg-(--tc-surface,#f8fafc) px-4 py-3 text-sm text-(--tc-text,#0f172a) outline-none focus:border-(--tc-accent,#ef0001)"
                  placeholder="Contexto, objetivo e recorte do plano."
                />
              </label>

              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.25em] text-(--tc-text-muted,#6b7280)">
                  Casos do plano
                </span>
                <textarea
                  value={draft.casesText}
                  onChange={(event) => setDraft((current) => ({ ...current, casesText: event.target.value }))}
                  rows={8}
                  className="w-full rounded-3xl border border-(--tc-border,#dfe5f1) bg-(--tc-surface,#f8fafc) px-4 py-3 text-sm text-(--tc-text,#0f172a) outline-none focus:border-(--tc-accent,#ef0001)"
                  placeholder={
                    draft.source === "qase"
                      ? "IDs numericos, separados por linha ou virgula.\nEx:\n101\n102\n103"
                      : "Um caso por linha. Opcionalmente use ID | titulo.\nEx:\nLOGIN-01 | Login com operador\nLOGIN-02 | Login com biometria"
                  }
                />
                <p className="text-xs text-(--tc-text-muted,#6b7280)">
                  {draft.source === "qase"
                    ? "Qase aceita apenas case IDs numericos no create/update de plano."
                    : "No manual, voce pode usar IDs livres e titulo opcional por linha."}
                </p>
              </label>

              {loadingPlanDetail ? (
                <div className="rounded-2xl border border-(--tc-border,#dfe5f1) bg-(--tc-surface,#f8fafc) px-4 py-3 text-sm text-(--tc-text-secondary,#4b5563)">
                  Carregando detalhes do plano...
                </div>
              ) : null}

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-(--tc-border,#e5e7eb) pt-4">
                <div className="text-xs text-(--tc-text-muted,#6b7280)">
                  Aplicacao em foco:{" "}
                  <span className="font-semibold text-(--tc-text,#0f172a)">
                    {selectedApplication?.name ?? "Sem aplicacao"}
                  </span>
                  {selectedApplication?.qaseProjectCode ? ` | Qase ${selectedApplication.qaseProjectCode}` : ""}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="rounded-2xl border border-(--tc-border,#dfe5f1) bg-(--tc-surface,#f8fafc) px-4 py-3 text-sm font-semibold text-(--tc-text,#0f172a)"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSave()}
                    disabled={saving}
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
