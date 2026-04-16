import StatusChart from "@/components/StatusChart";
import { ManualStatsForm } from "@/components/ManualStatsForm";
import type { RunDetailViewModel } from "@/lib/runDetailViewModel";
import type { ReleaseEntry } from "../data";
import styles from "./RunChartSection.module.css";

const STATUS_ITEMS: { label: string; key: "pass" | "fail" | "blocked" | "notRun"; color: string; bg: string }[] = [
  { label: "Pass",    key: "pass",    color: "#22c55e", bg: "bg-emerald-500/15 border-emerald-400/30" },
  { label: "Fail",    key: "fail",    color: "#ef4444", bg: "bg-red-500/15 border-red-400/30" },
  { label: "Blocked", key: "blocked", color: "#facc15", bg: "bg-amber-500/15 border-amber-400/30" },
  { label: "Not Run", key: "notRun",  color: "#64748b", bg: "bg-slate-500/15 border-slate-400/30" },
];

export function RunChartSection({ vm }: { vm: RunDetailViewModel }) {
  const pct = (v: number) => (vm.total > 0 ? Math.round((v / vm.total) * 100) : 0);

  return (
    <>
      {vm.source === "MANUAL" && (
        <ManualStatsForm slug={vm.releaseData.slug} initialStats={vm.stats} />
      )}

      <div id="pdf-summary" className="pt-6 border-t border-white/10">
        {/* ── Stats bar (proportional) ── */}
        {vm.hasData && (
          <div className="flex h-2.5 w-full rounded-full overflow-hidden mb-6">
            {STATUS_ITEMS.map((item) => {
              const val = vm.stats[item.key];
              if (!val) return null;
              return (
                <div
                  key={item.key}
                  className={styles.barSegment}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  {...{ style: { "--segment-width": `${pct(val)}%`, "--segment-color": item.color } as any }}
                  title={`${item.label}: ${val} (${pct(val)}%)`}
                />
              );
            })}
          </div>
        )}

        {/* ── Chart + Stat cards ── */}
        <div className="flex flex-col xl:flex-row items-center xl:items-stretch gap-8">
          {/* Donut chart — large presence */}
          <div className="w-full max-w-md xl:max-w-sm">
            <StatusChart stats={vm.stats} hasData={vm.hasData} emptyLabel="Sem execuções" />
          </div>

          {/* Stat cards — right side */}
          <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-2 gap-3 content-center">
            {STATUS_ITEMS.map((item) => {
              const val = vm.stats[item.key];
              const percent = pct(val);
              return (
                <div
                  key={item.key}
                  className={`rounded-xl border px-4 py-3.5 ${item.bg}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`h-2.5 w-2.5 rounded-full shrink-0 ${styles.statusDot}`}
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      {...{ style: { "--dot-color": item.color } as any }}
                    />
                    <span className="text-[11px] uppercase tracking-[0.15em] text-white/50 font-semibold">
                      {item.label}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-extrabold text-white">{val}</span>
                    <span className="text-sm text-white/40">{percent}%</span>
                  </div>
                </div>
              );
            })}
            {/* Total card */}
            <div className="col-span-2 sm:col-span-4 xl:col-span-2 rounded-xl border border-white/15 bg-white/5 px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-[0.15em] text-white/50 font-semibold">
                  Total de casos
                </span>
                <span className="text-xl font-extrabold text-white">{vm.total}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Source indicator ── */}
        <p className="text-[11px] text-white/30 mt-4 text-right">
          {vm.source === "API"
            ? "Dados integrados via Qase."
            : "Dados preenchidos manualmente."}
        </p>
      </div>
    </>
  );
}
