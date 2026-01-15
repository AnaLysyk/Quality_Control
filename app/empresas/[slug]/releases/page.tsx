"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { CreateManualReleaseButton } from "@/components/CreateManualReleaseButton";
import Breadcrumb from "@/components/Breadcrumb";
import { formatCompanyDisplayName } from "@/utils/formatCompanyDisplayName";

type CompanyRun = {
  slug: string;
  name: string;
  runId?: number;
  status?: string;
  createdAt?: string;
  source?: string;
  origin?: string;
};

export default function EmpresaReleasesPage() {
  const params = useParams();
  const slug = (params?.slug as string) || "";
  const companyName = useMemo(() => formatCompanyDisplayName(slug) || slug, [slug]);

  const [query, setQuery] = useState("");
  const [runs, setRuns] = useState<CompanyRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/empresas/${encodeURIComponent(slug)}/runs`, { cache: "no-store" });
        const json = await res.json().catch(() => null);

        if (!res.ok) {
          const message =
            typeof (json as { message?: unknown } | null)?.message === "string"
              ? String((json as { message?: unknown }).message)
              : `Erro ao carregar releases (${res.status})`;
          setRuns([]);
          setError(message);
          return;
        }

        const items = Array.isArray((json as any)?.runs) ? ((json as any).runs as CompanyRun[]) : [];
        setRuns(items);
      } catch {
        setRuns([]);
        setError("Erro ao carregar releases");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [slug]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return runs;
    return runs.filter((r) => (r.slug || "").toLowerCase().includes(q) || (r.name || "").toLowerCase().includes(q));
  }, [runs, query]);

  return (
    <div className="min-h-screen bg-(--page-bg,#ffffff) text-(--page-text,#0b1a3c)">
      <div className="mx-auto w-full max-w-7xl px-4 pt-4 sm:px-6 sm:pt-6 lg:px-10 lg:pt-10">
        <div className="space-y-2">
          <Breadcrumb
            items={[
              { label: "Empresas", href: "/empresas" },
              {
                label: companyName,
                href: `/empresas/${encodeURIComponent(slug)}/home`,
                title: companyName,
              },
              { label: "Releases" },
            ]}
          />

          <h1 className="text-2xl sm:text-3xl font-extrabold text-(--tc-text-primary,#0b1a3c) leading-tight wrap-break-word">
            Releases — {companyName}
          </h1>
          <p className="text-sm sm:text-base text-(--tc-text-secondary,#4b5563)">
            Lista completa de releases desta empresa. Runs manuais e integradas aparecem aqui conforme configurado.
          </p>
        </div>
      </div>

      <div className="mx-auto mt-4 w-full max-w-7xl px-4 sm:mt-6 sm:px-6 lg:px-10 space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <CreateManualReleaseButton companySlug={slug} />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar releases"
              className="w-full md:w-90 rounded-xl border border-(--tc-border) bg-white px-4 py-3 text-sm text-(--tc-text,#0f172a) placeholder:text-(--tc-text-muted) focus:border-(--tc-accent) focus:outline-none focus:ring-2 focus:ring-(--tc-accent)/30"
            />
          </div>
        </div>

        {loading && <p className="text-sm text-(--tc-text-muted)">Carregando releases...</p>}
        {!loading && error && <p className="text-sm text-red-600">{error}</p>}
        {!loading && !error && !filtered.length && (
          <p className="text-sm text-(--tc-text-muted)">Nenhuma release encontrada para esta empresa.</p>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((run) => (
            <Link
              key={run.slug}
              href={`/empresas/${encodeURIComponent(slug)}/runs/${encodeURIComponent(run.slug)}`}
              className="group rounded-2xl border border-(--tc-border)/40 bg-white p-4 shadow-sm transition hover:border-(--tc-accent)/50 hover:shadow-[0_12px_30px_var(--tc-accent-soft)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[12px] uppercase tracking-[0.14em] text-(--tc-text-muted) truncate" title={run.slug}>
                    {run.slug}
                  </p>
                  <h2 className="mt-1 text-base font-semibold text-(--tc-text-primary,#0b1a3c) truncate" title={run.name}>
                    {run.name || run.slug}
                  </h2>
                </div>
                <span className="shrink-0 rounded-full bg-(--tc-surface,#f1f5f9) px-3 py-1 text-[11px] font-semibold text-(--tc-text-muted)">
                  {(run.origin ?? run.source ?? "").toString().toUpperCase() || "RELEASE"}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-(--tc-text-muted)">
                <span>Status: {run.status ?? "-"}</span>
                <span>Criado: {run.createdAt ? new Date(run.createdAt).toLocaleDateString("pt-BR") : "-"}</span>
                <span className="text-sm font-semibold text-(--tc-accent)">Abrir →</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
