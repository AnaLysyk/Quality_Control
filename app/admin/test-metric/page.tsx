"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RequireGlobalAdmin } from "@/components/RequireGlobalAdmin";

type ClientItem = {
  id: string;
  name: string;
  slug: string;
  status: string | null;
  releases: number | null;
  approval: number | null;
};

type MetricsResponse = {
  totals: { approved: number; failed: number; neutral: number; quality: number };
  clients: ClientItem[];
  regression?: { approved: number; failed: number; neutral: number };
  acceptance?: { approved: number; failed: number; neutral: number };
  testPlans?: { name: string; progress: number }[];
};

export default function TestMetricPage() {
  const [data, setData] = useState<MetricsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/admin/test-metric", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Erro ao carregar métricas");
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar métricas");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const totals = data?.totals ?? { approved: 0, failed: 0, neutral: 0, quality: 0 };
  const clients = data?.clients ?? [];
  const regression = data?.regression ?? { approved: 42, failed: 8, neutral: 5 };
  const acceptance = data?.acceptance ?? { approved: 35, failed: 6, neutral: 4 };
  const testPlans =
    data?.testPlans ??
    [
      { name: "Plano Regressão", progress: 72 },
      { name: "Plano Aceitação", progress: 64 },
      { name: "Plano Smoke", progress: 88 },
    ];

  return (
    <RequireGlobalAdmin>
      <div className="min-h-screen bg-[var(--page-bg,#ffffff)] text-[var(--page-text,#0b1a3c)] p-6 md:p-10 space-y-8">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.38em] text-[var(--tc-accent,#ef0001)]">Test Metric</p>
          <h1 className="text-3xl md:text-4xl font-extrabold text-[var(--tc-text-primary,#0b1a3c)]">
            Visão Global
          </h1>
          <p className="text-[var(--tc-text-secondary,#4B5563)] max-w-3xl">
            Visão executiva da Testing Company. Dados agregados de todas as empresas. Clique em uma empresa para entrar
            no contexto dela.
          </p>
        </div>

        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-[var(--tc-border,#e5e7eb)] bg-white p-5 shadow-sm">
            <p className="text-sm text-[var(--tc-text-muted,#6B7280)]">Aprovadas</p>
            <p className="text-3xl font-bold text-emerald-600">{totals.approved}</p>
          </div>
          <div className="rounded-2xl border border-[var(--tc-border,#e5e7eb)] bg-white p-5 shadow-sm">
            <p className="text-sm text-[var(--tc-text-muted,#6B7280)]">Falhas</p>
            <p className="text-3xl font-bold text-red-500">{totals.failed}</p>
          </div>
          <div className="rounded-2xl border border-[var(--tc-border,#e5e7eb)] bg-white p-5 shadow-sm">
            <p className="text-sm text-[var(--tc-text-muted,#6B7280)]">Neutras / Em andamento</p>
            <p className="text-3xl font-bold text-amber-500">{totals.neutral}</p>
          </div>
          <div className="rounded-2xl border border-[var(--tc-border,#e5e7eb)] bg-white p-5 shadow-sm">
            <p className="text-sm text-[var(--tc-text-muted,#6B7280)]">Qualidade média global</p>
            <p className="text-3xl font-extrabold text-[var(--tc-accent,#ef0001)]">{totals.quality}%</p>
          </div>
        </section>

        {/* Split por regressão / aceitação */}
        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-[var(--tc-border,#e5e7eb)] bg-white p-6 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-[var(--tc-text-primary,#0b1a3c)]">Regressão</h3>
              <span className="text-xs text-[var(--tc-text-muted,#6B7280)]">Global</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <MetricPill label="Aprovadas" value={regression.approved} color="text-emerald-600" />
              <MetricPill label="Falhas" value={regression.failed} color="text-red-500" />
              <MetricPill label="Neutras" value={regression.neutral} color="text-amber-500" />
            </div>
            <ProgressBar value={calcPercent(regression.approved, regression.failed, regression.neutral)} />
          </div>
          <div className="rounded-2xl border border-[var(--tc-border,#e5e7eb)] bg-white p-6 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-[var(--tc-text-primary,#0b1a3c)]">Aceitação</h3>
              <span className="text-xs text-[var(--tc-text-muted,#6B7280)]">Global</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <MetricPill label="Aprovadas" value={acceptance.approved} color="text-emerald-600" />
              <MetricPill label="Falhas" value={acceptance.failed} color="text-red-500" />
              <MetricPill label="Neutras" value={acceptance.neutral} color="text-amber-500" />
            </div>
            <ProgressBar value={calcPercent(acceptance.approved, acceptance.failed, acceptance.neutral)} />
          </div>
        </section>

        {/* Painel de planos de teste (visual simples) */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-[var(--tc-text-primary,#0b1a3c)]">Planos de teste (visão global)</h2>
            <span className="text-xs text-[var(--tc-text-muted,#6B7280)]">Progresso geral por plano</span>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {testPlans.map((plan) => (
              <div
                key={plan.name}
                className="rounded-2xl border border-[var(--tc-border,#e5e7eb)] bg-white p-5 shadow-sm space-y-3"
              >
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-[var(--tc-text-primary,#0b1a3c)]">{plan.name}</p>
                  <span className="text-sm font-semibold text-[var(--tc-accent,#ef0001)]">{plan.progress}%</span>
                </div>
                <ProgressBar value={plan.progress} />
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-[var(--tc-text-primary,#0b1a3c)]">Empresas</h2>
          </div>

          {loading && <p className="text-[var(--tc-text-muted,#6B7280)]">Carregando...</p>}
          {error && !loading && <p className="text-red-500 text-sm">{error}</p>}

          {!loading && !error && (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {clients.map((c) => (
                <Link
                  key={c.slug || c.id}
                  href={`/empresas/${c.slug || c.id}/dashboard`}
                  className="group rounded-2xl border border-[var(--tc-border,#e5e7eb)] bg-white p-5 shadow-sm transition hover:shadow-md hover:border-[var(--tc-accent,#ef0001)]/60"
                >
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-[var(--tc-text-primary,#0b1a3c)]">{c.name}</div>
                    <span
                      className={`text-xs rounded-full px-3 py-1 ${
                        c.status === "ativo"
                          ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                          : "bg-gray-100 text-gray-600 border border-gray-200"
                      }`}
                    >
                      {c.status ?? "ativo"}
                    </span>
                  </div>
                  <div className="mt-2 text-sm text-[var(--tc-text-secondary,#4B5563)] space-y-1">
                    <p>Runs: {c.releases ?? "—"}</p>
                    <p>Média de aprovação: {c.approval != null ? `${c.approval}%` : "—"}</p>
                  </div>
                  <p className="mt-3 text-xs text-[var(--tc-text-muted,#6B7280)] underline">
                    Entrar no dashboard
                  </p>
                </Link>
              ))}
              {clients.length === 0 && (
                <div className="rounded-xl border border-dashed border-[var(--tc-border,#e5e7eb)] bg-white p-5 text-sm text-[var(--tc-text-muted,#6B7280)]">
                  Nenhuma empresa encontrada.
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </RequireGlobalAdmin>
  );
}

function calcPercent(a: number, b: number, c: number) {
  const total = a + b + c;
  if (!total) return 0;
  return Math.round((a / total) * 100);
}

function MetricPill({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="rounded-xl border border-[var(--tc-border,#e5e7eb)] bg-[var(--tc-input-bg,#f6f8fb)] p-3 text-center">
      <p className="text-xs text-[var(--tc-text-muted,#6B7280)]">{label}</p>
      <p className={`text-2xl font-bold ${color ?? "text-[var(--tc-text-primary,#0b1a3c)]"}`}>{value}</p>
    </div>
  );
}

function ProgressBar({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
      <div
        className="h-full rounded-full bg-gradient-to-r from-[#ef0001] via-[#ff6b4a] to-[#ffc14a] transition-all"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
