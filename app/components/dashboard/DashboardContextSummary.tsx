"use client";

import { cn } from "@/components/ui/cn";

type DashboardContextSummaryProps = {
  contextLabel: string;
  chips?: string[];
  hiddenChipCount?: number;
  className?: string;
};

export default function DashboardContextSummary({
  contextLabel,
  chips = [],
  hiddenChipCount = 0,
  className,
}: DashboardContextSummaryProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-sm text-[var(--tc-text-muted,#6b7280)]">
        <span className="font-semibold text-[var(--tc-text,#0b1a3c)]">Contexto atual:</span> {contextLabel}
      </p>
      {chips.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {chips.map((chip) => (
            <span
              key={chip}
              className="inline-flex rounded-full border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#ffffff)] px-3 py-1.5 text-[11px] font-semibold tracking-[0.04em] text-[var(--tc-text,#0b1a3c)]"
            >
              {chip}
            </span>
          ))}
          {hiddenChipCount > 0 ? (
            <span className="inline-flex rounded-full border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#ffffff)] px-3 py-1.5 text-[11px] font-semibold tracking-[0.04em] text-[var(--tc-text,#0b1a3c)]">
              +{hiddenChipCount}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

