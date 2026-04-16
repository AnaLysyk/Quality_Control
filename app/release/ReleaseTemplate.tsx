import "server-only";
import StatusChart from "@/components/StatusChart";
import Image from "next/image";
import { getRunDetailViewModel } from "@/lib/runDetailViewModel";
import { RunHero } from "./components/RunHero";
import { RunChartSection } from "./components/RunChartSection";
import { RunKanbanSection } from "./components/RunKanbanSection";

const legendClassByLabel: Record<string, string> = {
  Pass: "bg-[#22c55e]",
  Fail: "bg-[#ef4444]",
  Blocked: "bg-[#facc15]",
  "Not Run": "bg-[#64748b]",
  Total: "bg-[#0f172a]",
};

type ReleaseTemplateProps = {
  appName: string;
  finalTitle: string;
  stats: { pass: number; fail: number; blocked: number; notRun: number };
  total: number;
};

type ReleasePageContentProps = { slug: string; companySlug?: string };

export async function ReleasePageContent({ slug, companySlug }: ReleasePageContentProps) {
  const vm = await getRunDetailViewModel(slug, companySlug);

  if (!vm) {
    return <div className="p-6 text-sm text-red-400">Run não encontrada.</div>;
  }

  return (
    <div className="w-full py-6 sm:py-8 text-(--tc-text,#0b1a3c)">
      <div className="w-full space-y-5">
        {/* ── Main card — hero + stats ── */}
        <div className="overflow-hidden rounded-3xl shadow-[0_20px_50px_rgba(15,23,42,0.16)]">
          <div className="bg-[linear-gradient(135deg,#031843_0%,#0b2d72_55%,#57153f_80%,#b01a33_100%)] p-6 text-white sm:p-8">
            <RunHero vm={vm} />
            <RunChartSection vm={vm} />
          </div>
        </div>

        {/* ── Kanban — visual continuation ── */}
        <RunKanbanSection vm={vm} />
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
