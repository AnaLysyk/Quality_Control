"use client";

import { useMemo } from "react";

type UseDashboardFiltersOptions = {
  chips: Array<string | null | undefined>;
  fallback?: string;
  maxVisible?: number;
};

export function useDashboardFilters({ chips, fallback = "Sem filtros ativos", maxVisible = 4 }: UseDashboardFiltersOptions) {
  return useMemo(() => {
    const activeChips = chips
      .map((chip) => (typeof chip === "string" ? chip.trim() : ""))
      .filter(Boolean);
    const compactChips = activeChips.slice(0, maxVisible);
    return {
      activeChips,
      compactChips,
      hiddenChipCount: Math.max(0, activeChips.length - compactChips.length),
      hasActiveFilters: activeChips.length > 0,
      summary: activeChips.length > 0 ? activeChips.join(" Â· ") : fallback,
    };
  }, [chips, fallback, maxVisible]);
}

