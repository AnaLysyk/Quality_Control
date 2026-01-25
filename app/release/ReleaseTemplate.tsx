import "server-only";
import StatusChart from "@/components/StatusChart";
import Kanban from "@/components/Kanban";
import ExportPDFButton from "@/components/ExportPDFButton";
import ManualReleaseActions from "@/components/ManualReleaseActions";
import { EditReleaseButton } from "@/components/EditReleaseButton";
import { ManualStatsForm } from "@/components/ManualStatsForm";
import { getReleaseBySlug, type ReleaseEntry } from "./data";
import { getRunDetails, getQaseRunKanban } from "@/integrations/qase";
import type { KanbanData } from "@/types/kanban";
import { slugifyRelease } from "@/lib/slugifyRelease";
import type { Release } from "@/types/release";
import { getAppMeta } from "@/lib/appMeta";
import { evaluateQualityGate } from "@/lib/quality";
import Image from "next/image";
import { QualityGateHistory } from "./QualityGateHistory";
import { readQualityGateHistory } from "@/lib/qualityGateHistory";
import { calculateQualityScore } from "@/lib/qualityScore";

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
  "mobile-griaule": "app-color-gmt",
};

export async function ReleasePageContent({ slug, companySlug }: ReleasePageContentProps) {
  const normalizedSlug = slugifyRelease(slug);
  let manualRelease: Release | null = null;
  let apiRelease: ReleaseEntry | null = null;

  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const res = await fetch(`${baseUrl}/api/releases-manual/${normalizedSlug}`, { cache: "no-store" });
    if (res.ok) {
      manualRelease = (await res.json()) as Release;
    }
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
        summary: "Execucao integrada via Qase.",
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
    return <div className="p-6 text-sm text-red-400">Run nao encontrada.</div>;
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
  let kanbanData: KanbanData = { pass: [], fail: [], blocked: [], notRun: [] };

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
      try {
        kanbanData = await getQaseRunKanban(projectCode, runId, qaseSlugKey);
      } catch {
        /* ignore */
      }
    }
  }

  const editable = source === "MANUAL";
  const total = stats.pass + stats.fail + stats.blocked + stats.notRun;
  const gate = evaluateQualityGate(total > 0 ? stats : null);
  const history = await readQualityGateHistory(companySlug || "griaule", releaseData.slug);
  const latestGate = history[0] ?? null;
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

  return (
    <div className="min-h-screen bg-linear-to-b from-white via-white to-[#e6f0ff] text-[#0b1a3c] px-4 py-6 md:px-10 md:py-10">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.28em] text-(--tc-accent)">Run</p>
            <h1 className="text-3xl md:text-4xl font-extrabold text-[#0b1a3c]">
              {(releaseData as ReleaseEntry).title ?? releaseData.slug ?? "Run"}
            </h1>
            {(releaseData as ReleaseEntry).summary && (
              <p className="text-(--tc-text-secondary)">{(releaseData as ReleaseEntry).summary}</p>
            )}
          </div>
          <div className="flex flex-col items-start md:items-end gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className={`inline-flex items-center justify-center gap-2 rounded-full px-3 py-1 text-[12px] font-bold uppercase tracking-[0.12em] text-white shadow-[0_8px_20px_rgba(0,0,0,0.25)] border border-(--app-tag-color) bg-(--app-tag-color) ${appColorClass}`}>
                <span className="h-3 w-3 rounded-full bg-white/90 ring-2 ring-white/40" />
                <span className="leading-none">{appMeta.label}</span>
              </div>
              <div
                data-testid="quality-gate-status"
                data-status={gate.status}
                className="inline-flex items-center rounded-full border border-(--tc-border,#e5e7eb) bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-(--tc-text-muted,#6b7280)"
              >
                Gate: {gate.status}
              </div>
              <div
                data-testid="quality-score"
                className="inline-flex items-center rounded-full border border-(--tc-border,#e5e7eb) bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-(--tc-text-muted,#0b1a3c)"
              >
                Score: {qualityScore}
              </div>
              <a
                data-testid="release-export"
                href={`/api/empresas/${encodeURIComponent(companySlug || "griaule")}/releases/${encodeURIComponent(
                  releaseData.slug,
                )}/export?format=csv`}
                className="inline-flex items-center rounded-full border border-(--tc-border,#e5e7eb) bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-(--tc-text-muted,#6b7280) hover:border-(--tc-accent,#ef0001)"
              >
                Exportar
              </a>
              <a
                data-testid="release-export-pdf"
                href={`/api/empresas/${encodeURIComponent(companySlug || "griaule")}/releases/${encodeURIComponent(
                  releaseData.slug,
                )}/export?format=pdf`}
                className="inline-flex items-center rounded-full border border-(--tc-border,#e5e7eb) bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-(--tc-text-muted,#6b7280) hover:border-(--tc-accent,#ef0001)"
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
            {/* Quality Gate History UI */}
            <QualityGateHistory companySlug={companySlug || "griaule"} releaseSlug={releaseData.slug} />
          </div>
        </div>

        {source === "MANUAL" && <ManualStatsForm slug={releaseData.slug} initialStats={stats} />}

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "Pass", value: stats.pass },
            { label: "Fail", value: stats.fail },
            { label: "Blocked", value: stats.blocked },
            { label: "Not Run", value: stats.notRun },
            { label: "Total", value: total },
          ].map((item) => {
            return (
              <div
                key={item.label}
                className="rounded-2xl px-4 py-4 flex items-center justify-between border border-[#e5e7eb] bg-white shadow-[0_10px_25px_rgba(0,0,0,0.06)]"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`h-3.5 w-3.5 rounded-full ring-2 ring-white/50 ${legendClassByLabel[item.label] ?? "bg-[#0f172a]"}`}
                  />
                  <span className="text-sm font-semibold text-[#0b1a3c]">{item.label}</span>
                </div>
                <div className="text-right leading-tight">
                  <div
                    className="text-xl font-extrabold rounded-lg px-3 py-1 border border-[#e5e7eb] bg-[#f8fafc] text-[#0b1a3c]"
                  >
                    {item.value}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="w-full flex justify-center">
          <div
            id="pdf-summary"
            className="w-full max-w-[200mm] min-h-[270mm] mx-auto rounded-2xl border border-[#e5e7eb] bg-white text-[#0b1a3c] p-6 md:p-8 space-y-6"
          >
            <section className="space-y-4 text-[#0b1a3c]">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <Image src="/images/tc.png" alt="Testing Company" width={44} height={44} className="h-11 w-auto" />
                  <div className="space-y-1 leading-tight">
                    <p className="text-xs uppercase tracking-[0.28em] text-[#6b7280]">Run</p>
                    <h1 className="text-2xl font-extrabold leading-tight text-[#0b1a3c]">
                      {releaseData.name ?? (releaseData as ReleaseEntry).title ?? "Run"}
                    </h1>
                  </div>
                </div>
                <div className="text-left sm:text-right text-sm text-[#0b1a3c] space-y-1 min-w-0 sm:min-w-40">
                  <div className="font-semibold">Run ID: {(releaseData as ReleaseEntry).runId ?? "-"}</div>
                  <div className="font-semibold">Projeto: {appMeta.label}</div>
                </div>
              </div>

              <div className="flex flex-col items-center gap-4">
                <StatusChart stats={stats} hasData={hasData} emptyLabel="Sem execucoes" />
                <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
                  {[
                    { label: "Pass", value: stats.pass },
                    { label: "Fail", value: stats.fail },
                    { label: "Blocked", value: stats.blocked },
                    { label: "Not Run", value: stats.notRun },
                    {
                      label: "Total",
                      value: stats.pass + stats.fail + stats.blocked + stats.notRun,
                    },
                  ].map((item) => {
                    const grandTotal = stats.pass + stats.fail + stats.blocked + stats.notRun;
                    const pct = grandTotal > 0 ? Math.round((item.value / grandTotal) * 100) : 0;
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
              </div>
            </section>
            {source === "API" && (
              <div className="w-full mt-10 text-xs text-center text-[#0b1a3c] font-semibold">
                Dados integrados via Qase (run executada).
              </div>
            )}
            {source === "MANUAL" && (
              <div className="w-full mt-10 text-xs text-center text-[#0b1a3c] font-semibold">
                Dados preenchidos manualmente.
              </div>
            )}
          </div>
        </div>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Kanban</h2>
          </div>
          <div className="rounded-2xl border border-(--tc-border)/30 bg-(--tc-primary)/4 p-4">
            <Kanban
              data={kanbanData}
              project={projectKey}
              runId={(releaseData as ReleaseEntry).runId ?? 0}
              qaseProject={projectCode}
              companySlug={companySlug}
              persistEndpoint={source === "MANUAL" ? `/api/releases-manual/${releaseData.slug}/cases` : apiPersistEndpoint}
              editable={editable}
              allowStatusChange={editable}
              allowLinkEdit={canPersistApiLinks}
            />
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
            <Image src="/images/tc.png" alt="Testing Company" width={48} height={48} className="h-12 w-auto" />
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
              <StatusChart stats={stats} hasData={total > 0} emptyLabel="Sem execucoes" />
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
