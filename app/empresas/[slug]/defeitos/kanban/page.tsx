"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Kanban from "@/components/Kanban";
import { useAuthUser } from "@/hooks/useAuthUser";
import type { KanbanData } from "@/types/kanban";

type ManualRun = {
  slug: string;
  name: string;
};

const EMPTY_KANBAN: KanbanData = {
  pass: [],
  fail: [],
  blocked: [],
  notRun: [],
};

function normalizeRuns(data: unknown[]): ManualRun[] {
  return data
    .map((item) => {
      const rec = (item ?? {}) as Record<string, unknown>;
      return {
        slug: String(rec.slug ?? rec.id ?? ""),
        name: String(rec.name ?? rec.title ?? rec.slug ?? "Run manual"),
      } satisfies ManualRun;
    })
    .filter((run) => run.slug.length > 0);
}

export default function CompanyKanbanPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const slugParam = params?.slug;
  const companySlug = Array.isArray(slugParam) ? slugParam[0] : slugParam;
  const { user } = useAuthUser();

  const [runs, setRuns] = useState<ManualRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<string | null>(null);
  const [loadingRuns, setLoadingRuns] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const role = typeof user?.role === "string" ? user.role.toLowerCase() : "";
  const canEdit = Boolean(user?.isGlobalAdmin || role === "admin" || role === "company");

  const runParam = searchParams?.get("run") ?? "";

  useEffect(() => {
    if (!companySlug) return;
    let active = true;
    // schedule setState to avoid synchronous setState inside effect
    Promise.resolve().then(() => setLoadingRuns(true));
    Promise.resolve().then(() => setError(null));
    fetch(`/api/releases-manual?clientSlug=${encodeURIComponent(companySlug)}&kind=run`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        const normalized = normalizeRuns(Array.isArray(data) ? data : []);
        setRuns(normalized);
        if (runParam && normalized.some((run) => run.slug === runParam)) {
          setSelectedRun(runParam);
        } else {
          setSelectedRun(normalized[0]?.slug ?? null);
        }
      })
      .catch(() => {
        if (!active) return;
        setRuns([]);
        setSelectedRun(null);
        setError("Erro ao carregar runs.");
      })
      .finally(() => {
        if (!active) return;
        setLoadingRuns(false);
      });
    return () => {
      active = false;
    };
  }, [companySlug, runParam]);

  const runId = useMemo(() => {
    if (!selectedRun) return 0;
    const idx = runs.findIndex((run) => run.slug === selectedRun);
    return idx >= 0 ? idx + 1 : 0;
  }, [runs, selectedRun]);

  const persistEndpoint = selectedRun ? `/api/releases-manual/${encodeURIComponent(selectedRun)}/cases` : undefined;

  const handleRunChange = (value: string) => {
    const nextSlug = value || "";
    setSelectedRun(nextSlug || null);
    if (companySlug) {
      const query = nextSlug ? `?run=${encodeURIComponent(nextSlug)}` : "";
      router.replace(`/empresas/${encodeURIComponent(companySlug)}/defeitos/kanban${query}`);
    }
  };

  return (
    <div className="min-h-screen bg-(--page-bg,#f5f6fa) text-(--page-text,#0b1a3c) px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-3xl bg-white p-6 shadow-sm space-y-2">
          <p className="text-xs uppercase tracking-[0.4em] text-(--tc-accent,#ef0001)">Kanban</p>
          <h1 className="text-3xl font-extrabold">Kanban de defeitos</h1>
          <p className="text-sm text-(--tc-text-secondary,#4b5563)">
            Visualize o fluxo de defeitos por run e exporte o CSV.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <label className="text-xs uppercase tracking-[0.3em] text-(--tc-text-muted)">
              Run
            </label>
            <select
              value={selectedRun ?? ""}
              onChange={(e) => handleRunChange(e.target.value)}
              className="rounded-full border border-(--tc-border,#e5e7eb) bg-white px-4 py-2 text-sm"
              aria-label="Selecionar run"
            >
              <option value="">Selecione uma run</option>
              {runs.map((run) => (
                <option key={run.slug} value={run.slug}>
                  {run.name}
                </option>
              ))}
            </select>
            {loadingRuns && <span className="text-xs text-(--tc-text-muted)">Carregando runs...</span>}
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </header>

        <div className="rounded-3xl bg-white p-6 shadow-sm">
          {!selectedRun && !loadingRuns && (
            <p className="text-sm text-(--tc-text-muted)">Selecione uma run para visualizar o Kanban.</p>
          )}
          {selectedRun && (
            <Kanban
              key={selectedRun}
              data={EMPTY_KANBAN}
              project={(companySlug ?? "MANUAL").toString()}
              runId={runId}
              companySlug={companySlug}
              editable={canEdit}
              allowStatusChange={canEdit}
              persistEndpoint={persistEndpoint}
            />
          )}
        </div>
      </div>
    </div>
  );
}
