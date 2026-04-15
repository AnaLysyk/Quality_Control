"use client";

import { useEffect, useState } from "react";

type TimelineEvent = {
  id?: string;
  type:
    | "release_created"
    | "run_created"
    | "run_failed"
    | "defect_created"
    | "defect_closed"
    | "gate_evaluated"
    | "gate_override";
  label: string;
  occurred_at: string;
  meta?: Record<string, unknown>;
};

export function QualityGateHistory({
  companySlug,
  releaseSlug,
  initialEvents = [],
}: {
  companySlug: string;
  releaseSlug: string;
  initialEvents?: TimelineEvent[];
}) {
  const [events, setEvents] = useState<TimelineEvent[]>(initialEvents);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    let active = true;
    fetch(`/api/empresas/${encodeURIComponent(companySlug)}/releases/${encodeURIComponent(releaseSlug)}/timeline`)
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        if (Array.isArray(data) && data.length) {
          setEvents(data as TimelineEvent[]);
        }
      })
      .catch(() => {
        if (!active) return;
      });
    return () => {
      active = false;
    };
  }, [open, companySlug, releaseSlug, initialEvents]);

  return (
    <div>
      <button
        data-testid="quality-gate-history"
        onClick={() => setOpen((v) => !v)}
        className="rounded border px-3 py-1 text-xs font-semibold"
      >
        Ver histórico
      </button>
      {open && (
        <div
          className="mt-4 border rounded p-3 bg-white max-w-xl"
          data-testid="quality-gate-history-list"
          data-release-timeline="true"
        >
          {events.length === 0 && <div className="text-xs text-gray-500">Nenhum histórico encontrado.</div>}
          <ul className="space-y-2" data-testid="release-timeline">
            {events.map((item, i) => {
              const reasons = Array.isArray(item.meta?.reasons)
                ? (item.meta.reasons as unknown[]).filter((r): r is string => typeof r === "string" && r.length > 0)
                : [];
              const overrideMeta =
                item.type === "gate_override" && item.meta?.override && typeof item.meta.override === "object"
                  ? (item.meta.override as { by?: string; reason?: string; at?: string })
                  : null;

              return (
                <li key={item.id || i} data-testid="gate-history-item" className="border-b pb-2">
                  <div data-testid="timeline-event">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-bold">{item.label}</span>
                      <span className="text-gray-500">
                        {item.occurred_at ? new Date(item.occurred_at).toLocaleString() : "Sem data"}
                      </span>
                    </div>
                    {reasons.length > 0 && (
                      <ul className="text-xs text-red-600 list-disc ml-4">
                        {reasons.map((r, idx) => (
                          <li key={idx}>{r}</li>
                        ))}
                      </ul>
                    )}
                    {overrideMeta && (
                      <div className="mt-1 rounded bg-yellow-50 border border-yellow-200 px-2 py-1 text-[11px] text-yellow-800">
                        Override por {overrideMeta.by ?? "admin"} em{" "}
                        {overrideMeta.at ? new Date(overrideMeta.at).toLocaleString() : "N/D"}{" "}
                        - {overrideMeta.reason ?? "Override aplicado"}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
