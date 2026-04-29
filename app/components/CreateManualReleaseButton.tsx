"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { FiLayers, FiLink2, FiTrendingUp, FiX } from "react-icons/fi";
import { RunCasesBoard, RUN_CASE_STATUS_VALUES, computeRunCaseStats, type RunCaseDraft } from "@/components/RunCasesBoard";
import { useClientContext } from "@/context/ClientContext";
import { useAuthUser } from "@/hooks/useAuthUser";
import { fetchApi } from "@/lib/api";
import { getAppMeta } from "@/lib/appMeta";
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

type ApplicationOption = {
  id: string;
  name: string;
  slug: string;
  companySlug?: string | null;
  qaseProjectCode?: string | null;
};

type TestPlanSource = "manual" | "qase";

type TestPlanCaseStep = {
  id: string;
  action?: string | null;
  expectedResult?: string | null;
};

type TestPlanCaseRef = {
  id: string;
  title?: string | null;
  link?: string | null;
  steps?: TestPlanCaseStep[];
};

type TestPlanItem = {
  id: string;
  title: string;
  casesCount: number;
  source: TestPlanSource;
  projectCode?: string | null;
  applicationId?: string | null;
  applicationName?: string | null;
  cases?: TestPlanCaseRef[];
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

const fallbackApps = ["SMART", "PRINT", "BOOKING", "CDS", "TRUST", "CIDADAO SMART", "GMT"];

function coercePositiveInteger(value: string) {
  return Math.max(0, Number(value) || 0);
}

function makePlanKey(source: TestPlanSource, id: string) {
  return `${source}:${id}`;
}

function buildQaseCaseLink(projectCode: string | null | undefined, caseId: string) {
  const normalizedProjectCode = String(projectCode ?? "").trim();
  const normalizedCaseId = String(caseId ?? "").replace(/\D/g, "").trim();
  if (!normalizedProjectCode || !normalizedCaseId) return "";
  return `https://app.qase.io/case/${encodeURIComponent(normalizedProjectCode)}-${encodeURIComponent(normalizedCaseId)}`;
}

function mergePlanCasesIntoDrafts(plan: TestPlanItem, currentCases: RunCaseDraft[]) {
  const currentCasesById = new Map(currentCases.map((item) => [item.id, item]));
  const planCases = Array.isArray(plan.cases) ? plan.cases : [];

  return planCases.map((item) => {
    const current = currentCasesById.get(item.id);
    return {
      id: item.id,
      title: current?.title || item.title?.trim() || `Caso ${item.id}`,
      link: current?.link || item.link?.trim() || buildQaseCaseLink(plan.projectCode, item.id),
      status: current?.status || "notRun",
      bug: current?.bug ?? null,
      fromApi: false,
    } satisfies RunCaseDraft;
  });
}

export function CreateManualReleaseButton({
  companySlug,
  redirectToRun = true,
  onCreated,
}: {
  companySlug?: string;
  redirectToRun?: boolean;
  manualOnly?: boolean;
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
  const [cases, setCases] = useState<RunCaseDraft[]>([]);
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
        const response = await fetchApi(`/api/applications${query}`, { cache: "no-store" });
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

    const currentCompanySlug = resolvedCompanySlug;
    const applicationId = selectedApplicationId;
    let active = true;

    async function loadPlans() {
      setPlansLoading(true);
      try {
        const response = await fetchApi(
          `/api/test-plans?companySlug=${encodeURIComponent(currentCompanySlug)}&applicationId=${encodeURIComponent(applicationId)}`,
          { cache: "no-store" },
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
  const caseStats = useMemo(() => computeRunCaseStats(cases), [cases]);
  const statsSnapshot = cases.length > 0 ? caseStats : {
    pass: form.pass,
    fail: form.fail,
    blocked: form.blocked,
    notRun: form.notRun,
  };
  const total = statsSnapshot.pass + statsSnapshot.fail + statsSnapshot.blocked + statsSnapshot.notRun;
  const passRate = total > 0 ? Math.round((statsSnapshot.pass / total) * 100) : 0;

  const resetState = useCallback(() => {
    setSubmitError(null);
    setForm(initialState);
    setCases([]);
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

  async function resolvePlanDetail(plan: TestPlanItem) {
    if (!resolvedCompanySlug || !selectedApplicationId) {
      throw new Error("Selecione a aplicação antes de carregar o plano.");
    }

    const response = await fetchApi(
      `/api/test-plans?companySlug=${encodeURIComponent(resolvedCompanySlug)}&applicationId=${encodeURIComponent(selectedApplicationId)}&planId=${encodeURIComponent(plan.id)}&source=${encodeURIComponent(plan.source)}`,
      { cache: "no-store" },
    );
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.plan) {
      throw new Error(
        (typeof payload?.error === "string" && payload.error) || "Não foi possível carregar o plano de teste.",
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
      setForm((current) => ({
        ...current,
        name: current.name || `${selectedApplication?.name || appMeta.label} — ${planDetail.title}`,
      }));
    } catch (error) {
      console.error(error);
      setSubmitError(error instanceof Error ? error.message : "Não foi possível aplicar o plano de teste.");
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
      const currentStats = cases.length > 0 ? caseStats : {
        pass: form.pass,
        fail: form.fail,
        blocked: form.blocked,
        notRun: form.notRun,
      };

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
          stats: currentStats,
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
              status: RUN_CASE_STATUS_VALUES[item.status],
              bug: item.bug ?? null,
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

      {open
        ? createPortal(
            <div
              className="fixed inset-0 z-100 flex items-center justify-center overflow-auto bg-black/55 p-4 backdrop-blur-sm"
              role="dialog"
              aria-modal="true"
              onClick={(event) => {
                if (event.target === event.currentTarget) closeModal();
              }}
            >
              <div className="flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-4xl border border-(--tc-border,#dfe5f1) bg-(--tc-surface,#fff) shadow-[0_40px_140px_rgba(15,23,42,0.38)]">
                <div className="bg-[linear-gradient(135deg,#011848_0%,#082457_38%,#4b0f2f_72%,#ef0001_100%)] px-6 py-4 text-white sm:px-8 sm:py-5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <p className="text-[12px] font-semibold uppercase tracking-[0.36em] text-white/80">Run manual</p>
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full border border-white/20 bg-white/14 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/90">
                          {resolvedCompanySlug ? `Empresa ${resolvedCompanySlug}` : "Contexto institucional"}
                        </span>
                        <span className="rounded-full border border-white/20 bg-white/14 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/90">
                          {selectedApplication?.name || appMeta.label}
                        </span>
                        {selectedApplication?.qaseProjectCode ? (
                          <span className="rounded-full border border-emerald-300/50 bg-emerald-400/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-100">
                            Qase {selectedApplication.qaseProjectCode}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={closeModal}
                      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-white transition hover:bg-white/20"
                      aria-label="Fechar modal"
                    >
                      <FiX className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
                    <div className="rounded-xl border border-white/20 bg-white/14 px-4 py-3 backdrop-blur">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-white/70">Aplicação</p>
                      <div className="mt-1 text-lg font-extrabold text-white">{selectedApplication?.name || appMeta.label}</div>
                    </div>
                    <div className="rounded-xl border border-white/20 bg-white/14 px-4 py-3 backdrop-blur">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-white/70">Total executado</p>
                      <div className="mt-1 text-lg font-extrabold text-white">{total} caso(s)</div>
                    </div>
                    <div className="rounded-xl border border-white/20 bg-white/14 px-4 py-3 backdrop-blur">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-white/70">Pass rate</p>
                      <div className="mt-1 text-lg font-extrabold text-white">{passRate}%</div>
                    </div>
                    <div className="rounded-xl border border-white/20 bg-white/14 px-4 py-3 backdrop-blur">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-white/70">Casos no quadro</p>
                      <div className="mt-1 text-lg font-extrabold text-white">{cases.length}</div>
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto bg-[linear-gradient(180deg,var(--tc-surface)_0%,var(--tc-surface-alt)_100%)] px-4 py-6 sm:px-6 sm:py-8">
                  <div className="space-y-6">
                    <div className="rounded-[28px] border border-(--tc-border,#dfe5f1) bg-white p-5 shadow-sm">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-700">
                          <FiLink2 className="h-4 w-4" />
                        </span>
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-emerald-600">Contexto da run</p>
                          <h3 className="mt-1 text-lg font-extrabold text-(--tc-text,#0b1a3c)">Aplicação e plano de teste</h3>
                        </div>
                      </div>

                      <div className="mt-5 space-y-4">
                        <label className="block space-y-2">
                          <span className="text-xs font-semibold uppercase tracking-[0.25em] text-(--tc-text-muted,#6b7280)">Aplicação</span>
                          {applications.length > 0 ? (
                            <select
                              aria-label="Selecionar aplicação"
                              className="w-full rounded-[20px] border border-(--tc-border,#dfe5f1) bg-(--tc-surface,#f8fafc) px-4 py-3 text-sm text-(--tc-text,#0f172a) outline-none transition focus:border-(--tc-accent,#ef0001) focus:ring-2 focus:ring-(--tc-accent,#ef0001)/20"
                              value={selectedApplicationId ?? ""}
                              onChange={(event) => {
                                const nextId = event.target.value;
                                setSelectedApplicationId(nextId);
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
                              aria-label="Selecionar aplicação"
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
                              ? `O plano pode puxar casos do projeto Qase ${selectedApplication.qaseProjectCode}.`
                              : `${appMeta.label} será usado como contexto desta run.`}
                          </span>
                        </label>

                        <div className="space-y-3 rounded-[22px] border border-(--tc-border,#dfe5f1) bg-(--tc-surface,#f8fafc) p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <span className="text-xs font-semibold uppercase tracking-[0.25em] text-(--tc-text-muted,#6b7280)">Plano de teste</span>
                              <p className="mt-1 text-sm text-(--tc-text-secondary,#4b5563)">
                                Aplique um plano para popular o quadro com casos. Sem plano, a run segue manual direta.
                              </p>
                            </div>
                            {selectedPlan ? (
                              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-700">
                                {selectedPlan.source === "qase" ? "Qase" : "Manual"} · {selectedPlan.casesCount} caso(s)
                              </span>
                            ) : null}
                          </div>

                          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_auto_auto]">
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
                                    : "Nenhum plano disponível"}
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

                    <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                      <div className="rounded-[28px] border border-(--tc-border,#dfe5f1) bg-white p-5 shadow-sm">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-700">
                            <FiLayers className="h-4 w-4" />
                          </span>
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-(--tc-accent,#ef0001)">Estrutura da run</p>
                            <h3 className="mt-1 text-lg font-extrabold text-(--tc-text,#0b1a3c)">Título e contexto</h3>
                          </div>
                        </div>

                        <div className="mt-5 grid gap-4">
                          <label className="space-y-2">
                            <span className="text-xs font-semibold uppercase tracking-[0.25em] text-(--tc-text-muted,#6b7280)">Título da run *</span>
                            <input
                              className="w-full rounded-[20px] border border-(--tc-border,#dfe5f1) bg-(--tc-surface,#f8fafc) px-4 py-3 text-sm text-(--tc-text,#0f172a) outline-none transition focus:border-(--tc-accent,#ef0001) focus:ring-2 focus:ring-(--tc-accent,#ef0001)/20"
                              data-testid="run-title"
                              value={form.name}
                              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                              placeholder="Ex: Run 1.9.0 - Regressão"
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
                            <span className="text-xs font-semibold uppercase tracking-[0.25em] text-(--tc-text-muted,#6b7280)">Slug opcional</span>
                            <input
                              className="w-full rounded-[20px] border border-(--tc-border,#dfe5f1) bg-(--tc-surface,#f8fafc) px-4 py-3 text-sm text-(--tc-text,#0f172a) outline-none transition focus:border-(--tc-accent,#ef0001) focus:ring-2 focus:ring-(--tc-accent,#ef0001)/20"
                              value={form.slug}
                              onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))}
                              placeholder="Deixe vazio para gerar automaticamente"
                            />
                          </label>
                        </div>
                      </div>

                      <div className="rounded-[28px] border border-(--tc-border,#dfe5f1) bg-white p-5 shadow-sm">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-(--tc-accent,#ef0001)">Atalho rápido</p>
                            <h3 className="mt-1 text-lg font-extrabold text-(--tc-text,#0b1a3c)">Totais da execução</h3>
                          </div>
                          <button
                            type="button"
                            data-testid="run-status-fail"
                            onClick={() => {
                              if (form.fail === 0) setForm((current) => ({ ...current, fail: 1 }));
                            }}
                            className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-rose-700"
                          >
                            Marcar falha
                          </button>
                        </div>

                        <div className="mt-5 grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-4">
                          {([
                            { key: "pass", label: "Aprovado", testId: "run-stat-pass", dotClass: "bg-emerald-500", borderClass: "border-emerald-500/30", labelClass: "text-emerald-600" },
                            { key: "fail", label: "Falha", testId: "run-stat-fail", dotClass: "bg-rose-500", borderClass: "border-rose-500/30", labelClass: "text-rose-600" },
                            { key: "blocked", label: "Bloqueado", testId: "run-stat-blocked", dotClass: "bg-amber-500", borderClass: "border-amber-500/30", labelClass: "text-amber-600" },
                            { key: "notRun", label: "Não executado", testId: "run-stat-not-run", dotClass: "bg-slate-400", borderClass: "border-slate-300", labelClass: "text-slate-500" },
                          ] as const).map((item) => (
                            <div key={item.key} className={`rounded-2xl border-2 ${item.borderClass} bg-(--tc-surface,#f8fafc) p-4`}>
                              <div className={`flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] ${item.labelClass}`}>
                                <span className={`inline-block h-2.5 w-2.5 rounded-full ${item.dotClass}`} />
                                {item.label}
                              </div>
                              <input
                                type="number"
                                min={0}
                                aria-label={`Total ${item.label}`}
                                data-testid={item.testId}
                                className="mt-2 w-full rounded-xl border border-(--tc-border,#dfe5f1) bg-white px-3 py-2 text-2xl font-black text-(--tc-text,#0b1a3c) outline-none transition focus:border-(--tc-accent,#ef0001) focus:ring-2 focus:ring-(--tc-accent,#ef0001)/20"
                                value={form[item.key]}
                                onChange={(event) => handleNumber(item.key, event.target.value)}
                              />
                            </div>
                          ))}
                        </div>

                        <p className="mt-4 text-sm text-(--tc-text-secondary,#4b5563)">
                          Quando houver casos no quadro abaixo, os totais do kanban passam a valer no salvamento.
                        </p>
                      </div>
                    </div>

                    <div className="rounded-[28px] border border-(--tc-border,#dfe5f1) bg-white p-5 shadow-sm">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-700">
                          <FiTrendingUp className="h-4 w-4" />
                        </span>
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-(--tc-accent,#ef0001)">Observações</p>
                          <h3 className="mt-1 text-lg font-extrabold text-(--tc-text,#0b1a3c)">Notas da execução</h3>
                        </div>
                      </div>
                      <textarea
                        className="mt-5 min-h-42.5 w-full rounded-3xl border border-(--tc-border,#dfe5f1) bg-(--tc-surface,#f8fafc) px-4 py-3 text-sm text-(--tc-text,#0f172a) outline-none transition focus:border-(--tc-accent,#ef0001) focus:ring-2 focus:ring-(--tc-accent,#ef0001)/20"
                        rows={6}
                        value={form.observations}
                        onChange={(event) => setForm((current) => ({ ...current, observations: event.target.value }))}
                        placeholder="Contexto da execução, riscos encontrados, links úteis e próximos passos."
                      />
                    </div>

                    <RunCasesBoard
                      cases={cases}
                      onCasesChange={setCases}
                      editable={true}
                      mode="manual"
                      showComposer={true}
                      subtitle="Monte a run visualmente. Você pode adicionar casos, aplicar plano, mover entre colunas e revisar o que vai persistir."
                    />
                  </div>
                </div>

                <div className="sticky bottom-0 z-10 border-t border-(--tc-border,#dfe5f1) bg-(--tc-surface,#fff)/96 px-7 py-5 backdrop-blur sm:px-10">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-h-6 text-base">
                      {submitError ? (
                        <span className="font-medium text-rose-600">{submitError}</span>
                      ) : (
                        <span className="text-(--tc-text-muted,#4b5563)">
                          Você pode salvar sem casos e complementar depois. Se houver quadro montado, ele já entra como fonte oficial dos totais.
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-4">
                      <button
                        type="button"
                        onClick={closeModal}
                        className="rounded-2xl border border-(--tc-border,#dfe5f1) px-6 py-3 text-base font-semibold text-(--tc-text,#0b1a3c) transition hover:border-slate-400 hover:text-slate-900"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={saving || !form.name.trim()}
                        data-testid="run-submit"
                        className="rounded-2xl bg-(--tc-accent,#ef0001) px-6 py-3 text-base font-semibold text-white shadow transition hover:brightness-110 disabled:opacity-60"
                      >
                        {saving ? "Salvando..." : <span data-testid="run-save">{redirectToRun ? "Salvar e abrir" : "Salvar run"}</span>}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
