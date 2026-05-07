"use client";

import type { ReactNode } from "react";
import { cn } from "@/components/ui/cn";
import DashboardContextSummary from "@/components/dashboard/DashboardContextSummary";

type DashboardHeaderProps = {
  kicker?: string;
  title: string;
  subtitle: string;
  contextLabel: string;
  chips?: string[];
  hiddenChipCount?: number;
  actions?: ReactNode;
  className?: string;
};

export default function DashboardHeader({
  kicker = "Dashboard",
  title,
  subtitle,
  contextLabel,
  chips = [],
  hiddenChipCount = 0,
  actions,
  className,
}: DashboardHeaderProps) {
  return (
    <section className={cn("rounded-[28px] border border-(--tc-border,#d7deea) bg-[linear-gradient(180deg,var(--tc-surface,#ffffff)_0%,var(--tc-surface-2,#f8fafc)_100%)] p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)]", className)}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-(--tc-accent,#ef0001)">{kicker}</p>
          <h1 className="text-[clamp(1.55rem,2vw,2.1rem)] font-extrabold tracking-[-0.04em] text-(--tc-text,#0b1a3c)">{title}</h1>
          <p className="max-w-3xl text-sm leading-6 text-(--tc-text-muted,#6b7280)">{subtitle}</p>
          <DashboardContextSummary contextLabel={contextLabel} chips={chips} hiddenChipCount={hiddenChipCount} />
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </section>
  );
}