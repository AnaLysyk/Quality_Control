"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { CreateManualReleaseButton } from "@/components/CreateManualReleaseButton";
import { formatRunTitle } from "@/lib/runPresentation";

type ManualRun = {
  slug: string;
  name: string;
  createdAt?: string | null;
  status?: string | null;
  stats: { pass: number; fail: number; blocked: number; notRun: number };
  metrics?: { passRate?: number; total?: number };
  passRate?: number | null;
};

function normalizeRuns(data: unknown[]): ManualRun[] {
  return data
    .map((item) => {
      const rec = (item ?? {}) as Record<string, unknown>;
      const stats = (rec.stats ?? {}) as ManualRun["stats"];
      return {
        slug: String(rec.slug ?? rec.id ?? ""),
        name: formatRunTitle(String(rec.name ?? rec.title ?? rec.slug ?? "Run manual"), "Run manual"),
        createdAt: typeof rec.createdAt === "string" ? rec.createdAt : null,
        status: typeof rec.status === "string" ? rec.status : null,
        stats: {
          pass: Number(stats.pass ?? 0),
          fail: Number(stats.fail ?? 0),
          blocked: Number(stats.blocked ?? 0),
          notRun: Number(stats.notRun ?? 0),
        },
        metrics: typeof rec.metrics === "object" && rec.metrics ? (rec.metrics as ManualRun["metrics"]) : undefined,
        passRate: typeof rec.passRate === "number" ? rec.passRate : null,
      } satisfies ManualRun;
    })
    .filter((run) => run.slug.length > 0);
}

export default function CompanyRunsPage() {
  const params = useParams();
  const slugParam = params?.slug;
  const companySlug = Array.isArray(slugParam) ? slugParam[0] : slugParam;
  const [runs, setRuns] = useState<ManualRun[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!companySlug) return;
    let active = true;
    fetch(`/api/releases-manual?clientSlug=${encodeURIComponent(companySlug)}&kind=run`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        setRuns(normalizeRuns(Array.isArray(data) ? data : []));
      })
      .catch(() => {
        if (!active) return;
        setRuns([]);
      });
    return () => {
      active = false;
    };
  }, [companySlug]);

  const filteredRuns = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return runs;
    return runs.filter((run) => run.name.toLowerCase().includes(term) || run.slug.toLowerCase().includes(term));
  }, [runs, search]);

  return (
    <div className="min-h-screen bg-(--page-bg,#f5f6fa) text-(--page-text,#0b1a3c) px-4 py-8 sm:px-6 lg:px-10" data-testid="runs-page">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-col gap-4 rounded-3xl bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-(--tc-accent,#ef0001)">Runs</p>
            <h1 className="mt-2 text-3xl font-extrabold">Execucoes da empresa</h1>
            <p className="mt-2 text-sm text-(--tc-text-secondary,#4b5563)">
              Crie novas runs manuais e acompanhe o historico de qualidade.
            </p>
          </div>
          <CreateManualReleaseButton companySlug={companySlug} />
        </header>

        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h2 className="text-lg font-semibold">Lista de runs</h2>
            <input
              data-testid="runs-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar run por nome ou slug"
              className="w-full md:w-72 rounded-full border border-(--tc-border,#e5e7eb) px-4 py-2 text-sm outline-none focus:border-(--tc-accent,#ef0001)"
            />
          </div>

          <div className="mt-4 grid gap-3" data-testid="runs-list">
            {filteredRuns.length === 0 && (
              <p className="text-sm text-(--tc-text-muted)">Nenhuma run encontrada.</p>
            )}
            {filteredRuns.map((run, idx) => {
              const total = run.stats.pass + run.stats.fail + run.stats.blocked + run.stats.notRun;
              const passRate = total > 0 ? Math.round((run.stats.pass / total) * 100) : 0;
              return (
                <div key={`${run.slug ?? 'run'}-${run.createdAt ?? idx}`} className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#f9fafb) p-4">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <Link
                      href={`/empresas/${encodeURIComponent(companySlug ?? "")}/runs/${encodeURIComponent(run.slug)}`}
                      className="text-base font-semibold text-(--tc-accent,#ef0001)"
                    >
                      {run.name}
                    </Link>
                    <span className="text-xs text-(--tc-text-muted)">Pass rate: {passRate}%</span>
                  </div>
                  <div className="mt-2 text-xs text-(--tc-text-secondary,#4b5563)">
                    Pass: {run.stats.pass} · Fail: {run.stats.fail} · Blocked: {run.stats.blocked} · Not run: {run.stats.notRun}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
