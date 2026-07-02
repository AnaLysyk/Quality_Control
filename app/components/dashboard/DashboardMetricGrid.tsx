"use client";

import type { DashboardMetricCard } from "@/lib/dashboard/types";

type DashboardMetricGridProps = {
  metrics: DashboardMetricCard[];
};

const TONE_CLASS: Record<NonNullable<DashboardMetricCard["tone"]>, string> = {
  default: "text-[var(--tc-text,#0b1a3c)]",
  positive: "text-emerald-700",
  warning: "text-amber-700",
  critical: "text-rose-700",
};

export default function DashboardMetricGrid({ metrics }: DashboardMetricGridProps) {
  if (metrics.length === 0) return null;

  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-6">
      {metrics.map((metric) => (
        <article key={metric.id} className="rounded-[22px] border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#ffffff)] p-4 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--tc-text-muted,#6b7280)]">{metric.label}</p>
          <p className={`mt-2 text-3xl font-black ${TONE_CLASS[metric.tone ?? "default"]}`}>{metric.value}</p>
          {metric.note ? <p className="mt-2 text-sm text-[var(--tc-text-muted,#6b7280)]">{metric.note}</p> : null}
        </article>
      ))}
    </section>
  );
}

