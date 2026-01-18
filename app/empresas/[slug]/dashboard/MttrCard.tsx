"use client";
import React from "react";

function formatDuration(ms?: number | null) {
  if (!ms) return "—";
  const minutes = Math.floor(ms / 60000);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
}

export default async function MttrCard({ slug, period = "30d" }: { slug: string; period?: string }) {
  const res = await fetch(`/api/empresas/${encodeURIComponent(slug)}/metrics/mttr?period=${period}`);
  const data = await res.json();
  return (
    <div data-testid="mttr-card" className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-white p-4 shadow-sm flex flex-col items-start">
      <div className="text-xs uppercase tracking-[0.28em] text-(--tc-text-muted,#6b7280)">MTTR médio</div>
      <div className="mt-2 text-2xl font-extrabold text-(--tc-text-primary,#0b1a3c)">
        {formatDuration(data.avgMttrMs)}
      </div>
      <div className="mt-1 text-xs text-(--tc-text-secondary,#4b5563)">
        Fechados: {data.countClosed ?? 0}
      </div>
      <div className="mt-1 text-xs text-(--tc-text-secondary,#4b5563)">
        Manual: {formatDuration(data.byOrigin?.manual)} | Qase: {formatDuration(data.byOrigin?.qase)}
      </div>
    </div>
  );
}
