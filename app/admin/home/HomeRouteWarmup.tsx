"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const OVERVIEW_ROUTE = "/admin/visao-geral";
const OVERVIEW_DATA_ROUTES = [
  "/api/admin/quality/overview?period=30",
  "/api/admin/defeitos",
  "/api/admin/audit-logs?limit=12&period=30",
];

export default function HomeRouteWarmup() {
  const router = useRouter();

  useEffect(() => {
    router.prefetch(OVERVIEW_ROUTE);

    const controller = new AbortController();

    const warmup = () => {
      void fetch(OVERVIEW_ROUTE, {
        credentials: "include",
        signal: controller.signal,
      }).catch(() => undefined);

      for (const route of OVERVIEW_DATA_ROUTES) {
        void fetch(route, {
          credentials: "include",
          signal: controller.signal,
        }).catch(() => undefined);
      }
    };

    const idleId =
      "requestIdleCallback" in window
        ? window.requestIdleCallback(warmup, { timeout: 1800 })
        : window.setTimeout(warmup, 900);

    return () => {
      controller.abort();

      if ("cancelIdleCallback" in window && typeof idleId === "number") {
        window.cancelIdleCallback(idleId);
      } else if (typeof idleId === "number") {
        window.clearTimeout(idleId);
      }
    };
  }, [router]);

  return null;
}
