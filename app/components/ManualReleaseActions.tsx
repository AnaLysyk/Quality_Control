"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FiEdit3, FiLayers, FiX } from "react-icons/fi";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchApi } from "@/lib/api";
import { useAuthUser } from "@/hooks/useAuthUser";
import { useClientContext } from "@/context/ClientContext";

type ManualReleaseActionsProps = {
  slug: string;
  status?: string;
  gateStatus?: "approved" | "warning" | "failed" | "no_data";
};

type ResponsibleOption = { userId: string; label: string; name: string; email?: string | null };
type ApplicationOption = { id: string; name: string; slug: string; companySlug?: string | null; qaseProjectCode?: string | null };
type TestPlanSource = "manual" | "qase";
type TestPlanItem = { id: string; title: string; casesCount: number; source: TestPlanSource; projectCode?: string | null; cases?: { id: string; title?: string | null }[] };
type ManualCaseItem = { id: string; title?: string; link?: string; status?: string; bug?: string | null; fromApi?: boolean };
type ManualReleaseDetailsResponse = {
  title?: string | null;
  name?: string | null;
  app?: string | null;
  qaseProject?: string | null;
  clientSlug?: string | null;
  testPlanId?: string | null;
  testPlanSource?: TestPlanSource | null;
  assignedToUserId?: string | null;
  assignedToName?: string | null;
  createdByUserId?: string | null;
  createdByName?: string | null;
  availableResponsibles?: ResponsibleOption[];
  message?: string;
};

function isFinalStatus(status?: string) {
  const s = (status ?? "").trim().toUpperCase();
  return s === "FINALIZADA" || s === "FINALIZED" || s === "FINALIZADO";
}

function normalizeKey(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function makePlanKey(source: TestPlanSource, id: string) {
  return `${source}:${id}`;
}

function buildQaseCaseLink(projectCode: string | null | undefined, caseId: string) {
  const code = String(projectCode ?? "").trim();
  const id = String(caseId ?? "").trim();
  return code && id ? `https://app.qase.io/case/${encodeURIComponent(code)}/${encodeURIComponent(id)}` : "";
}

function mergePlanCases(plan: TestPlanItem, currentCases: ManualCaseItem[]) {
  const existing = new Map(currentCases.map((item) => [String(item.id), item]));
  const cases = Array.isArray(plan.cases) ? plan.cases : [];
  return cases.map((item) => {
    const current = existing.get(String(item.id));
    return {
      id: String(item.id),
      title: current?.title || item.title?.trim() || `Caso ${item.id}`,
      link: current?.link || buildQaseCaseLink(plan.projectCode, String(item.id)),
      status: current?.status || "NAO_EXECUTADO",
      bug: current?.bug ?? null,
      fromApi: false,
    } satisfies ManualCaseItem;
  });
}

async function loadPlanOptions(companySlug: string, applicationId: string) {
  const res = await fetchApi(`/api/test-plans?companySlug=${encodeURIComponent(companySlug)}&applicationId=${encodeURIComponent(applicationId)}`, { cache: "no-store" });
  const payload = await res.json().catch(() => null);
  if (!res.ok) throw new Error((typeof payload?.error === "string" && payload.error) || "Nao foi possivel carregar os planos.");
  return Array.isArray(payload?.plans) ? (payload.plans as TestPlanItem[]) : [];
}

export default function ManualReleaseActions({ slug, status, gateStatus }: ManualReleaseActionsProps) {
  const { user, loading: authLoading } = useAuthUser();
  const { activeClientSlug } = useClientContext();
  const router = useRouter();
  const role = typeof user?.role === "string" ? user.role.toLowerCase() : "";
  const canEdit = Boolean(user?.isGlobalAdmin || role === "admin" || role === "company");
  const finalized = isFinalStatus(status);
  const gateBlocked = gateStatus === "failed";

  const [loading, setLoading] = useState(false);
  const [responsibleOpen, setResponsibleOpen] = useState(false);
  const [responsibleLoading, setResponsibleLoading] = useState(false);
  const [responsibleSaving, setResponsibleSaving] = useState(false);
  const [responsibleError, setResponsibleError] = useState<string | null>(null);
  const [responsibleOptions, setResponsibleOptions] = useState<ResponsibleOption[]>([]);
  const [responsibleDraft, setResponsibleDraft] = useState("");
  const [responsibleSaved, setResponsibleSaved] = useState("");
  const [responsibleLabel, setResponsibleLabel] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editCompanySlug, setEditCompanySlug] = useState("");
  const [editApplications, setEditApplications] = useState<ApplicationOption[]>([]);
  const [editApplicationId, setEditApplicationId] = useState("");
  const [editPlans, setEditPlans] = useState<TestPlanItem[]>([]);
  const [editPlanKey, setEditPlanKey] = useState("");
  const [editInitialPlanKey, setEditInitialPlanKey] = useState("");
  const [editPlansLoading, setEditPlansLoading] = useState(false);
  const [editPlanActionLoading, setEditPlanActionLoading] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editCases, setEditCases] = useState<ManualCaseItem[]>([]);
  const [editCasesDirty, setEditCasesDirty] = useState(false);

  const responsibleChanged = responsibleDraft !== responsibleSaved;
  const selectedEditApplication = editApplications.find((item) => item.id === editApplicationId) ?? null;
  const selectedEditPlan = useMemo(() => editPlans.find((item) => makePlanKey(item.source, item.id) === editPlanKey) ?? null, [editPlanKey, editPlans]);

  if (authLoading || !canEdit) return null;

  async function openResponsibleEditor() {
    setResponsibleOpen(true);
    setResponsibleLoading(true);
    setResponsibleError(null);
    try {
      const res = await fetchApi(`/api/releases-manual/${slug}`, { cache: "no-store", credentials: "include" });
      const payload = (await res.json().catch(() => null)) as ManualReleaseDetailsResponse | null;
      if (!res.ok || !payload) throw new Error("Nao foi possivel carregar os responsaveis.");
      const options = Array.isArray(payload.availableResponsibles) ? payload.availableResponsibles : [];
      const currentId = (payload.assignedToUserId?.trim() || payload.createdByUserId?.trim() || options[0]?.userId || "");
      setResponsibleOptions(options);
      setResponsibleDraft(currentId);
      setResponsibleSaved(currentId);
      setResponsibleLabel(payload.assignedToName?.trim() || payload.createdByName?.trim() || null);
    } catch (error) {
      console.error("Erro ao carregar responsavel da run manual", error);
      setResponsibleOptions([]);
      setResponsibleDraft("");
      setResponsibleSaved("");
      setResponsibleError("Nao foi possivel carregar os usuarios vinculados.");
    } finally {
      setResponsibleLoading(false);
    }
  }

  async function saveResponsible() {
    setResponsibleSaving(true);
    setResponsibleError(null);
    try {
      const res = await fetchApi(`/api/releases-manual/${slug}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assignedToUserId: responsibleDraft || null }) });
      const payload = (await res.json().catch(() => null)) as ManualReleaseDetailsResponse | null;
      if (!res.ok || !payload) throw new Error(payload?.message || "Nao foi possivel atualizar o responsavel.");
      const options = Array.isArray(payload.availableResponsibles) ? payload.availableResponsibles : responsibleOptions;
      const currentId = (payload.assignedToUserId?.trim() || payload.createdByUserId?.trim() || options[0]?.userId || "");
      setResponsibleOptions(options);
      setResponsibleDraft(currentId);
      setResponsibleSaved(currentId);
      setResponsibleLabel(payload.assignedToName?.trim() || payload.createdByName?.trim() || null);
      setResponsibleOpen(false);
      router.refresh();
    } catch (error) {
      console.error("Erro ao salvar responsavel da run manual", error);
      setResponsibleError(error instanceof Error ? error.message : "Nao foi possivel atualizar o responsavel.");
    } finally {
      setResponsibleSaving(false);
    }
  }

  async function finalize() {
    if (gateBlocked) return;
    setLoading(true);
    try {
      await fetchApi(`/api/releases-manual/${slug}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "FINALIZADA" }) });
      router.refresh();
    } catch (error) {
      console.error("Erro ao finalizar run manual", error);
    } finally {
      setLoading(false);
    }
  }

  async function reopen() {
    setLoading(true);
    try {
      await fetchApi(`/api/releases-manual/${slug}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "ACTIVE" }) });
      router.refresh();
    } catch (error) {
      console.error("Erro ao reabrir run manual", error);
    } finally {
      setLoading(false);
    }
  }

  async function openEditRun() {
    setEditOpen(true);
    setEditLoading(true);
    setEditError(null);
    try {
      const [releaseRes, casesRes] = await Promise.all([
        fetchApi(`/api/releases-manual/${slug}`, { cache: "no-store", credentials: "include" }),
        fetchApi(`/api/releases-manual/${slug}/cases`, { cache: "no-store", credentials: "include" }),
      ]);
      const releasePayload = (await releaseRes.json().catch(() => null)) as ManualReleaseDetailsResponse | null;
      const casesPayload = (await casesRes.json().catch(() => null)) as unknown;
      if (!releaseRes.ok || !releasePayload) throw new Error("Nao foi possivel carregar a run.");

      const companySlug = releasePayload.clientSlug?.trim() || activeClientSlug || "";
      let applications: ApplicationOption[] = [];
      if (companySlug) {
        const appsRes = await fetchApi(`/api/applications?companySlug=${encodeURIComponent(companySlug)}`, { cache: "no-store" });
        const appsPayload = await appsRes.json().catch(() => null);
        applications = Array.isArray(appsPayload?.items) ? (appsPayload.items as ApplicationOption[]) : [];
      }
      const matchedApplication = applications.find((item) => normalizeKey(item.slug) === normalizeKey(releasePayload.app) || normalizeKey(item.name) === normalizeKey(releasePayload.app) || normalizeKey(item.qaseProjectCode) === normalizeKey(releasePayload.qaseProject)) ?? applications[0] ?? null;
      const nextApplicationId = matchedApplication?.id ?? "";
      const plans = companySlug && nextApplicationId ? await loadPlanOptions(companySlug, nextApplicationId) : [];
      const requestedPlanKey = releasePayload.testPlanId?.trim() ? makePlanKey(releasePayload.testPlanSource === "qase" ? "qase" : "manual", releasePayload.testPlanId.trim()) : "";
      const initialPlanKey = requestedPlanKey && plans.some((item) => makePlanKey(item.source, item.id) === requestedPlanKey) ? requestedPlanKey : "";

      setEditCompanySlug(companySlug);
      setEditApplications(applications);
      setEditApplicationId(nextApplicationId);
      setEditPlans(plans);
      setEditPlanKey(initialPlanKey);
      setEditInitialPlanKey(initialPlanKey);
      setEditTitle(releasePayload.name?.trim() || releasePayload.title?.trim() || "");
      setEditCases(Array.isArray(casesPayload) ? (casesPayload as ManualCaseItem[]) : []);
      setEditCasesDirty(false);
    } catch (error) {
      console.error("Erro ao preparar edicao da run", error);
      setEditError(error instanceof Error ? error.message : "Nao foi possivel abrir a edicao da run.");
    } finally {
      setEditLoading(false);
    }
  }

  async function handleEditApplicationChange(value: string) {
    setEditApplicationId(value);
    setEditPlanKey("");
    setEditPlans([]);
    if (!editCompanySlug || !value) return;
    setEditPlansLoading(true);
    try {
      setEditPlans(await loadPlanOptions(editCompanySlug, value));
    } catch (error) {
      console.error("Erro ao carregar planos da aplicacao", error);
      setEditError(error instanceof Error ? error.message : "Nao foi possivel carregar os planos da aplicacao.");
    } finally {
      setEditPlansLoading(false);
    }
  }

  async function applySelectedPlanToRun() {
    if (!selectedEditPlan || !editCompanySlug || !editApplicationId) return;
    setEditPlanActionLoading(true);
    setEditError(null);
    try {
      const res = await fetchApi(`/api/test-plans?companySlug=${encodeURIComponent(editCompanySlug)}&applicationId=${encodeURIComponent(editApplicationId)}&planId=${encodeURIComponent(selectedEditPlan.id)}&source=${encodeURIComponent(selectedEditPlan.source)}`, { cache: "no-store" });
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.plan) throw new Error((typeof payload?.error === "string" && payload.error) || "Nao foi possivel carregar o plano.");
      setEditCases(mergePlanCases(payload.plan as TestPlanItem, editCases));
      setEditCasesDirty(true);
    } catch (error) {
      console.error("Erro ao aplicar plano na run", error);
      setEditError(error instanceof Error ? error.message : "Nao foi possivel aplicar o plano a run.");
    } finally {
      setEditPlanActionLoading(false);
    }
  }

  async function saveRunEdit() {
    const cleanedTitle = editTitle.trim();
    if (!cleanedTitle) {
      setEditError("Informe um titulo para a run.");
      return;
    }
    setEditSaving(true);
    setEditError(null);
    try {
      let casesToPersist = editCases;
      let shouldPersistCases = editCasesDirty;
      if (selectedEditPlan && !editCasesDirty && editPlanKey !== editInitialPlanKey) {
        const res = await fetchApi(`/api/test-plans?companySlug=${encodeURIComponent(editCompanySlug)}&applicationId=${encodeURIComponent(editApplicationId)}&planId=${encodeURIComponent(selectedEditPlan.id)}&source=${encodeURIComponent(selectedEditPlan.source)}`, { cache: "no-store" });
        const payload = await res.json().catch(() => null);
        if (!res.ok || !payload?.plan) throw new Error((typeof payload?.error === "string" && payload.error) || "Nao foi possivel carregar o plano.");
        casesToPersist = mergePlanCases(payload.plan as TestPlanItem, editCases);
        shouldPersistCases = true;
      }

      const patchRes = await fetchApi(`/api/releases-manual/${slug}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: cleanedTitle,
          name: cleanedTitle,
          app: selectedEditApplication?.slug || selectedEditApplication?.name || undefined,
          qaseProject: selectedEditApplication?.qaseProjectCode || undefined,
          testPlanId: selectedEditPlan?.id ?? null,
          testPlanName: selectedEditPlan?.title ?? null,
          testPlanSource: selectedEditPlan?.source ?? null,
          testPlanProjectCode: selectedEditPlan?.projectCode || selectedEditApplication?.qaseProjectCode || null,
        }),
      });
      const patchPayload = await patchRes.json().catch(() => null);
      if (!patchRes.ok) throw new Error((typeof patchPayload?.message === "string" && patchPayload.message) || "Nao foi possivel salvar a run.");

      if (shouldPersistCases) {
        const casesRes = await fetchApi(`/api/releases-manual/${slug}/cases`, {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(casesToPersist.map((item) => ({ id: item.id, title: item.title || `Caso ${item.id}`, link: item.link || undefined, status: item.status || "NAO_EXECUTADO", bug: item.bug ?? null, fromApi: false }))),
        });
        const casesPayload = await casesRes.json().catch(() => null);
        if (!casesRes.ok) throw new Error((typeof casesPayload?.message === "string" && casesPayload.message) || "Nao foi possivel atualizar os casos da run.");
      }

      setEditOpen(false);
      setEditCasesDirty(false);
      router.refresh();
    } catch (error) {
      console.error("Erro ao salvar a edicao da run", error);
      setEditError(error instanceof Error ? error.message : "Nao foi possivel salvar a run.");
    } finally {
      setEditSaving(false);
    }
  }

  return (
    <>
      <div className="flex flex-col items-start gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => void openEditRun()} disabled={loading || editLoading} className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/15 disabled:opacity-60">
            {editLoading ? "Carregando..." : "Editar run"}
          </button>
          <button type="button" onClick={() => void openResponsibleEditor()} disabled={loading || responsibleLoading} className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/15 disabled:opacity-60">
            {responsibleLoading ? "Carregando..." : "Editar responsavel"}
          </button>
          {finalized ? (
            <button type="button" onClick={reopen} disabled={loading} className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15 disabled:opacity-60">
              {loading ? "..." : "Reabrir"}
            </button>
          ) : (
            <button type="button" onClick={finalize} disabled={loading || gateBlocked} aria-disabled={gateBlocked} data-testid="release-approve" className="rounded-xl bg-(--tc-accent,#ef0001) px-4 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60">
              {loading ? "..." : "Finalizar run"}
            </button>
          )}
        </div>

        {((gateBlocked && !finalized) || responsibleLabel || responsibleOpen) && (
          <div className="flex w-full max-w-[360px] flex-col gap-2">
            {gateBlocked && !finalized ? <p className="text-xs text-rose-200" data-testid="quality-gate-blocked-message">Qualidade insuficiente para aprovacao</p> : null}
            {responsibleLabel && !responsibleOpen ? <p className="text-xs text-white/75">Responsavel atual: {responsibleLabel}</p> : null}
            {responsibleOpen ? (
              <div className="w-full rounded-2xl border border-white/15 bg-[#081733]/90 p-4 shadow-[0_18px_45px_rgba(2,6,23,0.3)] backdrop-blur-sm">
                <div className="mb-3 space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/50">Responsavel</p>
                  <p className="text-sm font-semibold text-white">{responsibleLabel ? `Atual: ${responsibleLabel}` : "Defina quem responde por esta run."}</p>
                  <p className="text-xs text-white/65">Podem ser escolhidos usuarios da empresa ou usuarios da Testing Company vinculados a ela.</p>
                </div>
                {responsibleLoading ? (
                  <p className="text-xs text-white/70">Carregando usuarios vinculados...</p>
                ) : responsibleOptions.length > 0 ? (
                  <div className="space-y-3">
                    <Select value={responsibleDraft || undefined} onValueChange={setResponsibleDraft}>
                      <SelectTrigger className="h-11 rounded-2xl border-white/15 bg-white/95 text-[#0b1a3c]"><SelectValue placeholder="Selecione o responsavel" /></SelectTrigger>
                      <SelectContent>{responsibleOptions.map((option) => <SelectItem key={option.userId} value={option.userId}>{option.label}</SelectItem>)}</SelectContent>
                    </Select>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <button type="button" onClick={() => { setResponsibleOpen(false); setResponsibleError(null); setResponsibleDraft(responsibleSaved); }} className="rounded-xl border border-white/15 px-3 py-2 text-xs font-semibold text-white/80 hover:bg-white/10">Cancelar</button>
                      <button type="button" onClick={() => void saveResponsible()} disabled={responsibleSaving || !responsibleDraft || !responsibleChanged} className="rounded-xl bg-(--tc-accent,#ef0001) px-3 py-2 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-60">
                        {responsibleSaving ? "Salvando..." : "Salvar responsavel"}
                      </button>
                    </div>
                  </div>
                ) : <p className="text-xs text-white/70">Nenhum usuario vinculado foi encontrado para esta empresa.</p>}
                {responsibleError ? <p className="mt-3 text-xs text-rose-200">{responsibleError}</p> : null}
              </div>
            ) : null}
          </div>
        )}
      </div>

      {editOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#020617]/72 px-4 py-6 backdrop-blur-sm" role="dialog" aria-modal="true" onClick={(event) => { if (event.target === event.currentTarget && !editSaving) setEditOpen(false); }}>
          <div className="w-full max-w-3xl overflow-hidden rounded-[28px] border border-white/15 bg-[#081428] text-white shadow-[0_30px_90px_rgba(2,6,23,0.45)]">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 bg-[linear-gradient(135deg,#0a1f4d_0%,#102b66_50%,#7f1d1d_100%)] px-6 py-5">
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/60">Run manual</p>
                <h3 className="text-2xl font-black tracking-[-0.04em] text-white">Editar run</h3>
                <p className="text-sm text-white/78">Aplique um plano de teste ou siga com a run direta.</p>
              </div>
              <button type="button" onClick={() => !editSaving && setEditOpen(false)} className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-white transition hover:bg-white/16" aria-label="Fechar modal"><FiX className="h-5 w-5" /></button>
            </div>

            <div className="space-y-5 px-6 py-6">
              {editLoading ? (
                <div className="rounded-[24px] border border-white/10 bg-white/5 px-4 py-10 text-sm text-white/70">Carregando dados da run...</div>
              ) : (
                <>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <label className="space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.24em] text-white/55">Titulo</span>
                      <input value={editTitle} onChange={(event) => setEditTitle(event.target.value)} className="w-full rounded-[20px] border border-white/12 bg-white/6 px-4 py-3 text-sm text-white outline-none transition focus:border-white/30" placeholder="Nome da run" />
                    </label>
                    <label className="space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.24em] text-white/55">Aplicacao</span>
                      <Select value={editApplicationId || undefined} onValueChange={(value) => void handleEditApplicationChange(value)}>
                        <SelectTrigger className="border-white/12 bg-white/6 text-white"><SelectValue placeholder="Selecione a aplicacao" /></SelectTrigger>
                        <SelectContent>{editApplications.map((application) => <SelectItem key={application.id} value={application.id}>{application.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </label>
                  </div>

                  <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-white/80"><FiLayers className="h-4 w-4" /></span>
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/55">Plano de teste</p>
                          <p className="text-sm text-white/78">{selectedEditPlan ? `${selectedEditPlan.casesCount} caso(s) prontos para aplicar.` : `${editCases.length} caso(s) atualmente na run.`}</p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
                      <Select value={editPlanKey || undefined} onValueChange={setEditPlanKey}>
                        <SelectTrigger className="border-white/12 bg-white/6 text-white"><SelectValue placeholder={editPlansLoading ? "Carregando planos..." : editPlans.length > 0 ? "Sem plano aplicado" : "Nenhum plano disponivel"} /></SelectTrigger>
                        <SelectContent>{editPlans.map((plan) => <SelectItem key={makePlanKey(plan.source, plan.id)} value={makePlanKey(plan.source, plan.id)}>{plan.title}</SelectItem>)}</SelectContent>
                      </Select>
                      <button type="button" onClick={() => void applySelectedPlanToRun()} disabled={!selectedEditPlan || editPlanActionLoading} className="rounded-2xl border border-white/12 bg-white/8 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/14 disabled:opacity-60">
                        {editPlanActionLoading ? "Aplicando..." : "Aplicar plano"}
                      </button>
                      <button type="button" onClick={() => setEditPlanKey("")} disabled={!editPlanKey} className="rounded-2xl border border-white/12 bg-transparent px-4 py-3 text-sm font-semibold text-white/72 transition hover:bg-white/10 disabled:opacity-60">Run direta</button>
                    </div>
                  </div>

                  {editError ? <div className="rounded-[20px] border border-rose-400/22 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{editError}</div> : null}

                  <div className="flex flex-wrap items-center justify-end gap-3">
                    <button type="button" onClick={() => setEditOpen(false)} disabled={editSaving} className="rounded-2xl border border-white/12 px-4 py-2.5 text-sm font-semibold text-white/82 transition hover:bg-white/10">Cancelar</button>
                    <button type="button" onClick={() => void saveRunEdit()} disabled={editSaving || !editTitle.trim()} className="inline-flex items-center gap-2 rounded-2xl bg-(--tc-accent,#ef0001) px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60">
                      <FiEdit3 className="h-4 w-4" />
                      {editSaving ? "Salvando..." : "Salvar alteracoes"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
