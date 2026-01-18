"use client";
import React from "react";
import { Trend } from "./Trend";

export default async function MttrTrendCard({ slug }: { slug: string }) {
  const res = await fetch(`/api/empresas/${encodeURIComponent(slug)}/metrics/trend`);
  const data = await res.json();
  return (
    <div data-testid="mttr-trend" className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-white p-4 shadow-sm flex flex-col items-start">
      <div className="text-xs uppercase tracking-[0.28em] text-(--tc-text-muted,#6b7280)">Tendência MTTR (7d)</div>
      <div className="mt-2 flex items-center gap-2 text-2xl font-extrabold text-(--tc-text-primary,#0b1a3c)">
        {data.mttr.current != null ? `${data.mttr.current}h` : "—"}
        <Trend delta={data.mttr.delta} />
      </div>
      <div className="mt-1 text-xs text-(--tc-text-secondary,#4b5563)">
        Anterior: {data.mttr.previous != null ? `${data.mttr.previous}h` : "—"}
      </div>
    </div>
  );
}
