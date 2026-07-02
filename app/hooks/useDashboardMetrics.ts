"use client";

import { useMemo } from "react";
import type { DashboardMetricCard } from "@/lib/dashboard/types";

export function useDashboardMetrics(metrics: DashboardMetricCard[]) {
  return useMemo(
    () => metrics.filter((metric) => metric && String(metric.value).trim().length > 0),
    [metrics],
  );
}

