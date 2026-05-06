import ExportPDFButton from "@/components/ExportPDFButton";
import ManualReleaseActions from "@/components/ManualReleaseActions";
import { EditReleaseButton } from "@/components/EditReleaseButton";
import { QualityGateHistory } from "../QualityGateHistory";
import type { RunDetailViewModel } from "@/lib/runDetailViewModel";
import type { ReleaseEntry } from "../data";

const GATE_BADGE: Record<string, string> = {
  passed: "bg-emerald-500/20 border-emerald-400/40 text-emerald-300",
  failed: "bg-red-500/20 border-red-400/40 text-red-300",
  warning: "bg-amber-500/20 border-amber-400/40 text-amber-300",
};

function gateClasses(status: string) {
  return GATE_BADGE[status.toLowerCase()] ?? "bg-white/10 border-white/20 text-white/80";
}

function scoreColor(score: number) {
  if (score >= 80) return "text-emerald-300";
  if (score >= 50) return "text-amber-300";
  return "text-red-300";
}

export function RunHero({ vm }: { vm: RunDetailViewModel }) {
  const passRate = vm.total > 0 ? Math.round((vm.stats.pass / vm.total) * 100) : 0;

  return (
    <>
      {/* ── Header row: title + metadata ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-5">
        {/* Left — identity */}
        <div className="min-w-0 space-y-2">
          <div className="flex items-center gap-3">
            <div
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[12px] font-bold uppercase tracking-[0.12em] text-white shadow-[0_8px_20px_rgba(0,0,0,0.25)] border border-(--app-tag-color) bg-(--app-tag-color) ${vm.appColorClass}`}
            >
              <span className="h-2.5 w-2.5 rounded-full bg-white/90 ring-2 ring-white/30" />
              <span className="leading-none">{vm.appMeta.label}</span>
            </div>
            <span className="text-[11px] uppercase tracking-[0.22em] text-white/40">
              {vm.source === "API" ? "Integração Qase" : "Manual"}
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white leading-tight">
            {vm.displayTitle}
          </h1>
          {vm.displaySummary && (
            <p className="text-sm text-white/60 max-w-xl">{vm.displaySummary}</p>
          )}
        </div>

        {/* Right — key indicators */}
        <div className="flex items-start gap-3 shrink-0">
          {/* Gate badge */}
          <div
            data-testid="quality-gate-status"
            data-status={vm.gate.status}
            className={`flex flex-col items-center rounded-xl border px-4 py-2.5 min-w-22 ${gateClasses(vm.gate.status)}`}
          >
            <span className="text-[10px] uppercase tracking-[0.18em] opacity-70">Gate</span>
            <span className="text-lg font-extrabold leading-tight capitalize">{vm.gate.status}</span>
          </div>
          {/* Quality Score */}
          <div
            data-testid="quality-score"
            className="flex flex-col items-center rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 min-w-22"
          >
            <span className="text-[10px] uppercase tracking-[0.18em] text-white/50">Score</span>
            <span className={`text-lg font-extrabold leading-tight ${scoreColor(vm.qualityScore)}`}>
              {vm.qualityScore}
            </span>
          </div>
          {/* Pass Rate */}
          <div className="flex flex-col items-center rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 min-w-22">
            <span className="text-[10px] uppercase tracking-[0.18em] text-white/50">Pass</span>
            <span className="text-lg font-extrabold leading-tight text-emerald-300">
              {passRate}%
            </span>
          </div>
        </div>
      </div>

      {/* ── Metadata row ── */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px] text-white/60 mb-5">
        {vm.runId && (
          <span>
            Run ID: <strong className="text-white/90">{vm.runId}</strong>
          </span>
        )}
        <span>
          Projeto: <strong className="text-white/90">{vm.projectCode}</strong>
        </span>
        <span>
          Total casos: <strong className="text-white/90">{vm.total}</strong>
        </span>
        {vm.stats.fail > 0 && (
          <span>
            Defeitos: <strong className="text-red-300">{vm.stats.fail}</strong>
          </span>
        )}
      </div>

      {/* ── Actions row ── */}
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <a
          data-testid="release-export"
          href={vm.csvExportUrl}
          download={`run-${vm.releaseData.slug}.csv`}
          className="inline-flex items-center rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-[12px] font-semibold text-white/80 hover:bg-white/15 transition-colors"
        >
          <svg className="w-3.5 h-3.5 mr-1.5 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          CSV
        </a>
        <a
          data-testid="release-export-pdf"
          href={vm.pdfExportUrl}
          download={`run-${vm.releaseData.slug}.pdf`}
          className="inline-flex items-center rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-[12px] font-semibold text-white/80 hover:bg-white/15 transition-colors"
        >
          <svg className="w-3.5 h-3.5 mr-1.5 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          PDF
        </a>
        <ExportPDFButton fileName={vm.releaseData.slug || "run"} companySlug={vm.companySlug} />
        {vm.source === "API" && (
          <EditReleaseButton
            slug={vm.releaseData.slug}
            currentTitle={(vm.releaseData as ReleaseEntry).title}
            currentRunId={(vm.releaseData as ReleaseEntry).runId}
          />
        )}
        {vm.source === "MANUAL" && (
          <ManualReleaseActions
            slug={vm.releaseData.slug ?? vm.slug}
            status={
              typeof vm.releaseData.status === "string"
                ? vm.releaseData.status
                : undefined
            }
            gateStatus={vm.gate.status}
          />
        )}
        <div className="ml-auto">
          <QualityGateHistory
            companySlug={vm.companySlug}
            releaseSlug={vm.releaseData.slug}
            initialEvents={vm.timeline}
          />
        </div>
      </div>
    </>
  );
}
