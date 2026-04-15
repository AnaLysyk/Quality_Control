import "server-only";
import StatusChart from "@/components/StatusChart";
import Kanban from "@/components/Kanban";
import ExportPDFButton from "@/components/ExportPDFButton";
import ManualReleaseActions from "@/components/ManualReleaseActions";
import { EditReleaseButton } from "@/components/EditReleaseButton";
import { ManualStatsForm } from "@/components/ManualStatsForm";
import { getReleaseBySlug, type ReleaseEntry } from "./data";
import { getRunDetails } from "@/integrations/qase";
import { RunKanbanStream } from "./RunKanbanStream";
import { slugifyRelease } from "@/lib/slugifyRelease";
import type { Release } from "@/types/release";
import { getAppMeta } from "@/lib/appMeta";
import { evaluateQualityGate } from "@/lib/quality";
import Image from "next/image";
import { QualityGateHistory } from "./QualityGateHistory";
import { readQualityGateHistory } from "@/lib/qualityGateHistory";
import { calculateQualityScore } from "@/lib/qualityScore";
import { getReleaseTimeline } from "@/lib/releaseTimeline";
import { formatRunText, formatRunTitle } from "@/lib/runPresentation";
import { readManualReleaseStore } from "./manualData";

type AnyRelease = (Release & { name?: string }) | (ReleaseEntry & { name?: string });

type ReleaseTemplateProps = {
  appName: string;
  finalTitle: string;
  stats: { pass: number; fail: number; blocked: number; notRun: number };
  total: number;
};

type ReleasePageContentProps = { slug: string; companySlug?: string };

function parseQaseRunSlug(value: string): { projectCode: string; runId: number } | null {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^qase-([a-z0-9_-]+)-(\d+)$/i);
  if (!match) return null;
  const projectCode = match[1].trim().toUpperCase();
  const runId = Number(match[2]);
  if (!projectCode || !Number.isFinite(runId)) return null;
  return { projectCode, runId };
}

const legendClassByLabel: Record<string, string> = {
  Pass: "bg-[#22c55e]",
  Fail: "bg-[#ef4444]",
  Blocked: "bg-[#facc15]",
  "Not Run": "bg-[#64748b]",
  Total: "bg-[#0f172a]",
};

const APP_COLOR_CLASS: Record<string, string> = {
  smart: "app-color-smart",
  sfq: "app-color-smart",
  print: "app-color-print",
  booking: "app-color-booking",
  cds: "app-color-cds",
  trust: "app-color-trust",
  "cidadao-smart": "app-color-cidadao",
  gmt: "app-color-gmt",
};

export async function ReleasePageContent({ slug, companySlug }: ReleasePageContentProps) {
  const normalizedSlug = slugifyRelease(slug);
  let manualRelease: Release | null = null;
  let apiRelease: ReleaseEntry | null = null;

  try {
    const manualReleases = await readManualReleaseStore();
    manualRelease = manualReleases.find((release) => release.slug === normalizedSlug) ?? null;
  } catch {
    manualRelease = null;
  }

  if (!manualRelease) {
    apiRelease = (await getReleaseBySlug(normalizedSlug)) ?? null;
  }

  let source: "MANUAL" | "API" = manualRelease ? "MANUAL" : "API";
  let releaseData: AnyRelease | null = (manualRelease as AnyRelease) || (apiRelease as AnyRelease);

  if (!releaseData) {
    const parsed = parseQaseRunSlug(slug);
    if (parsed) {
      apiRelease = {
        slug: normalizedSlug,
        title: `Run ${parsed.runId}`,
        summary: "Execução integrada via Qase.",
        runId: parsed.runId,
        project: parsed.projectCode.toLowerCase(),
        app: parsed.projectCode.toLowerCase(),
        qaseProject: parsed.projectCode,
      };
      releaseData = apiRelease as AnyRelease;
      source = "API";
    }
  }

  if (!releaseData) {
    return <div className="p-6 text-sm text-red-400">Run não encontrada.</div>;
  }

  const projectKey = (releaseData.app || (releaseData as ReleaseEntry).project || "smart").toLowerCase();
  const projectCode =
    (releaseData as ReleaseEntry).qaseProject ?? (projectKey === "smart" ? "SFQ" : projectKey.toUpperCase());
  const appMeta = getAppMeta(projectKey, projectCode);
  const appColorClass = APP_COLOR_CLASS[projectKey] ?? "app-color-default";

  let stats =
    source === "MANUAL"
      ? manualRelease?.stats ?? { pass: 0, fail: 0, blocked: 0, notRun: 0 }
      : { pass: 0, fail: 0, blocked: 0, notRun: 0 };
  let hasData = stats.pass + stats.fail + stats.blocked + stats.notRun > 0;

  if (source === "API") {
    const runId = Number((releaseData as ReleaseEntry).runId);
    if (Number.isFinite(runId)) {
      const qaseSlugKey = companySlug ?? normalizedSlug;
      try {
        const run = await getRunDetails(projectCode, runId, qaseSlugKey);
        if (run) {
          stats = { pass: run.pass, fail: run.fail, blocked: run.blocked, notRun: run.notRun };
          hasData = run.hasData;
        }
      } catch {
        /* ignore */
      }
    }
  }

  const editable = source === "MANUAL";
  const total = stats.pass + stats.fail + stats.blocked + stats.notRun;
  const gate = evaluateQualityGate(total > 0 ? stats : null);
  const history = await readQualityGateHistory(companySlug || "demo", releaseData.slug);
  const latestGate = history[0] ?? null;
  const initialTimeline = await getReleaseTimeline(companySlug || "demo", releaseData.slug);
  const inferredFailRate = total > 0 ? Math.round((stats.fail / total) * 100) : 0;
  const qualityScore = calculateQualityScore({
    gate_status: latestGate?.gate_status ?? gate.status,
    mttr_hours: latestGate?.mttr_hours ?? null,
    open_defects: latestGate?.open_defects ?? null,
    fail_rate: latestGate?.fail_rate ?? inferredFailRate,
  });
  const canPersistApiLinks = source === "API" && Boolean(companySlug);
  const apiPersistEndpoint =
    source === "API" && Number.isFinite(Number((releaseData as ReleaseEntry).runId))
      ? `/api/kanban?project=${encodeURIComponent(projectCode)}&runId=${encodeURIComponent(
          String((releaseData as ReleaseEntry).runId ?? 0),
        )}${companySlug ? `&slug=${encodeURIComponent(companySlug)}` : ""}`
      : undefined;
  const displayTitle = formatRunTitle(
    (releaseData as { name?: string }).name ?? (releaseData as ReleaseEntry).title ?? releaseData.slug ?? "Run",
    "Run",
  );
  const displaySummary = formatRunText((releaseData as ReleaseEntry).summary);

  return (
    <div className="w-full py-6 sm:py-8 text-(--tc-text,#0b1a3c)">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="overflow-hidden rounded-4xl shadow-[0_24px_60px_rgba(15,23,42,0.18)]">
        <div className="bg-[linear-gradient(135deg,#031843_0%,#0b2d72_55%,#57153f_80%,#b01a33_100%)] p-6 text-white sm:p-8">
          {/* ── Run title row ── */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-6">
            <div className="space-y-1 min-w-0">
              <p className="text-xs uppercase tracking-[0.32em] text-white/50">Run</p>
              <h1 className="text-3xl md:text-4xl font-extrabold text-white leading-tight">{displayTitle}</h1>
              {displaySummary && <p className="text-sm text-white/70">{displaySummary}</p>}
            </div>
            <div className="flex flex-col items-start sm:items-end gap-2 shrink-0">
              <div className="flex flex-wrap items-center gap-2">
                <div className={`inline-flex items-center justify-center gap-2 rounded-full px-3 py-1 text-[12px] font-bold uppercase tracking-[0.12em] text-white shadow-[0_8px_20px_rgba(0,0,0,0.25)] border border-(--app-tag-color) bg-(--app-tag-color) ${appColorClass}`}>
                  <span className="h-3 w-3 rounded-full bg-white/90 ring-2 ring-white/40" />
                  <span className="leading-none">{appMeta.label}</span>
                </div>
                <div
                  data-testid="quality-gate-status"
                  data-status={gate.status}
                  className="inline-flex items-center rounded-full border border-white/30 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/90"
                >
                  Gate: {gate.status}
                </div>
                <div
                  data-testid="quality-score"
                  className="inline-flex items-center rounded-full border border-white/30 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/90"
                >
                  Score: {qualityScore}
                </div>
                <a
                  data-testid="release-export"
                  href={`/api/empresas/${encodeURIComponent(companySlug || "demo")}/releases/${encodeURIComponent(releaseData.slug)}/export?format=csv`}
                  download={`run-${releaseData.slug}.csv`}
                  className="inline-flex items-center rounded-full border border-white/30 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/90 hover:bg-white/20"
                >
                  Exportar
                </a>
                <a
                  data-testid="release-export-pdf"
                  href={`/api/empresas/${encodeURIComponent(companySlug || "demo")}/releases/${encodeURIComponent(releaseData.slug)}/export?format=pdf`}
                  download={`run-${releaseData.slug}.pdf`}
                  className="inline-flex items-center rounded-full border border-white/30 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/90 hover:bg-white/20"
                >
                  Exportar PDF
                </a>
                <ExportPDFButton fileName={releaseData.slug || "run"} targetId="pdf-summary" />
                {source === "API" && (
                  <EditReleaseButton
                    slug={releaseData.slug}
                    currentTitle={(releaseData as ReleaseEntry).title}
                    currentRunId={(releaseData as ReleaseEntry).runId}
                  />
                )}
                {source === "MANUAL" && (
                  <ManualReleaseActions
                    slug={releaseData.slug ?? normalizedSlug}
                    status={typeof releaseData.status === "string" ? releaseData.status : undefined}
                    gateStatus={gate.status}
                  />
                )}
              </div>
              <QualityGateHistory
                companySlug={companySlug || "demo"}
                releaseSlug={releaseData.slug}
                initialEvents={initialTimeline}
              />
            </div>
          </div>

          {/* ── Stats inside cover ── */}
          {source === "MANUAL" && <ManualStatsForm slug={releaseData.slug} initialStats={stats} />}
          <div id="pdf-summary" className="pt-5 border-t border-white/10">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4 text-sm text-white/70">
              <div>
                <span>Run ID: </span><span className="font-bold text-white">{(releaseData as ReleaseEntry).runId ?? "-"}</span>
                <span className="mx-3 text-white/30">·</span>
                <span>Projeto: </span><span className="font-bold text-white">{appMeta.label}</span>
              </div>
              <span className="text-xs text-white/40">
                {source === "API" ? "Dados integrados via Qase." : "Dados preenchidos manualmente."}
              </span>
            </div>
            <div className="flex flex-col items-center gap-4">
              <StatusChart stats={stats} hasData={hasData} emptyLabel="Sem execuções" />
              <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
                {[
                  { label: "Pass", value: stats.pass },
                  { label: "Fail", value: stats.fail },
                  { label: "Blocked", value: stats.blocked },
                  { label: "Not Run", value: stats.notRun },
                  { label: "Total", value: stats.pass + stats.fail + stats.blocked + stats.notRun },
                ].map((item) => {
                  const grandTotal = stats.pass + stats.fail + stats.blocked + stats.notRun;
                  const pct = grandTotal > 0 ? Math.round((item.value / grandTotal) * 100) : 0;
                  const isTotal = item.label === "Total";
                  return (
                    <div key={item.label} className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${legendClassByLabel[item.label] ?? "bg-white"}`} />
                      <span className="font-semibold text-white/80">{item.label}:</span>
                      <span className="font-bold text-white">{item.value}</span>
                      {!isTotal && <span className="text-xs text-white/50">({pct}%)</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
        </div>

        <section className="overflow-hidden rounded-4xl shadow-[0_24px_60px_rgba(15,23,42,0.18)]">
          <div className="flex items-center justify-between px-6 py-4 sm:px-8 border-b border-(--tc-border)/20 bg-(--tc-primary,#0b1a3c)/5">
            <h2 className="text-base font-bold uppercase tracking-[0.2em] text-(--tc-text,#0b1a3c)/70">Kanban</h2>
          </div>
          <div className="p-4 sm:p-6">
            {source === "API" ? (
              <RunKanbanStream
                projectKey={projectKey}
                projectCode={projectCode}
                runId={(releaseData as ReleaseEntry).runId ?? 0}
                companySlug={companySlug}
                persistEndpoint={apiPersistEndpoint}
                editable={false}
                allowStatusChange={false}
                allowLinkEdit={canPersistApiLinks}
              />
            ) : (
              <Kanban
                data={{ pass: [], fail: [], blocked: [], notRun: [] }}
                project={projectKey}
                runId={0}
                qaseProject={projectCode}
                companySlug={companySlug}
                persistEndpoint={`/api/releases-manual/${releaseData.slug}/cases`}
                editable={true}
                allowStatusChange={true}
                allowLinkEdit={false}
              />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

export default function ReleaseTemplate({ appName, finalTitle, stats, total }: ReleaseTemplateProps) {
  const totalPctLabel = total > 0 ? "100%" : "0%";
  const statusList = [
    { label: "Pass", value: stats.pass, color: "#22c55e" },
    { label: "Fail", value: stats.fail, color: "#ef4444" },
    { label: "Blocked", value: stats.blocked, color: "#facc15" },
    { label: "Not Run", value: stats.notRun, color: "#64748b" },
    { label: "Total", value: total, color: "#0b1a3c" },
  ];

  return (
    <div
      id="pdf-template"
      className="pdf-container text-[#0b1a3c] bg-white w-full max-w-[210mm] min-h-[297mm] p-[18mm] mx-auto flex flex-col font-sans"
    >
      <div className="space-y-8 flex-1 flex flex-col max-w-[180mm] mx-auto">
        <div className="flex items-start justify-between gap-6">
          <div className="flex items-center gap-3">
            <Image src="/images/tc.png" alt="Testing Company" width={48} height={48} className="h-12 w-12 object-contain" />
            <div className="space-y-1 leading-tight">
              <p className="text-xs uppercase tracking-[0.28em] text-[#6b7280]">Run</p>
              <h1 className="text-3xl font-extrabold leading-tight text-[#0b1a3c]">{appName}</h1>
              <h2 className="text-2xl font-semibold text-[#0b1a3c]">{finalTitle}</h2>
            </div>
          </div>
          <div className="text-right text-sm text-[#0b1a3c] space-y-1 min-w-35">
            <div className="font-semibold">Run ID: -</div>
            <div className="font-semibold">Projeto: -</div>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center gap-8">
          <div className="w-full flex items-center justify-center">
            <div className="w-55 h-55">
              <StatusChart stats={stats} hasData={total > 0} emptyLabel="Sem execuções" />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-sm">
            {statusList.map((item) => {
              const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
              const isTotal = item.label === "Total";
              return (
                <div key={item.label} className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${legendClassByLabel[item.label] ?? "bg-[#0b1a3c]"}`} />
                  <span className="font-semibold">{item.label}:</span>
                  <span className="font-bold">{item.value}</span>
                  {!isTotal && <span className="text-xs text-[#475569]">({pct}%)</span>}
                </div>
              );
            })}
          </div>

          <div className="text-xs text-center font-semibold text-[#0b1a3c]">
            Percentual geral: <span className="font-semibold text-[#0b1a3c]">{totalPctLabel}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
