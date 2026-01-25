"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Breadcrumb from "@/components/Breadcrumb";

type PlanItem = { id: string; name: string; scope: string; tests: number; createdAt: string; risk: string; link: string };

export default function PlanosDeTesteEmpresaPage() {
  const params = useParams();
  const slug = (params?.slug as string) || "empresa";
  const companyName =
    slug === "griaule"
      ? "Griaule"
      : slug
          .split("-")
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(" ");

  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [totalTests, setTotalTests] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/empresas/${slug}/planos-de-teste`, { cache: "no-store" });
        const json = await res.json();
        setPlans(Array.isArray(json.plans) ? json.plans : []);
        setTotalTests(json.totalTests ?? 0);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar planos");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [slug]);

  const totalPlans = plans.length;
  const resumo = useMemo(
    () => ({
      alto: plans.filter((p) => p.risk === "alto").length,
      medio: plans.filter((p) => p.risk === "medio").length,
      baixo: plans.filter((p) => p.risk === "baixo").length,
    }),
    [plans],
  );

  return (
    <div className="min-h-screen bg-(--page-bg,#f7f9fb) text-(--page-text,#0b1a3c)">
      <div className="mx-auto w-full max-w-7xl px-4 pt-4 sm:px-6 sm:pt-6 lg:px-10 lg:pt-10 space-y-6">
        <Breadcrumb
          items={[
            { label: "Empresas", href: "/empresas" },
            {
              label: companyName,
              href: `/empresas/${encodeURIComponent(slug)}/home`,
              title: companyName,
            },
            { label: "Planos de teste" },
          ]}
        />

        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.32em] text-(--tc-accent,#ef0001)">Planos de teste</p>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-(--tc-text-primary,#0b1a3c) leading-tight wrap-break-word">
            Planejamento da {companyName}
          </h1>
          <p className="text-sm sm:text-base text-(--tc-text-secondary,#4b5563)">
            Visão do que está planejado para testar. Dados diretos do Qase (planos).
          </p>
        </header>

        <section className="grid gap-3 md:grid-cols-3">
          <MetricCard label="Planos ativos" value={totalPlans} color="text-(--tc-text-primary,#0b1a3c)" />
          <MetricCard label="Testes planejados (soma)" value={totalTests} color="text-(--tc-accent,#ef0001)" />
          <div className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#ffffff) p-4 shadow-sm space-y-2">
            <p className="text-sm text-(--tc-text-secondary,#4b5563) font-semibold">Risco</p>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <RiskBadge label="Alto" value={resumo.alto} tone="red" />
              <RiskBadge label="Médio" value={resumo.medio} tone="amber" />
              <RiskBadge label="Baixo" value={resumo.baixo} tone="emerald" />
            </div>
          </div>
        </section>

        {error && <p className="text-sm text-red-500">{error}</p>}
        {loading && <p className="text-sm text-(--tc-text-muted,#6b7280)">Carregando planos...</p>}

        {!loading && (
          <section className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#ffffff) p-4 sm:p-6 shadow-sm space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg sm:text-xl font-semibold text-(--tc-text-primary,#0b1a3c)">Planos</h2>
                <p className="text-sm text-(--tc-text-secondary,#4b5563)">Lista vinda do Qase</p>
              </div>
            </div>
            {plans.length === 0 ? (
              <p className="text-sm text-(--tc-text-muted,#6b7280)">Nenhum plano cadastrado.</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {plans.map((p) => (
                  <div
                    key={p.id}
                    className="rounded-xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#ffffff) p-4 shadow-sm space-y-2 hover:shadow-md transition"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0 font-semibold text-(--tc-text-primary,#0b1a3c) truncate" title={p.name}>
                        {p.name}
                      </div>
                      <RiskPill tone={p.risk} />
                    </div>
                    <p className="text-xs text-(--tc-text-secondary,#4b5563)">Escopo: {p.scope}</p>
                    <p className="text-xs text-(--tc-text-secondary,#4b5563)">Testes: {p.tests}</p>
                    <p className="text-xs text-(--tc-text-muted,#6b7280)">Criado em: {p.createdAt}</p>
                    <div className="pt-1">
                      <a
                        href={p.link}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-semibold text-(--tc-accent,#ef0001) hover:underline"
                      >
                        Abrir no Qase
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

function MetricCard({ label, value, suffix, color }: { label: string; value: number; suffix?: string; color?: string }) {
  return (
    <div className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#ffffff) p-5 shadow-sm">
      <p className="text-sm text-(--tc-text-muted,#6b7280)">{label}</p>
      <p className={`text-3xl font-bold ${color ?? "text-(--tc-text-primary,#0b1a3c)"}`}>
        {value}
        {suffix}
      </p>
    </div>
  );
}

function RiskBadge({ label, value, tone }: { label: string; value: number; tone: "red" | "amber" | "emerald" }) {
  const toneClass =
    tone === "red"
      ? "text-red-600 bg-red-50 border-red-200"
      : tone === "amber"
        ? "text-amber-600 bg-amber-50 border-amber-200"
        : "text-emerald-600 bg-emerald-50 border-emerald-200";
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 font-semibold ${toneClass}`}>
      {label}: {value}
    </span>
  );
}

function RiskPill({ tone }: { tone: string }) {
  const toneClass =
    tone === "alto"
      ? "text-red-600 bg-red-50 border-red-200"
      : tone === "medio"
        ? "text-amber-600 bg-amber-50 border-amber-200"
        : "text-emerald-600 bg-emerald-50 border-emerald-200";
  return <span className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize ${toneClass}`}>{tone}</span>;
}
