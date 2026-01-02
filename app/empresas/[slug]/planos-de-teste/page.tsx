"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

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
    <div className="min-h-screen bg-[var(--page-bg,#f7f9fb)] text-[var(--page-text,#0b1a3c)] p-6 md:p-10 space-y-6">
      <div className="flex items-center justify_between gap-2">
        <nav className="text-xs text-[var(--tc-text-muted,#6B7280)]">
          <span>Empresas</span>
          <span className="mx-1">/</span>
          <span className="font-semibold text-[var(--tc-text-primary,#0b1a3c)] uppercase">{companyName}</span>
          <span className="mx-1">/</span>
          <span className="text-[var(--tc-text-secondary,#4B5563)]">Planos de Teste</span>
        </nav>
      </div>

      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.32em] text-[var(--tc-accent,#ef0001)]">Planos de teste</p>
        <h1 className="text-3xl md:text-4xl font-extrabold text-[var(--tc-text-primary,#0b1a3c)]">
          Planejamento da {companyName}
        </h1>
        <p className="text-sm text-[var(--tc-text-secondary,#4B5563)]">
          Visão do que está planejado para testar. Dados diretos do Qase (planos).
        </p>
      </header>

      <section className="grid gap-3 md:grid-cols-3">
        <MetricCard label="Planos ativos" value={totalPlans} color="text-[var(--tc-text-primary,#0b1a3c)]" />
        <MetricCard label="Testes planejados (soma)" value={totalTests} color="text-[var(--tc-accent,#ef0001)]" />
        <div className="rounded-2xl border border-[var(--tc-border,#e5e7eb)] bg-white p-4 shadow-sm space-y-2">
          <p className="text-sm text-[var(--tc-text-secondary,#4B5563)] font-semibold">Risco</p>
          <div className="flex items-center gap-3 text-xs">
            <RiskBadge label="Alto" value={resumo.alto} tone="red" />
            <RiskBadge label="Médio" value={resumo.medio} tone="amber" />
            <RiskBadge label="Baixo" value={resumo.baixo} tone="emerald" />
          </div>
        </div>
      </section>

      {error && <p className="text-sm text-red-500">{error}</p>}
      {loading && <p className="text-sm text-[var(--tc-text-muted,#6B7280)]">Carregando planos...</p>}

      {!loading && (
        <section className="rounded-2xl border border-[var(--tc-border,#e5e7eb)] bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-[var(--tc-text-primary,#0b1a3c)]">Planos</h2>
              <p className="text-sm text-[var(--tc-text-secondary,#4B5563)]">Lista vinda do Qase</p>
            </div>
          </div>
          {plans.length === 0 ? (
            <p className="text-sm text-[var(--tc-text-muted,#6B7280)]">Nenhum plano cadastrado.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {plans.map((p) => (
                <div
                  key={p.id}
                  className="rounded-xl border border-[var(--tc-border,#e5e7eb)] bg-white p-4 shadow-sm space-y-2 hover:shadow-md transition"
                >
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-[var(--tc-text-primary,#0b1a3c)]">{p.name}</div>
                    <RiskPill tone={p.risk} />
                  </div>
                  <p className="text-xs text-[var(--tc-text-secondary,#4B5563)]">Escopo: {p.scope}</p>
                  <p className="text-xs text-[var(--tc-text-secondary,#4B5563)]">Testes: {p.tests}</p>
                  <p className="text-xs text-[var(--tc-text-muted,#6B7280)]">Criado em: {p.createdAt}</p>
                  <div className="pt-1">
                    <a
                      href={p.link}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-semibold text-[var(--tc-accent,#ef0001)] hover:underline"
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
  );
}

function MetricCard({ label, value, suffix, color }: { label: string; value: number; suffix?: string; color?: string }) {
  return (
    <div className="rounded-2xl border border-[var(--tc-border,#e5e7eb)] bg-white p-5 shadow-sm">
      <p className="text-sm text-[var(--tc-text-muted,#6B7280)]">{label}</p>
      <p className={`text-3xl font-bold ${color ?? "text-[var(--tc-text-primary,#0b1a3c)]"}`}>
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
