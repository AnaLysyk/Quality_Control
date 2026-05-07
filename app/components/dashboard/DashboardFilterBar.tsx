"use client";

import type { ReactNode } from "react";

type DashboardFilterBarProps = {
  title?: string;
  description?: string;
  chips?: string[];
  hiddenChipCount?: number;
  actions?: ReactNode;
};

export default function DashboardFilterBar({
  title = "Filtros ativos",
  description = "O dashboard reage ao contexto atual e recalcula a leitura executiva com base nesses filtros.",
  chips = [],
  hiddenChipCount = 0,
  actions,
}: DashboardFilterBarProps) {
  return (
    <section className="rounded-3xl border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) p-4 shadow-[0_14px_30px_rgba(15,23,42,0.04)]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1.5">
          <h2 className="text-sm font-bold text-(--tc-text,#0b1a3c)">{title}</h2>
          <p className="text-sm text-(--tc-text-muted,#6b7280)">{description}</p>
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
      </div>
      {chips.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {chips.map((chip) => (
            <span
              key={chip}
              className="inline-flex rounded-full border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-3 py-1.5 text-[11px] font-semibold tracking-[0.04em] text-(--tc-text,#0b1a3c)"
            >
              {chip}
            </span>
          ))}
          {hiddenChipCount > 0 ? (
            <span className="inline-flex rounded-full border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-3 py-1.5 text-[11px] font-semibold tracking-[0.04em] text-(--tc-text,#0b1a3c)">
              +{hiddenChipCount}
            </span>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}