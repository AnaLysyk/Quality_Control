"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FiCheckCircle, FiLayers, FiLink2, FiPlus, FiTrendingUp, FiX } from "react-icons/fi";
import { getAppMeta } from "@/lib/appMeta";
import { useAuthUser } from "@/hooks/useAuthUser";
import { useClientContext } from "@/context/ClientContext";
import { fetchApi } from "@/lib/api";
import { stripRunPrefix } from "@/lib/runPresentation";

type NewManualRelease = {
  name: string;
  app: string;
  slug: string;
  pass: number;
  fail: number;
  blocked: number;
  notRun: number;
  observations?: string;
};

type CaseStatus = "pass" | "fail" | "blocked" | "notRun";

type ManualCaseDraft = {
  id: string;
  title: string;
  link: string;
  status: CaseStatus;
};

type ApplicationOption = {
  id: string;
  name: string;
  slug: string;
  companySlug?: string | null;
  qaseProjectCode?: string | null;
};

type TestPlanSource = "manual" | "qase";

type TestPlanCaseRef = {
  id: string;
  title?: string | null;
};

type TestPlanItem = {
  id: string;
  title: string;
  description?: string | null;
  casesCount: number;
  source: TestPlanSource;
  projectCode?: string | null;
  applicationId?: string | null;
  applicationName?: string | null;
  cases?: TestPlanCaseRef[];
};

type CaseColumn = {
  key: CaseStatus;
  label: string;
  ringClass: string;
  chipClass: string;
  toneClass: string;
};

const initialState: NewManualRelease = {
  name: "",
  app: "SMART",
  slug: "",
  pass: 0,
  fail: 0,
  blocked: 0,
  notRun: 0,
  observations: "",
};

const initialCaseDraft: ManualCaseDraft = {
  id: "",
  title: "",
  link: "",
  status: "notRun",
};

const fallbackApps = ["SMART", "PRINT", "BOOKING", "CDS", "TRUST", "CIDADAO SMART", "GMT"];

const CASE_COLUMNS: CaseColumn[] = [
  { key: "pass", label: "Aprovado", ringClass: "border-emerald-200", chipClass: "bg-emerald-50 text-emerald-700 border-emerald-200", toneClass: "from-emerald-50 to-white" },
  { key: "fail", label: "Falha", ringClass: "border-rose-200", chipClass: "bg-rose-50 text-rose-700 border-rose-200", toneClass: "from-rose-50 to-white" },
  { key: "blocked", label: "Bloqueado", ringClass: "border-amber-200", chipClass: "bg-amber-50 text-amber-700 border-amber-200", toneClass: "from-amber-50 to-white" },
  { key: "notRun", label: "Nao executado", ringClass: "border-slate-200", chipClass: "bg-slate-100 text-slate-700 border-slate-200", toneClass: "from-slate-50 to-white" },
];

const CASE_STATUS_VALUES: Record<CaseStatus, "APROVADO" | "FALHA" | "BLOQUEADO" | "NAO_EXECUTADO"> = {
  pass: "APROVADO",
  fail: "FALHA",
  blocked: "BLOQUEADO",
  notRun: "NAO_EXECUTADO",
};

function coercePositiveInteger(value: string) {
  return Math.max(0, Number(value) || 0);
}

function makePlanKey(source: TestPlanSource, id: string) {
  return `${source}:${id}`;
}

function buildQaseCaseLink(projectCode: string | null | undefined, caseId: string) {
  const normalizedProjectCode = String(projectCode ?? "").trim();
  const normalizedCaseId = String(caseId ?? "").trim();
  if (!normalizedProjectCode || !normalizedCaseId) return "";
  return `https://app.qase.io/case/${encodeURIComponent(normalizedProjectCode)}/${encodeURIComponent(normalizedCaseId)}`;
}

function mergePlanCasesIntoDrafts(plan: TestPlanItem, currentCases: ManualCaseDraft[]) {
  const currentCasesById = new Map(currentCases.map((item) => [item.id, item]));
  const planCases = Array.isArray(plan.cases) ? plan.cases : [];

  return planCases.map((item) => {
    const current = currentCasesById.get(item.id);
    return {
      id: item.id,
      title: current?.title || item.title?.trim() || `Caso ${item.id}`,
      link: current?.link || buildQaseCaseLink(plan.projectCode, item.id),
      status: current?.status || "notRun",
    } satisfies ManualCaseDraft;
  });
}

export function CreateManualReleaseButton({
  companySlug,
  redirectToRun = true,
  onCreated,
}: {
  companySlug?: string;
  redirectToRun?: boolean;
  onCreated?: (release: { slug?: string; name?: string; title?: string }) => void;
}) {
  useAuthUser();
  const router = useRouter();
  const { activeClientSlug } = useClientContext();
  const resolvedCompanySlug = companySlug ?? activeClientSlug ?? undefined;

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [form, setForm] = useState<NewManualRelease>(initialState);
  const [cases, setCases] = useState<ManualCaseDraft[]>([]);
  const [caseDraft, setCaseDraft] = useState<ManualCaseDraft>({ ...initialCaseDraft });
  const [applications, setApplications] = useState<ApplicationOption[]>([]);
  const [selectedApplicationId, setSelectedApplicationId] = useState<string | null>(null);
  const [plans, setPlans] = useState<TestPlanItem[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [selectedPlanKey, setSelectedPlanKey] = useState("");
  const [planActionLoading, setPlanActionLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let active = true;

    async function loadApplications() {
      try {
        const query = resolvedCompanySlug ? `?companySlug=${encodeURIComponent(resolvedCompanySlug)}` : "";
        const response = await fetchApi(`/api/applications${query}`, {
          cache: "no-store",
        });
        const payload = await response.json().catch(() => null);
        const items = Array.isArray(payload?.items) ? payload.items : [];
        const mapped = items
          .map((item: unknown): ApplicationOption => {
            const record = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
            return {
              id: typeof record.id === "string" ? record.id : "",
              name: typeof record.name === "string" ? record.name : "",
              slug: typeof record.slug === "string" ? record.slug : "",
              companySlug: typeof record.companySlug === "string" ? record.companySlug : null,
              qaseProjectCode: typeof record.qaseProjectCode === "string" ? record.qaseProjectCode : null,
            };
          })
          .filter((item: ApplicationOption) => item.id && (item.slug || item.name));

        if (!active) return;
        setApplications(mapped);
        const initialApplication = mapped[0] ?? null;
        if (initialApplication) {
          setSelectedApplicationId(initialApplication.id);
          setForm((current) => ({ ...current, app: initialApplication.slug || initialApplication.name }));
        } else {
          setSelectedApplicationId(null);
        }
      } catch {
        if (!active) return;
        setApplications([]);
        setSelectedApplicationId(null);
      }
    }

    void loadApplications();

    return () => {
      active = false;
    };
  }, [open, resolvedCompanySlug]);

  useEffect(() => {
    if (!open || !resolvedCompanySlug || !selectedApplicationId) {
      setPlans([]);
      setSelectedPlanKey("");
      return;
    }

    const companySlug = resolvedCompanySlug;
    const applicationId = selectedApplicationId;
    let active = true;

    async function loadPlans() {
      setPlansLoading(true);
      try {
        const response = await fetchApi(
          `/api/test-plans?companySlug=${encodeURIComponent(companySlug)}&applicationId=${encodeURIComponent(applicationId)}`,
          {
            cache: "no-store",
          },
        );
        const payload = await response.json().catch(() => null);
        const items = Array.isArray(payload?.plans) ? (payload.plans as TestPlanItem[]) : [];
        if (!active) return;
        setPlans(items);
        setSelectedPlanKey((current) =>
          current && items.some((item) => makePlanKey(item.source, item.id) === current) ? current : "",
        );
      } catch {
        if (!active) return;
        setPlans([]);
        setSelectedPlanKey("");
      } finally {
        if (active) setPlansLoading(false);
      }
    }

    void loadPlans();

    return () => {
      active = false;
    };
  }, [open, resolvedCompanySlug, selectedApplicationId]);

  const selectedApplication = applications.find((application) => application.id === selectedApplicationId) ?? null;
  const selectedPlan = useMemo(
    () => plans.find((item) => makePlanKey(item.source, item.id) === selectedPlanKey) ?? null,
    [plans, selectedPlanKey],
  );
  const effectiveAppKey = (selectedApplication?.slug || form.app || "SMART").toLowerCase();
  const appMeta = getAppMeta(effectiveAppKey, selectedApplication?.name || form.app || "Run");
  const total = form.pass + form.fail + form.blocked + form.notRun;
  const passRate = total > 0 ? Math.round((form.pass / total) * 100) : 0;

  const groupedCases = useMemo(
    () =>
      CASE_COLUMNS.reduce<Record<CaseStatus, ManualCaseDraft[]>>(
        (accumulator, column) => {
          accumulator[column.key] = cases.filter((item) => item.status === column.key);
          return accumulator;
        },
        { pass: [], fail: [], blocked: [], notRun: [] },
      ),
    [cases],
  );

  const resetState = useCallback(() => {
    setSubmitError(null);
    setForm(initialState);
    setCases([]);
    setCaseDraft({ ...initialCaseDraft });
    setApplications([]);
    setSelectedApplicationId(null);
    setPlans([]);
    setSelectedPlanKey("");
    setPlansLoading(false);
    setPlanActionLoading(false);
  }, []);

  const closeModal = useCallback(() => {
    setOpen(false);
    setSaving(false);
    resetState();
  }, [resetState]);

  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeModal();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, closeModal]);

  function handleOpen() {
    setSubmitError(null);
    setOpen(true);
  }

  function handleNumber(field: keyof Pick<NewManualRelease, "pass" | "fail" | "blocked" | "notRun">, value: string) {
    setForm((current) => ({ ...current, [field]: coercePositiveInteger(value) }));
  }

  function handleCaseDraftChange<K extends keyof ManualCaseDraft>(field: K, value: ManualCaseDraft[K]) {
    setCaseDraft((current) => ({ ...current, [field]: value }));
  }

  function handleAddCase() {
    const trimmedId = caseDraft.id.trim();
    const trimmedTitle = caseDraft.title.trim();
    if (!trimmedId || !trimmedTitle) return;

    setCases((current) => {
      const next = current.filter((item) => item.id !== trimmedId);
      next.push({ id: trimmedId, title: trimmedTitle, link: caseDraft.link.trim(), status: caseDraft.status });
      return next;
    });
    setCaseDraft({ ...initialCaseDraft, status: caseDraft.status });
  }

  function handleRemoveCase(id: string) {
    setCases((current) => current.filter((item) => item.id !== id));
  }

  async function resolvePlanDetail(plan: TestPlanItem) {
    if (!resolvedCompanySlug || !selectedApplicationId) {
      throw new Error("Selecione a aplicacao antes de carregar o plano.");
    }

    const response = await fetchApi(
      `/api/test-plans?companySlug=${encodeURIComponent(resolvedCompanySlug)}&applicationId=${encodeURIComponent(selectedApplicationId)}&planId=${encodeURIComponent(plan.id)}&source=${encodeURIComponent(plan.source)}`,
      {
        cache: "no-store",
      },
    );
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.plan) {
      throw new Error(
        (typeof payload?.error === "string" && payload.error) || "Nao foi possivel carregar o plano de teste.",
      );
    }
    return payload.plan as TestPlanItem;
  }

  async function handleApplyPlan() {
    if (!selectedPlan) return;

    setPlanActionLoading(true);
    setSubmitError(null);
    try {
      const planDetail = await resolvePlanDetail(selectedPlan);
      const mergedCases = mergePlanCasesIntoDrafts(planDetail, cases);
      setCases(mergedCases);
    } catch (error) {
      console.error(error);
      setSubmitError(
        error instanceof Error ? error.message : "Nao foi possivel aplicar o plano de teste.",
      );
    } finally {
      setPlanActionLoading(false);
    }
  }

  async function handleSubmit() {
    const cleanedName = stripRunPrefix(form.name);
    if (!cleanedName) return;

    setSaving(true);
    setSubmitError(null);

    try {
      const response = await fetch("/api/releases-manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          kind: "run",
          name: cleanedName,
          app: selectedApplication?.slug || form.app,
          qaseProject: selectedApplication?.qaseProjectCode || form.app.toUpperCase(),
          testPlanId: selectedPlan?.id ?? null,
          testPlanName: selectedPlan?.title ?? null,
          testPlanSource: selectedPlan?.source ?? null,
          testPlanProjectCode:
            selectedPlan?.projectCode || selectedApplication?.qaseProjectCode || form.app.toUpperCase(),
          slug: form.slug,
          ...(resolvedCompanySlug ? { clientSlug: resolvedCompanySlug } : {}),
          stats: {
            pass: form.pass,
            fail: form.fail,
            blocked: form.blocked,
            notRun: form.notRun,
          },
          observations: form.observations,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
        const message =
          (typeof payload.message === "string" && payload.message) ||
          (typeof payload.error === "string" && payload.error) ||
          "Erro ao criar run";
        throw new Error(message);
      }

      const created = (await response.json()) as { slug?: string; name?: string; title?: string };

      if (cases.length && created.slug) {
        const casesResponse = await fetch(`/api/releases-manual/${created.slug}/cases`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(
            cases.map((item) => ({
              id: item.id,
              title: item.title,
              link: item.link || undefined,
              status: CASE_STATUS_VALUES[item.status],
              fromApi: false,
            })),
          ),
        });

        if (!casesResponse.ok) {
          console.error("Erro ao vincular casos", await casesResponse.text());
        }
      }

      closeModal();
      onCreated?.(created);

      if (!redirectToRun || !created.slug) {
        router.refresh();
        return;
      }

      const target = resolvedCompanySlug
        ? `/${encodeURIComponent(resolvedCompanySlug)}/runs/${encodeURIComponent(created.slug)}`
        : `/release/${encodeURIComponent(created.slug)}`;

      if (typeof window !== "undefined") {
        const expectedPath = new URL(target, window.location.origin).pathname;
        const isE2E = typeof navigator !== "undefined" && navigator.webdriver === true;
        if (isE2E) {
          window.location.assign(target);
          return;
        }
        router.push(target);
        setTimeout(() => {
          if (window.location.pathname !== expectedPath) {
            window.location.assign(target);
          }
        }, 60);
        return;
      }

      router.push(target);
    } catch (error) {
      console.error(error);
      setSubmitError(error instanceof Error ? error.message : "Erro ao criar run");
      setSaving(false);
      return;
    }

    setSaving(false);
  }

  return (
    <div className="relative">
      <button
        data-testid="create-run"
        type="button"
        onClick={handleOpen}
        className="rounded-2xl bg-(--tc-accent) px-4 py-2.5 text-sm font-semibold text-white shadow hover:brightness-110"
      >
        <span data-testid="run-create">Criar run manual</span>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-3 py-4 backdrop-blur-sm sm:px-5"
          role="dialog"
          aria-modal="true"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeModal();
            }
          }}
        >
          <div className="flex max-h-[calc(100dvh-1rem)] w-full max-w-[1320px] flex-col overflow-hidden rounded-[32px] border border-white/20 bg-white shadow-[0_30px_120px_rgba(15,23,42,0.42)]">
            <div className="bg-[linear-gradient(135deg,#011848_0%,#0a2f7a_52%,#ef0001_100%)] px-5 py-5 text-white sm:px-7 sm:py-6">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-white/70">Run manual</p>
                  <h2 className="mt-2 text-3xl font-black tracking-[-0.04em]">Criar nova run</h2>
                  <p className="mt-2 max-w-3xl text-sm text-white/82">
                    Registre a execucao manual, distribua os casos no quadro de status e salve tudo em uma unica superficie.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeModal}
                  className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/8 text-white transition hover:bg-white/16"
                  aria-label="Fechar modal"
                >
                  <FiX className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full border border-white/18 bg-white/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/88">
                  {resolvedCompanySlug ? `Empresa ${resolvedCompanySlug}` : "Contexto institucional"}
                </span>
                <span className="rounded-full border border-white/18 bg-white/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/88">
                  {selectedApplication?.name || appMeta.label}
                </span>
                {selectedApplication?.qaseProjectCode ? (
                  <span className="rounded-full border border-emerald-200/40 bg-emerald-400/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-50">
                    Qase {selectedApplication.qaseProjectCode}
                  </span>
                ) : null}
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-[22px] border border-white/18 bg-white/12 p-4 backdrop-blur">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/68">Aplicacao</p>
                  <div className="mt-2 text-xl font-extrabold text-white">{selectedApplication?.name || appMeta.label}</div>
                  <p className="mt-2 text-sm text-white/76">Projeto visual e contexto da run manual.</p>
                </div>
                <div className="rounded-[22px] border border-white/18 bg-white/12 p-4 backdrop-blur">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/68">Total executado</p>
                  <div className="mt-2 text-xl font-extrabold text-white">{total} caso(s)</div>
                  <p className="mt-2 text-sm text-white/76">Soma de aprovado, falha, bloqueado e nao executado.</p>
                </div>
                <div className="rounded-[22px] border border-white/18 bg-white/12 p-4 backdrop-blur">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/68">Pass rate</p>
                  <div className="mt-2 text-xl font-extrabold text-white">{passRate}%</div>
                  <p className="mt-2 text-sm text-white/76">Leitura rapida da saude da execucao.</p>
                </div>
                <div className="rounded-[22px] border border-white/18 bg-white/12 p-4 backdrop-blur">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/68">Casos no quadro</p>
                  <div className="mt-2 text-xl font-extrabold text-white">{cases.length}</div>
                  <p className="mt-2 text-sm text-white/76">Cartoes prontos para salvar junto da run.</p>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] px-5 py-5 sm:px-7 sm:py-6">
              <div className="grid gap-6 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
                <section className="space-y-6">
                  <div className="rounded-[28px] border border-(--tc-border,#dfe5f1) bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-700">
                        <FiLayers className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-(--tc-accent,#ef0001)">Contexto da run</p>
                        <h3 className="mt-1 text-lg font-extrabold text-(--tc-text,#0b1a3c)">Base da execucao</h3>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-4 lg:grid-cols-2">
                      <label className="space-y-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.25em] text-(--tc-text-muted,#6b7280)">Titulo</span>
                        <input
                          className="w-full rounded-[20px] border border-(--tc-border,#dfe5f1) bg-(--tc-surface,#f8fafc) px-4 py-3 text-sm text-(--tc-text,#0f172a) outline-none transition focus:border-(--tc-accent,#ef0001) focus:ring-2 focus:ring-(--tc-accent,#ef0001)/20"
                          data-testid="run-title"
                          value={form.name}
                          onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                          placeholder="Ex: Run 1.9.0 - Regressao"
                        />
                        <input
                          aria-hidden="true"
                          tabIndex={-1}
                          data-testid="run-name"
                          value={form.name}
                          onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                          className="sr-only"
                        />
                      </label>

                      <label className="space-y-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.25em] text-(--tc-text-muted,#6b7280)">Aplicacao</span>
                        {applications.length > 0 ? (
                          <select
                            aria-label="Selecionar aplicacao"
                            className="w-full rounded-[20px] border border-(--tc-border,#dfe5f1) bg-(--tc-surface,#f8fafc) px-4 py-3 text-sm text-(--tc-text,#0f172a) outline-none transition focus:border-(--tc-accent,#ef0001) focus:ring-2 focus:ring-(--tc-accent,#ef0001)/20"
                            value={selectedApplicationId ?? ""}
                            onChange={(event) => {
                              const nextId = event.target.value;
                              setSelectedApplicationId(nextId);
                              setSelectedPlanKey("");
                              const nextApplication = applications.find((application) => application.id === nextId) ?? null;
                              if (nextApplication) {
                                setForm((current) => ({ ...current, app: nextApplication.slug || nextApplication.name }));
                              }
                            }}
                          >
                            {applications.map((application) => (
                              <option key={application.id} value={application.id}>
                                {application.name}
                                {application.qaseProjectCode ? ` (${application.qaseProjectCode})` : ""}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <select
                            aria-label="Selecionar aplicacao"
                            className="w-full rounded-[20px] border border-(--tc-border,#dfe5f1) bg-(--tc-surface,#f8fafc) px-4 py-3 text-sm text-(--tc-text,#0f172a) outline-none transition focus:border-(--tc-accent,#ef0001) focus:ring-2 focus:ring-(--tc-accent,#ef0001)/20"
                            value={form.app}
                            onChange={(event) => setForm((current) => ({ ...current, app: event.target.value }))}
                          >
                            {fallbackApps.map((application) => (
                              <option key={application} value={application}>
                                {application}
                              </option>
                            ))}
                          </select>
                        )}
                        <span className="text-xs text-(--tc-text-muted,#6b7280)">
                          {selectedApplication?.qaseProjectCode
                            ? `Projeto Qase ${selectedApplication.qaseProjectCode}`
                            : `${appMeta.label} sera usado como contexto desta run.`}
                        </span>
                      </label>

                      <label className="space-y-2 lg:col-span-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.25em] text-(--tc-text-muted,#6b7280)">Slug da run</span>
                        <input
                          className="w-full rounded-[20px] border border-(--tc-border,#dfe5f1) bg-(--tc-surface,#f8fafc) px-4 py-3 text-sm text-(--tc-text,#0f172a) outline-none transition focus:border-(--tc-accent,#ef0001) focus:ring-2 focus:ring-(--tc-accent,#ef0001)/20"
                          data-testid="run-slug"
                          value={form.slug}
                          onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))}
                          placeholder="Ex: v1_9_0_reg"
                        />
                        <span className="text-xs text-(--tc-text-muted,#6b7280)">
                          Se vazio, o slug sera derivado automaticamente do titulo.
                        </span>
                      </label>

                      <div className="space-y-3 rounded-[22px] border border-(--tc-border,#dfe5f1) bg-(--tc-surface,#f8fafc) p-4 lg:col-span-2">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <span className="text-xs font-semibold uppercase tracking-[0.25em] text-(--tc-text-muted,#6b7280)">
                              Plano de teste
                            </span>
                            <p className="mt-1 text-sm text-(--tc-text-secondary,#4b5563)">
                              Selecione um plano para preencher o quadro com os casos. Sem plano, a run segue direta.
                            </p>
                          </div>
                          {selectedPlan ? (
                            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-700">
                              {selectedPlan.source === "qase" ? "Qase" : "Manual"} · {selectedPlan.casesCount} caso(s)
                            </span>
                          ) : null}
                        </div>

                        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
                          <select
                            aria-label="Selecionar plano de teste"
                            value={selectedPlanKey}
                            onChange={(event) => setSelectedPlanKey(event.target.value)}
                            className="w-full rounded-[20px] border border-(--tc-border,#dfe5f1) bg-white px-4 py-3 text-sm text-(--tc-text,#0f172a) outline-none transition focus:border-(--tc-accent,#ef0001) focus:ring-2 focus:ring-(--tc-accent,#ef0001)/20"
                            disabled={!selectedApplicationId || plansLoading}
                          >
                            <option value="">
                              {plansLoading
                                ? "Carregando planos..."
                                : plans.length > 0
                                  ? "Sem plano aplicado"
                                  : "Nenhum plano disponivel"}
                            </option>
                            {plans.map((plan) => (
                              <option key={makePlanKey(plan.source, plan.id)} value={makePlanKey(plan.source, plan.id)}>
                                {plan.title} · {plan.source === "qase" ? "Qase" : "Manual"}
                              </option>
                            ))}
                          </select>

                          <button
                            type="button"
                            onClick={() => void handleApplyPlan()}
                            disabled={!selectedPlan || planActionLoading}
                            className="rounded-2xl border border-(--tc-border,#dfe5f1) bg-white px-4 py-3 text-sm font-semibold text-(--tc-text,#0b1a3c) transition hover:border-(--tc-accent,#ef0001) disabled:opacity-60"
                          >
                            {planActionLoading ? "Aplicando..." : "Aplicar plano"}
                          </button>

                          <button
                            type="button"
                            onClick={() => setSelectedPlanKey("")}
                            disabled={!selectedPlanKey}
                            className="rounded-2xl border border-(--tc-border,#dfe5f1) bg-transparent px-4 py-3 text-sm font-semibold text-(--tc-text-secondary,#4b5563) transition hover:border-slate-400 hover:text-slate-900 disabled:opacity-60"
                          >
                            Run direta
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[28px] border border-(--tc-border,#dfe5f1) bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-(--tc-accent,#ef0001)">Totais da execucao</p>
                        <h3 className="mt-1 text-lg font-extrabold text-(--tc-text,#0b1a3c)">Distribuicao de status</h3>
                      </div>
                      <button
                        type="button"
                        data-testid="run-status-fail"
                        onClick={() => {
                          if (form.fail === 0) {
                            setForm((current) => ({ ...current, fail: 1 }));
                          }
                        }}
                        className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-rose-700"
                      >
                        Marcar falha
                      </button>
                    </div>

                    <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                      {([
                        { key: "pass", label: "Aprovado", testId: "run-stat-pass", chipClass: "border-emerald-200 bg-emerald-50 text-emerald-700" },
                        { key: "fail", label: "Falha", testId: "run-stat-fail", chipClass: "border-rose-200 bg-rose-50 text-rose-700" },
                        { key: "blocked", label: "Bloqueado", testId: "run-stat-blocked", chipClass: "border-amber-200 bg-amber-50 text-amber-700" },
                        { key: "notRun", label: "Nao executado", testId: "run-stat-not-run", chipClass: "border-slate-200 bg-slate-100 text-slate-700" },
                      ] as const).map((item) => (
                        <div key={item.key} className={`rounded-[24px] border p-4 shadow-sm ${item.chipClass}`}>
                          <div className="text-[11px] font-semibold uppercase tracking-[0.24em]">{item.label}</div>
                          <input
                            type="number"
                            min={0}
                            aria-label={`Total ${item.label}`}
                            data-testid={item.testId}
                            className="mt-3 w-full border-0 bg-transparent p-0 text-3xl font-black text-(--tc-text,#0b1a3c) outline-none"
                            value={form[item.key]}
                            onChange={(event) => handleNumber(item.key, event.target.value)}
                          />
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Total consolidado</div>
                        <div className="mt-2 text-2xl font-black text-(--tc-text,#0b1a3c)">{total}</div>
                      </div>
                      <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Pass rate</div>
                        <div className="mt-2 text-2xl font-black text-(--tc-text,#0b1a3c)">{passRate}%</div>
                      </div>
                      <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Casos ligados</div>
                        <div className="mt-2 text-2xl font-black text-(--tc-text,#0b1a3c)">{cases.length}</div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[28px] border border-(--tc-border,#dfe5f1) bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-700">
                        <FiTrendingUp className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-(--tc-accent,#ef0001)">Observacoes</p>
                        <h3 className="mt-1 text-lg font-extrabold text-(--tc-text,#0b1a3c)">Notas da execucao</h3>
                      </div>
                    </div>
                    <textarea
                      className="mt-5 min-h-[170px] w-full rounded-[24px] border border-(--tc-border,#dfe5f1) bg-(--tc-surface,#f8fafc) px-4 py-3 text-sm text-(--tc-text,#0f172a) outline-none transition focus:border-(--tc-accent,#ef0001) focus:ring-2 focus:ring-(--tc-accent,#ef0001)/20"
                      rows={6}
                      value={form.observations}
                      onChange={(event) => setForm((current) => ({ ...current, observations: event.target.value }))}
                      placeholder="Contexto da execucao, riscos encontrados, links uteis e proximos passos."
                    />
                  </div>
                </section>

                <section className="space-y-6">
                  <div className="rounded-[28px] border border-(--tc-border,#dfe5f1) bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-700">
                        <FiPlus className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-(--tc-accent,#ef0001)">Casos executados</p>
                        <h3 className="mt-1 text-lg font-extrabold text-(--tc-text,#0b1a3c)">Adicionar ao quadro</h3>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-4 lg:grid-cols-2">
                      <label className="space-y-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.25em] text-(--tc-text-muted,#6b7280)">ID do caso</span>
                        <input
                          type="text"
                          autoFocus
                          value={caseDraft.id}
                          onChange={(event) => handleCaseDraftChange("id", event.target.value)}
                          className="w-full rounded-[20px] border border-(--tc-border,#dfe5f1) bg-(--tc-surface,#f8fafc) px-4 py-3 text-sm text-(--tc-text,#0f172a) outline-none transition focus:border-(--tc-accent,#ef0001) focus:ring-2 focus:ring-(--tc-accent,#ef0001)/20"
                          placeholder="Ex: 12345"
                        />
                      </label>
                      <label className="space-y-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.25em] text-(--tc-text-muted,#6b7280)">Status</span>
                        <select
                          aria-label="Status do caso"
                          value={caseDraft.status}
                          onChange={(event) => handleCaseDraftChange("status", event.target.value as CaseStatus)}
                          className="w-full rounded-[20px] border border-(--tc-border,#dfe5f1) bg-(--tc-surface,#f8fafc) px-4 py-3 text-sm text-(--tc-text,#0f172a) outline-none transition focus:border-(--tc-accent,#ef0001) focus:ring-2 focus:ring-(--tc-accent,#ef0001)/20"
                        >
                          {CASE_COLUMNS.map((column) => (
                            <option key={column.key} value={column.key}>
                              {column.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="space-y-2 lg:col-span-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.25em] text-(--tc-text-muted,#6b7280)">Titulo</span>
                        <input
                          type="text"
                          value={caseDraft.title}
                          onChange={(event) => handleCaseDraftChange("title", event.target.value)}
                          className="w-full rounded-[20px] border border-(--tc-border,#dfe5f1) bg-(--tc-surface,#f8fafc) px-4 py-3 text-sm text-(--tc-text,#0f172a) outline-none transition focus:border-(--tc-accent,#ef0001) focus:ring-2 focus:ring-(--tc-accent,#ef0001)/20"
                          placeholder="Nome do caso executado"
                        />
                      </label>
                      <label className="space-y-2 lg:col-span-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.25em] text-(--tc-text-muted,#6b7280)">Link opcional</span>
                        <div className="relative">
                          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                            <FiLink2 className="h-4 w-4" />
                          </span>
                          <input
                            type="url"
                            value={caseDraft.link}
                            onChange={(event) => handleCaseDraftChange("link", event.target.value)}
                            className="w-full rounded-[20px] border border-(--tc-border,#dfe5f1) bg-(--tc-surface,#f8fafc) py-3 pr-4 pl-11 text-sm text-(--tc-text,#0f172a) outline-none transition focus:border-(--tc-accent,#ef0001) focus:ring-2 focus:ring-(--tc-accent,#ef0001)/20"
                            placeholder="https://app.qase.io/run/..."
                          />
                        </div>
                      </label>
                    </div>

                    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="text-sm text-(--tc-text-secondary,#4b5563)">
                        ID e titulo sao obrigatorios. O cartao entra direto na coluna selecionada.
                      </div>
                      <button
                        type="button"
                        onClick={handleAddCase}
                        className="rounded-full bg-(--tc-accent,#ef0001) px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-white shadow transition hover:brightness-110 disabled:opacity-60"
                        disabled={!caseDraft.id.trim() || !caseDraft.title.trim()}
                      >
                        Adicionar caso
                      </button>
                    </div>
                  </div>

                  <div className="rounded-[28px] border border-(--tc-border,#dfe5f1) bg-white p-5 shadow-sm">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-(--tc-accent,#ef0001)">Quadro da run</p>
                        <h3 className="mt-1 text-lg font-extrabold text-(--tc-text,#0b1a3c)">Kanban dos casos executados</h3>
                      </div>
                      <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-slate-700">
                        <FiCheckCircle className="h-3.5 w-3.5" />
                        {cases.length} caso(s)
                      </div>
                    </div>

                    <div className="mt-5 grid gap-4 xl:grid-cols-4">
                      {CASE_COLUMNS.map((column) => {
                        const columnCases = groupedCases[column.key];
                        return (
                          <div
                            key={column.key}
                            className={`rounded-[24px] border bg-linear-to-b ${column.toneClass} p-4 shadow-sm ${column.ringClass}`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] ${column.chipClass}`}>
                                {column.label}
                              </div>
                              <span className="text-sm font-extrabold text-(--tc-text,#0b1a3c)">{columnCases.length}</span>
                            </div>

                            <div className="mt-4 max-h-[340px] space-y-3 overflow-y-auto pr-1">
                              {columnCases.length === 0 ? (
                                <div className="rounded-[20px] border border-dashed border-slate-200 bg-white/80 px-4 py-5 text-sm text-slate-500">
                                  Nenhum caso nesta coluna.
                                </div>
                              ) : (
                                columnCases.map((item) => (
                                  <article
                                    key={`${column.key}-${item.id}`}
                                    className="relative rounded-[22px] border border-white/80 bg-white p-4 shadow-[0_14px_34px_rgba(15,23,42,0.08)]"
                                  >
                                    <div className="pr-10">
                                      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                                        Caso {item.id}
                                      </p>
                                      <p className="mt-2 text-sm font-semibold leading-6 text-(--tc-text,#0b1a3c)">{item.title}</p>
                                      {item.link ? (
                                        <a
                                          href={item.link}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-(--tc-accent,#ef0001)"
                                        >
                                          <FiLink2 className="h-3.5 w-3.5" />
                                          Abrir link
                                        </a>
                                      ) : (
                                        <p className="mt-3 text-xs text-slate-500">Sem link informado.</p>
                                      )}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveCase(item.id)}
                                      className="absolute top-3 right-3 inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                                      aria-label={`Remover caso ${item.id}`}
                                    >
                                      <FiX className="h-3.5 w-3.5" />
                                    </button>
                                  </article>
                                ))
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </section>
              </div>
            </div>

            <div className="sticky bottom-0 z-10 border-t border-slate-200 bg-white/96 px-5 py-4 backdrop-blur sm:px-7">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-h-[20px] text-sm">
                  {submitError ? (
                    <span className="font-medium text-rose-600">{submitError}</span>
                  ) : (
                    <span className="text-slate-500">Voce pode salvar sem casos e complementar depois.</span>
                  )}
                </div>
                <div className="flex flex-wrap items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="rounded-2xl border border-(--tc-border,#dfe5f1) px-5 py-2.5 text-sm font-semibold text-(--tc-text,#0b1a3c) transition hover:border-slate-400 hover:text-slate-900"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={saving || !form.name.trim()}
                    data-testid="run-submit"
                    className="rounded-2xl bg-(--tc-accent,#ef0001) px-5 py-2.5 text-sm font-semibold text-white shadow transition hover:brightness-110 disabled:opacity-60"
                  >
                    {saving ? "Salvando..." : <span data-testid="run-save">{redirectToRun ? "Salvar e abrir" : "Salvar run"}</span>}
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
