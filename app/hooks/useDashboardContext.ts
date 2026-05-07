"use client";

import { useMemo } from "react";
import { resolveDashboardContext, type DashboardUserLike } from "@/lib/dashboard/context";
import type { DashboardCompanyOption, DashboardContextLabels } from "@/lib/dashboard/types";

type UseDashboardContextOptions = {
  user?: DashboardUserLike | null;
  companies?: DashboardCompanyOption[];
  selectedCompanySlugs?: string[];
  fixedCompanySlug?: string | null;
  labels?: DashboardContextLabels;
};

export function useDashboardContext(options: UseDashboardContextOptions) {
  return useMemo(
    () => resolveDashboardContext(options),
    [options],
  );
}