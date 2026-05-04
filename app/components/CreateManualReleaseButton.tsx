"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { FiCheckCircle, FiEdit2, FiLayers, FiLink2, FiPlus, FiTrendingUp, FiX } from "react-icons/fi";
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
  description: string;
  precondition: string;
  postcondition: string;
  steps: string;
  expected: string;
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
  data?: string | null;
};

type TestPlanCaseRef = {
  id: string;
  title?: string | null;
  description?: string | null;
  preconditions?: string | null;
  postconditions?: string | null;
  severity?: string | null;
  link?: string | null;
  steps?: TestPlanCaseStep[];
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
  description: "",
  precondition: "",
  postcondition: "",
  steps: "",
  expected: "",
};

let autoIdCounter = 0;
function nextAutoId() {
  autoIdCounter += 1;
  return `MAN-${String(autoIdCounter).padStart(4, "0")}`;
}

const fallbackApps = ["SMART", "PRINT", "BOOKING", "CDS", "TRUST", "CIDADAO SMART", "GMT"];

const CASE_COLUMNS: CaseColumn[] = [
  { key: "pass", label: "Aprovado", ringClass: "border-emerald-300 dark:border-emerald-700", chipClass: "bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-900/50 dark:text-emerald-200 dark:border-emerald-700", toneClass: "from-emerald-50 to-(--tc-surface) dark:from-emerald-950/60 dark:to-(--tc-surface)" },
  { key: "fail", label: "Falha", ringClass: "border-rose-300 dark:border-rose-700", chipClass: "bg-rose-50 text-rose-800 border-rose-300 dark:bg-rose-900/50 dark:text-rose-200 dark:border-rose-700", toneClass: "from-rose-50 to-(--tc-surface) dark:from-rose-950/60 dark:to-(--tc-surface)" },
  { key: "blocked", label: "Bloqueado", ringClass: "border-amber-300 dark:border-amber-700", chipClass: "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-900/50 dark:text-amber-100 dark:border-amber-700", toneClass: "from-amber-50 to-(--tc-surface) dark:from-amber-950/60 dark:to-(--tc-surface)" },
  { key: "notRun", label: "Não executado", ringClass: "border-slate-300 dark:border-slate-600", chipClass: "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800/60 dark:text-slate-200 dark:border-slate-600", toneClass: "from-slate-50 to-(--tc-surface) dark:from-slate-900/60 dark:to-(--tc-surface)" },
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
  const normalizedCaseId = String(caseId ?? "").replace(/\D/g, "").trim();
  if (!normalizedProjectCode || !normalizedCaseId) return "";
  return `https://app.qase.io/case/${encodeURIComponent(normalizedProjectCode)}-${encodeURIComponent(normalizedCaseId)}`;
}

function formatSteps(steps?: TestPlanCaseStep[] | null): string {
  if (!steps || steps.length === 0) return "";
  return steps
    .map((s, i) => `${i + 1}. ${(s.action ?? "").trim()}`)
    .filter((line) => line.length > 3)
    .join("\n");
}

function formatExpected(steps?: TestPlanCaseStep[] | null): string {
  if (!steps || steps.length === 0) return "";
  return steps
    .map((s, i) => {
      const er = (s.expectedResult ?? "").trim();
      return er ? `${i + 1}. ${er}` : "";
    })
    .filter(Boolean)
    .join("\n");
}

function mergePlanCasesIntoDrafts(plan: TestPlanItem, currentCases: ManualCaseDraft[]) {
  const currentCasesById = new Map(currentCases.map((item) => [item.id, item]));
  const planCases = Array.isArray(plan.cases) ? plan.cases : [];

  return planCases.map((item) => {
    const current = currentCasesById.get(item.id);
    return {
      id: item.id,
      title: current?.title || item.title?.trim() || `Caso ${item.id}`,
      link: current?.link || item.link?.trim() || buildQaseCaseLink(plan.projectCode, item.id),
      status: current?.status || "notRun",
      description: current?.description || item.description?.trim() || "",
      precondition: current?.precondition || item.preconditions?.trim() || "",
      postcondition: current?.postcondition || item.postconditions?.trim() || "",
      steps: current?.steps || formatSteps(item.steps) || "",
      expected: current?.expected || formatExpected(item.steps) || "",
    } satisfies ManualCaseDraft;
  });
}

export function CreateManualReleaseButton({
  companySlug,
  redirectToRun = true,
  manualOnly = false,
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
  const [columnOrder, setColumnOrder] = useState<CaseStatus[]>(["pass", "fail", "blocked", "notRun"]);
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [draggingCardFrom, setDraggingCardFrom] = useState<CaseStatus | null>(null);
  const [draggingColumnKey, setDraggingColumnKey] = useState<CaseStatus | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<CaseStatus | null>(null);
  const [form, setForm] = useState<NewManualRelease>(initialState);
  const [cases, setCases] = useState<ManualCaseDraft[]>([]);
  const [caseDraft, setCaseDraft] = useState<ManualCaseDraft>({ ...initialCaseDraft });
  const [applications, setApplications] = useState<ApplicationOption[]>([]);
  const [selectedApplicationId, setSelectedApplicationId] = useState<string | null>(null);
  const [plans, setPlans] = useState<TestPlanItem[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [selectedPlanKey, setSelectedPlanKey] = useState("");
  const [planActionLoading, setPlanActionLoading] = useState(false);
  const [runMode, setRunMode] = useState<"integration" | "manual">("manual");
  const [editingCase, setEditingCase] = useState<ManualCaseDraft | null>(null);

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

  const caseStats = useMemo(() => ({
    pass: cases.filter((c) => c.status === "pass").length,
    fail: cases.filter((c) => c.status === "fail").length,
    blocked: cases.filter((c) => c.status === "blocked").length,
    notRun: cases.filter((c) => c.status === "notRun").length,
  }), [cases]);

  const total = runMode === "integration"
    ? caseStats.pass + caseStats.fail + caseStats.blocked + caseStats.notRun
    : form.pass + form.fail + form.blocked + form.notRun;
  const passRate = total > 0
    ? Math.round(((runMode === "integration" ? caseStats.pass : form.pass) / total) * 100)
    : 0;

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
    setRunMode("manual");
    setEditingCase(null);
    setColumnOrder(["pass", "fail", "blocked", "notRun"]);
    setDraggingCardId(null);
    setDraggingCardFrom(null);
    setDraggingColumnKey(null);
    setDragOverColumn(null);
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
    setCaseDraft({ ...initialCaseDraft, id: nextAutoId() });
    setRunMode("manual");
    setOpen(true);
  }

  function handleNumber(field: keyof Pick<NewManualRelease, "pass" | "fail" | "blocked" | "notRun">, value: string) {
    setForm((current) => ({ ...current, [field]: coercePositiveInteger(value) }));
  }

  function handleCaseDraftChange<K extends keyof ManualCaseDraft>(field: K, value: ManualCaseDraft[K]) {
    setCaseDraft((current) => ({ ...current, [field]: value }));
  }

  function handleAddCase() {
    const trimmedId = caseDraft.id.trim() || nextAutoId();
    const trimmedTitle = caseDraft.title.trim();
    if (!trimmedId || !trimmedTitle) return;

    setCases((current) => {
      const next = current.filter((item) => item.id !== trimmedId);
      next.push({
        id: trimmedId,
        title: trimmedTitle,
        link: caseDraft.link.trim(),
        status: caseDraft.status,
        description: caseDraft.description.trim(),
        precondition: caseDraft.precondition.trim(),
        postcondition: caseDraft.postcondition.trim(),
        steps: caseDraft.steps.trim(),
        expected: caseDraft.expected.trim(),
      });
      return next;
    });
    setCaseDraft({ ...initialCaseDraft, id: nextAutoId(), status: caseDraft.status });
  }

  function handleSaveEditingCase() {
    if (!editingCase) return;
    const trimmedId = editingCase.id.trim();
    const trimmedTitle = editingCase.title.trim();
    if (!trimmedId || !trimmedTitle) return;
    setCases((current) =>
      current.map((item) =>
        item.id === trimmedId
          ? { ...editingCase, id: trimmedId, title: trimmedTitle }
          : item,
      ),
    );
    setEditingCase(null);
  }

  function handleRemoveCase(id: string) {
    setCases((current) => current.filter((item) => item.id !== id));
  }

  function handleCardDragStart(e: React.DragEvent, id: string, fromColumn: CaseStatus) {
    setDraggingCardId(id);
    setDraggingCardFrom(fromColumn);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("cardId", id);
    e.dataTransfer.setData("fromColumn", fromColumn);
  }

  function handleCardDrop(e: React.DragEvent, toColumn: CaseStatus) {
    e.preventDefault();
    const id = e.dataTransfer.getData("cardId");
    if (!id) return;
    setCases((current) =>
      current.map((item) => (item.id === id ? { ...item, status: toColumn } : item)),
    );
    setDraggingCardId(null);
    setDraggingCardFrom(null);
    setDragOverColumn(null);
  }

  function handleColumnDragStart(e: React.DragEvent, key: CaseStatus) {
    setDraggingColumnKey(key);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("columnKey", key);
  }

  function handleColumnDrop(e: React.DragEvent, targetKey: CaseStatus) {
    e.preventDefault();
    const sourceKey = e.dataTransfer.getData("columnKey");
    if (!sourceKey || sourceKey === targetKey) {
      setDraggingColumnKey(null);
      setDragOverColumn(null);
      return;
    }
    setColumnOrder((current) => {
      const next = [...current];
      const fromIdx = next.indexOf(sourceKey as CaseStatus);
      const toIdx = next.indexOf(targetKey);
      if (fromIdx === -1 || toIdx === -1) return current;
      next.splice(fromIdx, 1);
      next.splice(toIdx, 0, sourceKey as CaseStatus);
      return next;
    });
    setDraggingColumnKey(null);
    setDragOverColumn(null);
  }

  async function resolvePlanDetail(plan: TestPlanItem) {
    if (!resolvedCompanySlug || !selectedApplicationId) {
      throw new Error("Selecione a aplicação antes de carregar o plano.");
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
      setSubmitError(
        error instanceof Error ? error.message : "Não foi possível aplicar o plano de teste.",
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
          stats: runMode === "integration" ? {
            pass: caseStats.pass,
            fail: caseStats.fail,
            blocked: caseStats.blocked,
            notRun: caseStats.notRun,
          } : {
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

      {open ? createPortal(
        <div
          className="fixed inset-0 z-100 flex items-center justify-center overflow-auto bg-black/55 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeModal();
            }
          }}
        >
          <div className="flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-4xl border border-(--tc-border,#dfe5f1) bg-(--tc-surface,#fff) shadow-[0_40px_140px_rgba(15,23,42,0.38)]">
            <div className="bg-[linear-gradient(135deg,#011848_0%,#082457_38%,#4b0f2f_72%,#ef0001_100%)] px-6 py-4 text-white sm:px-8 sm:py-5">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
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

              <div className="mt-3 grid gap-3 grid-cols-[repeat(auto-fit,minmax(150px,1fr))]">
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
                  {/* ── Seletor de modo ── */}
                  {!manualOnly ? (
                    <div className="flex items-center gap-2 rounded-full border border-(--tc-border,#dfe5f1) bg-(--tc-surface,#f8fafc) p-1">
                      <button
                        type="button"
                        onClick={() => setRunMode("integration")}
                        className={`flex-1 rounded-full px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.22em] transition ${
                          runMode === "integration"
                            ? "bg-emerald-600 text-white shadow"
                            : "text-(--tc-text-muted,#6b7280) hover:text-(--tc-text,#0b1a3c)"
                        }`}
                      >
                        Integração
                      </button>
                      <button
                        type="button"
                        onClick={() => setRunMode("manual")}
                        className={`flex-1 rounded-full px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.22em] transition ${
                          runMode === "manual"
                            ? "bg-(--tc-accent,#ef0001) text-white shadow"
                            : "text-(--tc-text-muted,#6b7280) hover:text-(--tc-text,#0b1a3c)"
                        }`}
                      >
                        Manual
                      </button>
                    </div>
                  ) : null}

                  {/* ── Integração Qase / Plano de teste ── */}
                  {!manualOnly && runMode === "integration" && (<>
                  <div className="rounded-[28px] border border-(--tc-border,#dfe5f1) bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-700">
                        <FiLink2 className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-emerald-600">Integração</p>
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
                            ? `Conectado ao projeto Qase ${selectedApplication.qaseProjectCode}`
                            : `${appMeta.label} sera usado como contexto desta run.`}
                        </span>
                      </label>

                      <div className="space-y-3 rounded-[22px] border border-(--tc-border,#dfe5f1) bg-(--tc-surface,#f8fafc) p-4">
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

                  {/* ── Título (auto-preenchido do plano) ── */}
                  <div className="rounded-[28px] border border-(--tc-border,#dfe5f1) bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-700">
                        <FiLayers className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-emerald-600">Preenchido automaticamente</p>
                        <h3 className="mt-1 text-lg font-extrabold text-(--tc-text,#0b1a3c)">Título da run</h3>
                      </div>
                    </div>
                    <div className="mt-5">
                      <label className="space-y-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.25em] text-(--tc-text-muted,#6b7280)">Título da run *</span>
                        <input
                          className="w-full rounded-[20px] border border-(--tc-border,#dfe5f1) bg-(--tc-surface,#f8fafc) px-4 py-3 text-sm text-(--tc-text,#0f172a) outline-none transition focus:border-(--tc-accent,#ef0001) focus:ring-2 focus:ring-(--tc-accent,#ef0001)/20"
                          data-testid="run-title"
                          value={form.name}
                          onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                          placeholder="Será preenchido ao aplicar o plano"
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
                    </div>
                    <p className="mt-3 text-xs text-(--tc-text-muted,#6b7280)">
                      Preenchido automaticamente a partir do plano. Você pode editar se necessário.
                    </p>
                  </div>

                  {/* ── Resultados calculados do plano ── */}
                  {cases.length > 0 && (
                    <div className="rounded-[28px] border border-emerald-300 bg-emerald-50 p-5 shadow-sm dark:border-emerald-800 dark:bg-emerald-950/40">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-emerald-600 dark:text-emerald-400">Calculado automaticamente</p>
                      <h3 className="mt-1 text-lg font-extrabold text-(--tc-text,#0b1a3c)">Resultados do plano</h3>
                      <div className="mt-4 grid gap-3 grid-cols-[repeat(auto-fit,minmax(100px,1fr))]">
                        {([
                          { label: "Aprovado", value: caseStats.pass, dotClass: "bg-emerald-500", labelClass: "text-emerald-600 dark:text-emerald-400" },
                          { label: "Falha", value: caseStats.fail, dotClass: "bg-rose-500", labelClass: "text-rose-600 dark:text-rose-400" },
                          { label: "Bloqueado", value: caseStats.blocked, dotClass: "bg-amber-500", labelClass: "text-amber-600 dark:text-amber-400" },
                          { label: "N/Executado", value: caseStats.notRun, dotClass: "bg-slate-400", labelClass: "text-slate-500 dark:text-slate-400" },
                        ]).map((s) => (
                          <div key={s.label} className="flex items-center gap-2 rounded-xl border border-(--tc-border,#dfe5f1) bg-(--tc-surface,#fff) px-3 py-2">
                            <span className={`inline-block h-2.5 w-2.5 rounded-full ${s.dotClass}`} />
                            <span className={`text-xs font-semibold uppercase tracking-[0.2em] ${s.labelClass}`}>{s.label}</span>
                            <span className="ml-auto text-lg font-black text-(--tc-text,#0b1a3c)">{s.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  </>)}

                  {runMode === "manual" && (<>
                  {/* ── Dados da run (obrigatório) ── */}
                  <div className="rounded-[28px] border border-(--tc-border,#dfe5f1) bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-700">
                        <FiLayers className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-(--tc-accent,#ef0001)">Obrigatório</p>
                        <h3 className="mt-1 text-lg font-extrabold text-(--tc-text,#0b1a3c)">Dados da run</h3>
                      </div>
                    </div>
                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                      <label className="space-y-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.25em] text-(--tc-text-muted,#6b7280)">Título da run *</span>
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
                              const nextApp = applications.find((a) => a.id === nextId) ?? null;
                              if (nextApp) {
                                setForm((current) => ({ ...current, app: nextApp.slug || nextApp.name }));
                              }
                            }}
                          >
                            {applications.map((application) => (
                              <option key={application.id} value={application.id}>
                                {application.name}
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
                      </label>
                    </div>
                  </div>

                  <div className="rounded-[28px] border border-(--tc-border,#dfe5f1) bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-(--tc-accent,#ef0001)">Totais da execução</p>
                        <h3 className="mt-1 text-lg font-extrabold text-(--tc-text,#0b1a3c)">Preencha os resultados</h3>
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

                    <div className="mt-5 grid gap-4 grid-cols-[repeat(auto-fit,minmax(140px,1fr))]">
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

                    <div className="mt-4 grid gap-3 grid-cols-[repeat(auto-fit,minmax(140px,1fr))]">
                      <div className="flex items-center justify-between rounded-xl border border-(--tc-border,#dfe5f1) bg-(--tc-surface,#f8fafc) px-4 py-3">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-(--tc-text-muted,#6b7280)">Total</span>
                        <span className="text-xl font-black text-(--tc-text,#0b1a3c)">{total}</span>
                      </div>
                      <div className="flex items-center justify-between rounded-xl border border-(--tc-border,#dfe5f1) bg-(--tc-surface,#f8fafc) px-4 py-3">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-(--tc-text-muted,#6b7280)">Pass rate</span>
                        <span className="text-xl font-black text-(--tc-text,#0b1a3c)">{passRate}%</span>
                      </div>
                      <div className="flex items-center justify-between rounded-xl border border-(--tc-border,#dfe5f1) bg-(--tc-surface,#f8fafc) px-4 py-3">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-(--tc-text-muted,#6b7280)">Casos</span>
                        <span className="text-xl font-black text-(--tc-text,#0b1a3c)">{cases.length}</span>
                      </div>
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

                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                      <label className="space-y-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.25em] text-(--tc-text-muted,#6b7280)">
                          ID do caso (auto)
                        </span>
                        <input
                          type="text"
                          value={caseDraft.id}
                          onChange={(event) => handleCaseDraftChange("id", event.target.value)}
                          className="w-full rounded-[20px] border border-(--tc-border,#dfe5f1) bg-(--tc-surface,#f8fafc) px-4 py-3 text-sm text-(--tc-text,#0f172a) outline-none transition focus:border-(--tc-accent,#ef0001) focus:ring-2 focus:ring-(--tc-accent,#ef0001)/20"
                          placeholder="Deixe vazio para gerar automaticamente"
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
                      <label className="space-y-2 md:col-span-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.25em] text-(--tc-text-muted,#6b7280)">Título *</span>
                        <input
                          type="text"
                          value={caseDraft.title}
                          onChange={(event) => handleCaseDraftChange("title", event.target.value)}
                          className="w-full rounded-[20px] border border-(--tc-border,#dfe5f1) bg-(--tc-surface,#f8fafc) px-4 py-3 text-sm text-(--tc-text,#0f172a) outline-none transition focus:border-(--tc-accent,#ef0001) focus:ring-2 focus:ring-(--tc-accent,#ef0001)/20"
                          placeholder="Nome do caso executado"
                        />
                      </label>
                      <label className="space-y-2 md:col-span-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.25em] text-(--tc-text-muted,#6b7280)">
                          Link opcional (URL externa)
                        </span>
                        <div className="relative">
                          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                            <FiLink2 className="h-4 w-4" />
                          </span>
                          <input
                            type="url"
                            value={caseDraft.link}
                            onChange={(event) => handleCaseDraftChange("link", event.target.value)}
                            className="w-full rounded-[20px] border border-(--tc-border,#dfe5f1) bg-(--tc-surface,#f8fafc) py-3 pr-4 pl-11 text-sm text-(--tc-text,#0f172a) outline-none transition focus:border-(--tc-accent,#ef0001) focus:ring-2 focus:ring-(--tc-accent,#ef0001)/20"
                            placeholder="https://link-externo.com/..."
                          />
                        </div>
                      </label>
                    </div>

                    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="text-sm text-(--tc-text-secondary,#4b5563)">
                        Título obrigatório. ID gerado automaticamente se vazio.
                      </div>
                      <button
                        type="button"
                        onClick={handleAddCase}
                        className="rounded-full bg-(--tc-accent,#ef0001) px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-white shadow transition hover:brightness-110 disabled:opacity-60"
                        disabled={!caseDraft.title.trim()}
                      >
                        Adicionar caso
                      </button>
                    </div>
                  </div>
                  </>)}

                  <div className="overflow-hidden rounded-[28px] border border-(--tc-border,#dfe5f1) bg-white shadow-sm">
                <div className="flex flex-col gap-2 px-5 pt-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-(--tc-accent,#ef0001)">Quadro da run</p>
                    <h3 className="mt-1 text-lg font-extrabold text-(--tc-text,#0b1a3c)">Kanban dos casos executados</h3>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-slate-700">
                    <FiCheckCircle className="h-3.5 w-3.5" />
                    {cases.length} caso(s)
                  </div>
                </div>

                <div className="mt-4 grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] divide-x divide-(--tc-border,#dfe5f1)">
                  {columnOrder.map((colKey) => {
                    const column = CASE_COLUMNS.find((c) => c.key === colKey)!;
                    const columnCases = groupedCases[column.key];
                    const isColumnDragOver = dragOverColumn === column.key && draggingColumnKey !== null && draggingColumnKey !== column.key;
                    const isCardDragOver = dragOverColumn === column.key && draggingCardId !== null;
                    return (
                      <div
                        key={column.key}
                        draggable
                        onDragStart={(e) => handleColumnDragStart(e, column.key)}
                        onDragOver={(e) => {
                          e.preventDefault();
                          setDragOverColumn(column.key);
                        }}
                        onDragLeave={() => setDragOverColumn(null)}
                        onDrop={(e) => {
                          if (draggingColumnKey) handleColumnDrop(e, column.key);
                          else handleCardDrop(e, column.key);
                        }}
                        onDragEnd={() => { setDraggingColumnKey(null); setDragOverColumn(null); }}
                        className={[
                          "bg-linear-to-b p-4 transition-all",
                          column.toneClass,
                          draggingColumnKey === column.key ? "opacity-40 scale-[0.97]" : "",
                          isColumnDragOver ? "ring-inset ring-2 ring-(--tc-accent,#ef0001) brightness-95" : "",
                          isCardDragOver ? "ring-inset ring-2 ring-slate-400 brightness-95" : "",
                        ].filter(Boolean).join(" ")}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div
                            className={`cursor-grab rounded-full border px-4 py-1.5 text-sm font-semibold uppercase tracking-[0.2em] select-none ${column.chipClass}`}
                            title="Segure para mover a coluna"
                          >
                            {column.label}
                          </div>
                          <span className="text-base font-extrabold text-(--tc-text,#0b1a3c)">{columnCases.length}</span>
                        </div>

                        <div className="mt-4 max-h-96 space-y-2 overflow-y-auto pr-1">
                          {columnCases.length === 0 ? (
                            <div className={[
                              "rounded-[20px] border border-dashed px-4 py-7 text-base text-(--tc-text-muted,#4b5563) transition-colors",
                              isCardDragOver
                                ? "border-(--tc-accent,#ef0001) bg-(--tc-accent,#ef0001)/5"
                                : "border-(--tc-border,#dfe5f1) bg-(--tc-surface-alt,#f8fafc)",
                            ].join(" ")}>
                              {isCardDragOver ? "Solte aqui ↓" : "Nenhum caso nesta coluna."}
                            </div>
                          ) : (
                            columnCases.map((item) => (
                              <article
                                key={`${column.key}-${item.id}`}
                                draggable
                                onDragStart={(e) => { e.stopPropagation(); handleCardDragStart(e, item.id, column.key); }}
                                onDragEnd={() => { setDraggingCardId(null); setDraggingCardFrom(null); }}
                                onClick={() => setEditingCase({ ...item })}
                                className={[
                                  "relative cursor-pointer rounded-[22px] border border-(--tc-border,#dfe5f1) bg-(--tc-surface,#fff) p-5 shadow-[0_14px_34px_rgba(15,23,42,0.08)] transition-all hover:border-(--tc-accent,#ef0001)/30 hover:shadow-md",
                                  draggingCardId === item.id ? "opacity-40" : "",
                                ].join(" ")}
                              >
                                <div className="pr-16">
                                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-(--tc-text-muted,#4b5563)">
                                    Caso {item.id}
                                  </p>
                                  <p className="mt-2 text-base font-semibold leading-6 text-(--tc-text,#0b1a3c)">{item.title}</p>
                                  {item.description ? (
                                    <p className="mt-1 line-clamp-2 text-xs text-(--tc-text-muted,#4b5563)">{item.description}</p>
                                  ) : null}
                                  {item.link ? (
                                    <a
                                      href={item.link}
                                      target="_blank"
                                      rel="noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-(--tc-accent,#ef0001)"
                                    >
                                      <FiLink2 className="h-3.5 w-3.5" />
                                      Abrir link
                                    </a>
                                  ) : null}
                                </div>
                                <div className="absolute top-3 right-3 flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setEditingCase({ ...item }); }}
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-(--tc-border,#dfe5f1) bg-(--tc-surface-alt,#f8fafc) text-(--tc-text-muted,#4b5563) transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600"
                                    aria-label={`Editar caso ${item.id}`}
                                    title="Editar caso"
                                  >
                                    <FiEdit2 className="h-3 w-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); handleRemoveCase(item.id); }}
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-(--tc-border,#dfe5f1) bg-(--tc-surface-alt,#f8fafc) text-(--tc-text-muted,#4b5563) transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600"
                                    aria-label={`Remover caso ${item.id}`}
                                    title="Remover caso"
                                  >
                                    <FiX className="h-3 w-3" />
                                  </button>
                                </div>
                              </article>
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            </div>

            <div className="sticky bottom-0 z-10 border-t border-(--tc-border,#dfe5f1) bg-(--tc-surface,#fff)/96 px-7 py-5 backdrop-blur sm:px-10">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-h-6 text-base">
                  {submitError ? (
                    <span className="font-medium text-rose-600">{submitError}</span>
                  ) : (
                    <span className="text-(--tc-text-muted,#4b5563)">Você pode salvar sem casos e complementar depois.</span>
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
      ) : null}

      {/* ── Case editing modal ── */}
      {editingCase
        ? createPortal(
            <div
              className="fixed inset-0 z-110 flex items-center justify-center overflow-auto bg-black/60 p-4 backdrop-blur-sm"
              role="dialog"
              aria-modal="true"
              onClick={(e) => { if (e.target === e.currentTarget) setEditingCase(null); }}
            >
              <div className="w-full max-w-2xl rounded-[28px] border border-(--tc-border,#dfe5f1) bg-(--tc-surface,#fff) shadow-[0_40px_140px_rgba(15,23,42,0.38)]">
                {/* Header */}
                <div className="flex items-center justify-between gap-4 border-b border-(--tc-border,#dfe5f1) px-6 py-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-(--tc-accent,#ef0001)">Caso {editingCase.id}</p>
                    <h3 className="mt-1 text-lg font-extrabold text-(--tc-text,#0b1a3c)">Detalhes do caso</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingCase(null)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-(--tc-border,#dfe5f1) text-(--tc-text-muted,#4b5563) transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600"
                    aria-label="Fechar detalhes"
                    title="Fechar"
                  >
                    <FiX className="h-4 w-4" />
                  </button>
                </div>

                {/* Body */}
                <div className="max-h-[calc(100dvh-12rem)] space-y-4 overflow-y-auto px-6 py-5">
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.25em] text-(--tc-text-muted,#6b7280)">ID</span>
                      <input
                        type="text"
                        value={editingCase.id}
                        readOnly
                        className="w-full rounded-2xl border border-(--tc-border,#dfe5f1) bg-slate-50 px-4 py-2.5 text-sm text-(--tc-text-muted,#6b7280)"
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.25em] text-(--tc-text-muted,#6b7280)">Status</span>
                      <select
                        aria-label="Status do caso"
                        value={editingCase.status}
                        onChange={(e) => setEditingCase((c) => c ? { ...c, status: e.target.value as CaseStatus } : c)}
                        className="w-full rounded-2xl border border-(--tc-border,#dfe5f1) bg-(--tc-surface,#f8fafc) px-4 py-2.5 text-sm text-(--tc-text,#0f172a) outline-none transition focus:border-(--tc-accent,#ef0001) focus:ring-2 focus:ring-(--tc-accent,#ef0001)/20"
                      >
                        {CASE_COLUMNS.map((col) => (
                          <option key={col.key} value={col.key}>{col.label}</option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <label className="block space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.25em] text-(--tc-text-muted,#6b7280)">Título *</span>
                    <input
                      type="text"
                      value={editingCase.title}
                      onChange={(e) => setEditingCase((c) => c ? { ...c, title: e.target.value } : c)}
                      className="w-full rounded-2xl border border-(--tc-border,#dfe5f1) bg-(--tc-surface,#f8fafc) px-4 py-2.5 text-sm text-(--tc-text,#0f172a) outline-none transition focus:border-(--tc-accent,#ef0001) focus:ring-2 focus:ring-(--tc-accent,#ef0001)/20"
                    />
                  </label>

                  <label className="block space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.25em] text-(--tc-text-muted,#6b7280)">Descrição</span>
                    <textarea
                      rows={3}
                      value={editingCase.description}
                      onChange={(e) => setEditingCase((c) => c ? { ...c, description: e.target.value } : c)}
                      className="w-full rounded-2xl border border-(--tc-border,#dfe5f1) bg-(--tc-surface,#f8fafc) px-4 py-2.5 text-sm text-(--tc-text,#0f172a) outline-none transition focus:border-(--tc-accent,#ef0001) focus:ring-2 focus:ring-(--tc-accent,#ef0001)/20"
                      placeholder="O que este caso válida?"
                    />
                  </label>

                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.25em] text-(--tc-text-muted,#6b7280)">Pre-condicao</span>
                      <textarea
                        rows={2}
                        value={editingCase.precondition}
                        onChange={(e) => setEditingCase((c) => c ? { ...c, precondition: e.target.value } : c)}
                        className="w-full rounded-2xl border border-(--tc-border,#dfe5f1) bg-(--tc-surface,#f8fafc) px-4 py-2.5 text-sm text-(--tc-text,#0f172a) outline-none transition focus:border-(--tc-accent,#ef0001) focus:ring-2 focus:ring-(--tc-accent,#ef0001)/20"
                        placeholder="Condicoes necessarias antes da execução"
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.25em] text-(--tc-text-muted,#6b7280)">Pos-condicao</span>
                      <textarea
                        rows={2}
                        value={editingCase.postcondition}
                        onChange={(e) => setEditingCase((c) => c ? { ...c, postcondition: e.target.value } : c)}
                        className="w-full rounded-2xl border border-(--tc-border,#dfe5f1) bg-(--tc-surface,#f8fafc) px-4 py-2.5 text-sm text-(--tc-text,#0f172a) outline-none transition focus:border-(--tc-accent,#ef0001) focus:ring-2 focus:ring-(--tc-accent,#ef0001)/20"
                        placeholder="Estado esperado apos a execução"
                      />
                    </label>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.25em] text-(--tc-text-muted,#6b7280)">Passos</span>
                      <textarea
                        rows={6}
                        value={editingCase.steps}
                        onChange={(e) => setEditingCase((c) => c ? { ...c, steps: e.target.value } : c)}
                        className="w-full rounded-2xl border border-(--tc-border,#dfe5f1) bg-(--tc-surface,#f8fafc) px-4 py-2.5 text-sm text-(--tc-text,#0f172a) outline-none transition focus:border-(--tc-accent,#ef0001) focus:ring-2 focus:ring-(--tc-accent,#ef0001)/20"
                        placeholder={"1. Acessar a tela X\n2. Clicar em Y\n3. Preencher campo Z"}
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.25em] text-(--tc-text-muted,#6b7280)">Resultado esperado</span>
                      <textarea
                        rows={6}
                        value={editingCase.expected}
                        onChange={(e) => setEditingCase((c) => c ? { ...c, expected: e.target.value } : c)}
                        className="w-full rounded-2xl border border-(--tc-border,#dfe5f1) bg-(--tc-surface,#f8fafc) px-4 py-2.5 text-sm text-(--tc-text,#0f172a) outline-none transition focus:border-(--tc-accent,#ef0001) focus:ring-2 focus:ring-(--tc-accent,#ef0001)/20"
                        placeholder={"1. Sistema exibe X\n2. Mensagem Y aparece\n3. Campo Z validado"}
                      />
                    </label>
                  </div>

                  <label className="block space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.25em] text-(--tc-text-muted,#6b7280)">
                      {runMode === "integration" ? "Link Qase" : "Link externo (opcional)"}
                    </span>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                        <FiLink2 className="h-4 w-4" />
                      </span>
                      <input
                        type="url"
                        value={editingCase.link}
                        onChange={(e) => setEditingCase((c) => c ? { ...c, link: e.target.value } : c)}
                        readOnly={runMode === "integration" && !!editingCase.link}
                        className={[
                          "w-full rounded-2xl border border-(--tc-border,#dfe5f1) py-2.5 pr-4 pl-11 text-sm outline-none transition focus:border-(--tc-accent,#ef0001) focus:ring-2 focus:ring-(--tc-accent,#ef0001)/20",
                          runMode === "integration" && editingCase.link
                            ? "bg-slate-50 text-(--tc-text-muted,#6b7280)"
                            : "bg-(--tc-surface,#f8fafc) text-(--tc-text,#0f172a)",
                        ].join(" ")}
                        placeholder={runMode === "integration" ? "Link Qase gerado automaticamente" : "https://..."}
                      />
                    </div>
                    {runMode === "integration" && editingCase.link ? (
                      <a href={editingCase.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-semibold text-(--tc-accent,#ef0001) hover:underline">
                        <FiLink2 className="h-3 w-3" />
                        Abrir no Qase
                      </a>
                    ) : null}
                  </label>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 border-t border-(--tc-border,#dfe5f1) px-6 py-4">
                  <button
                    type="button"
                    onClick={() => setEditingCase(null)}
                    className="rounded-2xl border border-(--tc-border,#dfe5f1) px-5 py-2.5 text-sm font-semibold text-(--tc-text,#0b1a3c) transition hover:border-slate-400"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveEditingCase}
                    disabled={!editingCase.title.trim()}
                    className="rounded-2xl bg-(--tc-accent,#ef0001) px-5 py-2.5 text-sm font-semibold text-white shadow transition hover:brightness-110 disabled:opacity-60"
                  >
                    Salvar alterações
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
