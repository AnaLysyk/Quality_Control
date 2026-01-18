"use client";
import React from "react";

function Badge({ status }: { status: string }) {
  if (status === "healthy") return <span className="ml-2 rounded bg-green-100 px-2 py-1 text-xs text-green-800">🟢 Saudável</span>;
  if (status === "attention") return <span className="ml-2 rounded bg-yellow-100 px-2 py-1 text-xs text-yellow-800">🟡 Atenção</span>;
  return <span className="ml-2 rounded bg-red-100 px-2 py-1 text-xs text-red-800">🔴 Em risco</span>;
}

export default async function QualityScoreCard({ slug }: { slug: string }) {
  const res = await fetch(`/api/empresas/${encodeURIComponent(slug)}/metrics/summary`);
  const data = await res.json();
  return (
    <div data-testid="quality-score" className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-white p-4 shadow-sm flex flex-col items-start">
      <div className="text-xs uppercase tracking-[0.28em] text-(--tc-text-muted,#6b7280)">Quality Score</div>
      <div className="mt-2 flex items-center text-2xl font-extrabold text-(--tc-text-primary,#0b1a3c)">
        {data.score}
        <Badge status={data.status} />
      </div>
    </div>
  );
}
