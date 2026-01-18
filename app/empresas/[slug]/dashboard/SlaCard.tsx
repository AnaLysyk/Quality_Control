"use client";
import React from "react";

export default async function SlaCard({ slug }: { slug: string }) {
  const res = await fetch(`/api/empresas/${encodeURIComponent(slug)}/metrics/quality`);
  const data = await res.json();
  return (
    <div data-testid="sla-card" className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-white p-4 shadow-sm flex flex-col items-start">
      <div className="text-xs uppercase tracking-[0.28em] text-(--tc-text-muted,#6b7280)">Defeitos fora do SLA</div>
      <div className={`mt-2 text-2xl font-extrabold ${data.overSlaCount > 0 ? "text-red-600" : "text-(--tc-text-primary,#0b1a3c)"}`}>
        {data.overSlaCount}
      </div>
      <div className="mt-1 text-xs text-(--tc-text-secondary,#4b5563)">Abertos: {data.openCount ?? 0}</div>
      {Array.isArray(data.overSlaDefects) && data.overSlaDefects.length > 0 && (
        <ul data-testid="sla-list" className="mt-2 list-disc pl-5 text-xs text-red-700">
          {data.overSlaDefects.map((d: any) => (
            <li key={d.id}>{d.title}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
