"use client";

import { useEffect, useMemo, useState } from "react";


type Defect = {
  id: string;
  title: string;
  status: "open" | "in_progress" | "done";
  openedAt: string;
  closedAt: string | null;
  mttrMs: number | null;
  origin: "manual" | "qase";
};

function formatMTTR(ms?: number | null) {
  if (!ms) return "—";
  const minutes = Math.floor(ms / 60000);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
}

export default function MttrSummary({ slug }: { slug: string }) {
  const [loading, setLoading] = useState(true);
  const [mttrMs, setMttrMs] = useState<number | null>(null);
  const [openCount, setOpenCount] = useState(0);
  const [closedCount, setClosedCount] = useState(0);

  useEffect(() => {
    let canceled = false;
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/empresas/${encodeURIComponent(slug)}/defeitos`, { cache: "no-store" });
        const json = await res.json().catch(() => null);
        const items = Array.isArray(json?.items) ? (json.items as Defect[]) : [];
        const closed = items.filter((d) => d.mttrMs != null);
        const avgMttr = closed.length ? closed.reduce((acc, d) => acc + (d.mttrMs || 0), 0) / closed.length : null;
        if (!canceled) {
          setClosedCount(closed.length);
          setOpenCount(items.length - closed.length);
          setMttrMs(avgMttr);
        }
      } catch {
        if (!canceled) {
          setClosedCount(0);
          setOpenCount(0);
          setMttrMs(null);
        }
      } finally {
        if (!canceled) setLoading(false);
      }
    };
    load();
    return () => {
      canceled = true;
    };
  }, [slug]);

  return (
    <section className="grid gap-3 md:grid-cols-3">
      <div className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-white p-4 shadow-sm">
        <p className="text-xs uppercase tracking-[0.28em] text-(--tc-text-muted,#6b7280)">MTTR</p>
        <p className="mt-2 text-2xl font-extrabold text-(--tc-text-primary,#0b1a3c)" data-testid="metric-mttr">
          {loading || mttrMs == null ? "-" : formatMTTR(mttrMs)}
        </p>
      </div>
      <div className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-white p-4 shadow-sm">
        <p className="text-xs uppercase tracking-[0.28em] text-(--tc-text-muted,#6b7280)">Defeitos abertos</p>
        <p className="mt-2 text-2xl font-extrabold text-(--tc-text-primary,#0b1a3c)" data-testid="metric-defects-open">
          {openCount}
        </p>
      </div>
      <div className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-white p-4 shadow-sm">
        <p className="text-xs uppercase tracking-[0.28em] text-(--tc-text-muted,#6b7280)">Defeitos fechados</p>
        <p className="mt-2 text-2xl font-extrabold text-(--tc-text-primary,#0b1a3c)" data-testid="metric-defects-closed">
          {closedCount}
        </p>
      </div>
    </section>
  );
}
