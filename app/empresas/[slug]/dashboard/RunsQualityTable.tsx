"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Badge from "@/components/Badge";

export default function RunsQualityTable({ slug }: { slug: string }) {
  const [runs, setRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let canceled = false;
    setLoading(true);
    fetch(`/api/empresas/${encodeURIComponent(slug)}/runs/quality`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (!canceled) setRuns(data.runs || []);
      })
      .catch(() => {
        if (!canceled) setRuns([]);
      })
      .finally(() => {
        if (!canceled) setLoading(false);
      });
    return () => { canceled = true; };
  }, [slug]);

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="text-lg font-bold mb-2 text-(--page-text,#0b1a3c)">Qualidade por Run</h2>
      {loading ? (
        <p className="text-sm text-(--tc-text-muted,#6b7280)">Carregando...</p>
      ) : (
        <table data-testid="runs-quality-table" className="min-w-full border-separate border-spacing-y-1">
          <thead>
            <tr className="text-xs uppercase text-(--tc-text-muted,#6b7280)">
              <th className="text-left px-2 py-1">Run</th>
              <th className="text-left px-2 py-1">Defeitos</th>
              <th className="text-left px-2 py-1">MTTR</th>
              <th className="text-left px-2 py-1">SLA</th>
              <th className="text-left px-2 py-1">Score</th>
            </tr>
          </thead>
          <tbody>
            {runs.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center text-(--tc-text-muted,#6b7280) py-4">Nenhum dado encontrado</td>
              </tr>
            ) : (
              runs.map((r) => (
                <tr key={r.run} className="bg-white hover:bg-(--tc-surface,#f9fafb) transition">
                  <td className="px-2 py-1 font-semibold text-(--page-text,#0b1a3c)">
                    <Link
                      href={`/empresas/${encodeURIComponent(slug)}/defeitos?run=${encodeURIComponent(r.run)}`}
                      className="text-(--tc-accent,#ef0001) hover:underline"
                      data-testid="run-drilldown-link"
                    >
                      {r.run}
                    </Link>
                  </td>
                  <td className="px-2 py-1">{r.defectCount}</td>
                  <td className="px-2 py-1">{r.mttr ?? "—"}</td>
                  <td className="px-2 py-1">{r.overSlaCount}</td>
                  <td className="px-2 py-1"><Badge status={r.status} /> <span className="ml-1 font-mono">{r.score}</span></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}
    </section>
  );
}
