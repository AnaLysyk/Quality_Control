"use client";

import { useEffect, useMemo, useState } from "react";
import { FiRefreshCw, FiSave } from "react-icons/fi";
import Kanban from "@/components/Kanban";
import {
  RunCasesBoard,
  RUN_CASE_STATUS_VALUES,
  computeRunCaseStats,
  mapStoredCasesToRunCaseDrafts,
  type RunCaseDraft,
} from "@/components/RunCasesBoard";
import { fetchApi } from "@/lib/api";
import type { KanbanData } from "@/types/kanban";

type RunStatsSnapshot = {
  pass: number;
  fail: number;
  blocked: number;
  notRun: number;
  total: number;
};

type RunDetailKanbanPanelProps = {
  run: {
    slug: string;
    sourceType: "manual" | "integrated";
    applicationLabel: string;
    projectCode: string | null;
    runId: number | null;
    stats: RunStatsSnapshot;
    raw: Record<string, unknown>;
  };
  companySlug?: string;
  onRunUpdated?: () => void;
};

const EMPTY_KANBAN: KanbanData = {
  pass: [],
  fail: [],
  blocked: [],
  notRun: [],
};

export function RunDetailKanbanPanel({ run, companySlug, onRunUpdated }: RunDetailKanbanPanelProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

  const [manualCases, setManualCases] = useState<RunCaseDraft[]>([]);
  const [manualCasesDirty, setManualCasesDirty] = useState(false);
  const [savingManualCases, setSavingManualCases] = useState(false);

  const [integratedData, setIntegratedData] = useState<KanbanData>(EMPTY_KANBAN);

  useEffect(() => {
    let active = true;

    async function loadPanelData() {
      setLoading(true);
      setError(null);

      try {
        if (run.sourceType === "manual") {
          const response = await fetchApi(`/api/releases-manual/${encodeURIComponent(run.slug)}/cases`, {
            cache: "no-store",
            credentials: "include",
          });
          const payload = await response.json().catch(() => []);
          if (!response.ok) {
            const message =
              (payload && typeof payload === "object" && typeof (payload as { message?: unknown }).message === "string"
                ? (payload as { message: string }).message
                : null) || "Não foi possível carregar os casos da run manual.";
            throw new Error(message);
          }
          if (!active) return;
          setManualCases(mapStoredCasesToRunCaseDrafts(Array.isArray(payload) ? payload : []));
          setManualCasesDirty(false);
        } else {
          if (!run.projectCode || !run.runId) {
            throw new Error("Esta run integrada não possui projeto ou identificador válidos para o kanban.");
          }

          const params = new URLSearchParams({
            project: run.projectCode,
            runId: String(run.runId),
          });
          if (companySlug) params.set("companySlug", companySlug);

          const response = await fetchApi(`/api/runs/kanban?${params.toString()}`, {
            cache: "no-store",
            credentials: "include",
          });
          const payload = await response.json().catch(() => null);
          if (!response.ok) {
            const message =
              (payload && typeof payload === "object" && typeof (payload as { message?: unknown }).message === "string"
                ? (payload as { message: string }).message
                : null) || "Não foi possível carregar o kanban da run integrada.";
            throw new Error(message);
          }
          const data =
            payload && typeof payload === "object" && payload !== null && "data" in payload
              ? ((payload as { data?: KanbanData }).data ?? EMPTY_KANBAN)
              : EMPTY_KANBAN;
          if (!active) return;
          setIntegratedData(data);
        }
      } catch (panelError) {
        if (!active) return;
        setError(panelError instanceof Error ? panelError.message : "Não foi possível carregar o kanban da run.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadPanelData();

    return () => {
      active = false;
    };
  }, [companySlug, refreshNonce, run.projectCode, run.runId, run.slug, run.sourceType]);

  const manualStats = useMemo(() => computeRunCaseStats(manualCases), [manualCases]);
  const manualTotal = manualStats.pass + manualStats.fail + manualStats.blocked + manualStats.notRun;
  const manualPassRate = manualTotal > 0 ? Math.round((manualStats.pass / manualTotal) * 100) : 0;

  async function saveManualCases() {
    if (run.sourceType !== "manual") return;
    setSavingManualCases(true);
    setError(null);

    try {
      const payload = manualCases.map((item) => ({
        id: item.id,
        title: item.title,
        link: item.link || undefined,
        status: RUN_CASE_STATUS_VALUES[item.status],
        bug: item.bug ?? null,
        fromApi: false,
      }));

      const [casesResponse, releaseResponse] = await Promise.all([
        fetchApi(`/api/releases-manual/${encodeURIComponent(run.slug)}/cases`, {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }),
        fetchApi(`/api/releases-manual/${encodeURIComponent(run.slug)}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            stats: {
              pass: manualStats.pass,
              fail: manualStats.fail,
              blocked: manualStats.blocked,
              notRun: manualStats.notRun,
            },
          }),
        }),
      ]);

      const casesPayload = await casesResponse.json().catch(() => null);
      const releasePayload = await releaseResponse.json().catch(() => null);

      if (!casesResponse.ok) {
        throw new Error(
          (casesPayload && typeof casesPayload === "object" && typeof (casesPayload as { message?: unknown }).message === "string"
            ? (casesPayload as { message: string }).message
            : null) || "Não foi possível atualizar os casos da run.",
        );
      }

      if (!releaseResponse.ok) {
        throw new Error(
          (releasePayload && typeof releasePayload === "object" && typeof (releasePayload as { message?: unknown }).message === "string"
            ? (releasePayload as { message: string }).message
            : null) || "Não foi possível atualizar os totais da run.",
        );
      }

      setManualCasesDirty(false);
      onRunUpdated?.();
    } catch (saveError) {
      console.error("Falha ao salvar o quadro da run manual", saveError);
      setError(saveError instanceof Error ? saveError.message : "Não foi possível salvar o quadro da run.");
    } finally {
      setSavingManualCases(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#f8fafc) p-5 text-sm text-(--tc-text-muted,#6b7280)">
        Carregando kanban da run...
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-3 rounded-2xl border border-rose-200 bg-rose-50 p-5">
        <p className="text-sm font-semibold text-rose-700">{error}</p>
        <button
          type="button"
          onClick={() => setRefreshNonce((current) => current + 1)}
          className="inline-flex items-center gap-2 rounded-2xl border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
        >
          <FiRefreshCw className="h-4 w-4" />
          Tentar novamente
        </button>
      </div>
    );
  }

  if (run.sourceType === "manual") {
    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-3 rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#f8fafc) p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-(--tc-border,#e5e7eb) bg-white px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-(--tc-text-muted,#6b7280)">Total atual</p>
              <p className="mt-2 text-xl font-black text-(--tc-text,#0b1a3c)">{manualTotal}</p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700">Pass</p>
              <p className="mt-2 text-xl font-black text-emerald-700">{manualStats.pass}</p>
            </div>
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-rose-700">Fail</p>
              <p className="mt-2 text-xl font-black text-rose-700">{manualStats.fail}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-(--tc-text-muted,#6b7280)">Pass rate</p>
              <p className="mt-2 text-xl font-black text-(--tc-text,#0b1a3c)">{manualPassRate}%</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setRefreshNonce((current) => current + 1)}
              className="inline-flex items-center gap-2 rounded-2xl border border-(--tc-border,#d9e1ec) bg-white px-4 py-2.5 text-sm font-semibold text-(--tc-text,#0b1a3c) transition hover:border-(--tc-accent,#ef0001)"
            >
              <FiRefreshCw className="h-4 w-4" />
              Recarregar
            </button>
            <button
              type="button"
              onClick={() => void saveManualCases()}
              disabled={savingManualCases || !manualCasesDirty}
              className="inline-flex items-center gap-2 rounded-2xl bg-(--tc-accent,#ef0001) px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
            >
              <FiSave className="h-4 w-4" />
              {savingManualCases ? "Salvando..." : "Salvar quadro"}
            </button>
          </div>
        </div>

        <RunCasesBoard
          cases={manualCases}
          onCasesChange={(nextCases) => {
            setManualCases(nextCases);
            setManualCasesDirty(true);
          }}
          editable={true}
          mode="manual"
          eyebrow="Visualização editável"
          title="Mesmo quadro usado na criação"
          subtitle="Ajuste status, evidência e bug diretamente daqui. Ao salvar, os totais da run também são sincronizados."
          showComposer={true}
        />
      </div>
    );
  }

  const persistEndpoint =
    run.projectCode && run.runId && companySlug
      ? `/api/kanban?project=${encodeURIComponent(run.projectCode)}&runId=${encodeURIComponent(String(run.runId))}&slug=${encodeURIComponent(companySlug)}`
      : undefined;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#f8fafc) p-4 text-sm text-(--tc-text-muted,#6b7280)">
        Esta run veio da integração. O quadro abaixo reflete os casos sincronizados e permite complementar evidências e bugs por empresa, sem alterar a origem da execução.
      </div>

      <Kanban
        data={integratedData}
        project={run.projectCode ?? run.applicationLabel}
        runId={run.runId ?? 0}
        qaseProject={run.projectCode ?? undefined}
        companySlug={companySlug}
        persistEndpoint={persistEndpoint}
        editable={false}
        allowStatusChange={false}
        allowLinkEdit={Boolean(companySlug)}
      />
    </div>
  );
}
