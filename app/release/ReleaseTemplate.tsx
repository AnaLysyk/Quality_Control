"use server";

import ExportPDFButton from "@/components/ExportPDFButton";
import Kanban from "@/components/Kanban";
import StatusChart from "@/components/StatusChart";
import { getQaseRunStats, getQaseRunKanban } from "@/services/qase";
import { releaseOrder, releasesData, type ReleaseId } from "./data";

const appLabelMap: Record<string, string> = {
  smart: "SMART",
  print: "PRINT",
  booking: "BOOKING",
  trust: "TRUST",
  "cidadao-smart": "CIDADÃO SMART",
  "mobile-griaule": "MOBILE GRIAULE",
};

interface ReleaseTemplateProps {
  slug: ReleaseId;
}

export async function ReleasePageContent({ slug }: ReleaseTemplateProps) {
  const meta = releasesData[slug];
  if (!meta) {
    throw new Error(`Release "${slug}" não encontrada nos dados.`);
  }

  const project = meta.app === "smart" ? "SFQ" : meta.app.toUpperCase();
  const runId = meta.runId;
  const run = await getQaseRunStats(project, runId);
  const kanban = await getQaseRunKanban(project, runId);

  const stats = {
    pass: run.stats.passed,
    fail: run.stats.failed,
    blocked: run.stats.blocked,
    notRun: run.stats.untested,
  };

  const description =
    (run.description ?? meta.summary ?? "")
      .trim()
      .replace(/\n/g, "<br />");

  const nowLabel = new Date().toLocaleString("pt-BR");
  const appName = appLabelMap[meta.app] ?? meta.app.toUpperCase();

  return (
    <div className="p-10 text-white space-y-10">
      <div className="flex justify-end">
        <ExportPDFButton fileName={`grafico-release-${slug}`} />
      </div>

      <div
        id="export-area"
        className="space-y-8 rounded-2xl"
        style={{
          backgroundColor: "#0D1117",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 30px 50px rgba(0,0,0,0.45)",
          maxWidth: "72rem",
          marginInline: "auto",
          padding: "40px",
        }}
      >
        <div className="flex flex-col gap-1">
          <p className="text-xs uppercase tracking-[0.4em] text-[#7CD343]">Aplicação</p>
          <h1 className="text-5xl font-extrabold text-[#7CD343]">{appName}</h1>
          <h2 className="text-4xl font-bold text-white">{meta.title}</h2>
          <p className="text-xs" style={{ color: "#9ca3af" }}>
            Gerado em: {nowLabel}
          </p>
        </div>

        {description && (
          <div
            className="leading-relaxed text-sm"
            style={{ color: "#d1d5db" }}
            dangerouslySetInnerHTML={{ __html: description }}
          />
        )}

        <div className="grid grid-cols-4 gap-5">
          <div
            className="rounded-xl p-6 text-center font-bold"
            style={{ backgroundColor: "#166534", color: "#f8fafc" }}
          >
            PASS
            <div className="text-3xl mt-3" style={{ color: "#f8fafc" }}>
              {stats.pass}
            </div>
          </div>
          <div
            className="rounded-xl p-6 text-center font-bold"
            style={{ backgroundColor: "#b91c1c", color: "#fff" }}
          >
            FAIL
            <div className="text-3xl mt-3">{stats.fail}</div>
          </div>
          <div
            className="rounded-xl p-6 text-center font-bold"
            style={{ backgroundColor: "#c27803", color: "#000" }}
          >
            BLOCKED
            <div className="text-3xl mt-3">{stats.blocked}</div>
          </div>
          <div
            className="rounded-xl p-6 text-center font-bold"
            style={{ backgroundColor: "#111827", color: "#f8fafc" }}
          >
            NOT RUN
            <div className="text-3xl mt-3">{stats.notRun}</div>
          </div>
        </div>

        <div
          className="mt-10 w-full rounded-xl"
          style={{
            backgroundColor: "#111827",
            border: "1px solid #1f2b3f",
            padding: "28px",
          }}
        >
          <h3 className="text-xl font-semibold mb-4 text-white">Gráfico da Release</h3>
          <div className="w-full h-[320px] min-h-[320px]">
            <StatusChart stats={stats} />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-bold text-white">Kanban da Execução</h2>
        <Kanban data={kanban} project={project} runId={runId} />
      </div>
    </div>
  );
}
