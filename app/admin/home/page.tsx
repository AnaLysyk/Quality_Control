"use client";

import { useEffect, useMemo, useState } from "react";
import { RequireGlobalAdmin } from "@/components/RequireGlobalAdmin";
import { FiExternalLink } from "react-icons/fi";

type RunItem = {
  slug: string;
  title: string;
  status?: "passed" | "pass" | "failed" | "fail" | "blocked";
  created_at?: string;
};

type ClientItem = {
  id: string;
  name: string;
  website?: string | null;
  status?: string | null;
  slug?: string | null;
};

export default function AdminHomePage() {
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [runs, setRuns] = useState<RunItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<7 | 30 | 90>(30);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const [cliRes, runRes] = await Promise.all([
          fetch("/api/clients", { cache: "no-store" }),
          fetch("/api/releases", { cache: "no-store" }),
        ]);

        if (!cliRes.ok) throw new Error("Erro ao carregar empresas");
        if (!runRes.ok) throw new Error("Erro ao carregar runs");

        const cliJson = await cliRes.json();
        const runJson = await runRes.json();

        setClients(Array.isArray(cliJson.items) ? cliJson.items : []);
        setRuns(Array.isArray(runJson.releases) ? runJson.releases : []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro inesperado");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  /* ---------------- FILTRO DE PERÍODO ---------------- */
  const runsFiltradas = useMemo(() => {
    const limite = new Date();
    limite.setDate(limite.getDate() - period);

    return runs.filter((r) => {
      if (!r.created_at) return false;
      return new Date(r.created_at) >= limite;
    });
  }, [runs, period]);

  /* ---------------- MÉTRICAS GLOBAIS ---------------- */
  const metrics = useMemo(() => {
    const total = runsFiltradas.length;

    const aprovadas = runsFiltradas.filter(
      (r) => r.status === "passed" || r.status === "pass"
    ).length;

    const falhas = runsFiltradas.filter(
      (r) => r.status === "failed" || r.status === "fail"
    ).length;

    const bloqueadas = runsFiltradas.filter(
      (r) => r.status === "blocked"
    ).length;

    const neutras = Math.max(total - aprovadas - falhas - bloqueadas, 0);

    const qualidade =
      total === 0
        ? 0
        : Math.round(((aprovadas + neutras * 0.3) / total) * 100);

    return {
      total,
      aprovadas,
      falhas,
      bloqueadas,
      neutras,
      qualidade,
    };
  }, [runsFiltradas]);

  return (
    <RequireGlobalAdmin>
      <div className="min-h-screen bg-[#f7f9fb] p-6 md:p-10 space-y-8">
        {/* Header */}
        <div className="rounded-3xl border bg-gradient-to-r from-white via-[#f1f4fb] to-white p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.4em] text-red-600">
            Testing Company
          </p>
          <h1 className="text-3xl font-extrabold">
            Home do Admin — Visão Global
          </h1>
          <p className="text-sm text-gray-600 max-w-2xl">
            Visão executiva das empresas atendidas. Apenas macro, saúde e risco.
          </p>
        </div>

        {/* Painel Global */}
        <section className="rounded-2xl border bg-white p-5 space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold">Painel Global</h2>
              <p className="text-sm text-gray-500">
                Últimos {period} dias
              </p>
            </div>

            <div className="flex gap-2">
              {[7, 30, 90].map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p as 7 | 30 | 90)}
                  className={`px-3 py-1 rounded-lg border text-sm ${
                    period === p
                      ? "border-red-600 text-red-600"
                      : "border-gray-300 text-gray-500"
                  }`}
                >
                  {p}d
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <MetricCard label="Empresas ativas" value={clients.length} />
            <MetricCard label="Runs executadas" value={metrics.total} />
            <MetricCard label="Defeitos abertos" value={metrics.falhas} />
            <MetricCard
              label="Qualidade média global"
              value={metrics.qualidade}
              suffix="%"
              highlight
            />
          </div>

          {metrics.total === 0 && (
            <p className="text-xs text-amber-600">
              Nenhuma execução encontrada no período selecionado.
            </p>
          )}
        </section>

        {/* Empresas monitoradas */}
        <section className="rounded-2xl border bg-white p-6 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Empresas monitoradas</h2>
            <a
              href="/admin/clients"
              className="text-sm font-semibold text-red-600 hover:underline"
            >
              Ver todas
            </a>
          </div>

          {loading && (
            <p className="text-sm text-gray-500">Carregando…</p>
          )}
          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}
          {!loading && clients.length === 0 && (
            <p className="text-sm text-gray-500">
              Nenhuma empresa encontrada.
            </p>
          )}

          <div className="grid gap-3 md:grid-cols-3">
            {clients.map((c) => (
              <div
                key={c.id}
                className="rounded-xl border bg-gray-50 p-4 hover:shadow-sm transition"
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="text-lg font-semibold">{c.name}</p>
                    {c.slug && (
                      <p className="text-xs text-gray-500">
                        slug: {c.slug}
                      </p>
                    )}
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full border bg-emerald-50 text-emerald-700">
                    {c.status ?? "ativo"}
                  </span>
                </div>

                <p className="text-xs text-gray-500">
                  {c.website ?? "Sem website"}
                </p>

                {c.slug && (
                  <a
                    href={`/empresas/${c.slug}/home`}
                    className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-red-600 hover:underline"
                  >
                    Entrar na empresa
                    <FiExternalLink size={14} />
                  </a>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Gráficos globais */}
        <section className="grid gap-4 md:grid-cols-3">
          <ChartCard title="Defeitos por empresa" />
          <ChartCard title="Evolução da qualidade" />
          <ChartCard title="Distribuição de status" />
        </section>
      </div>
    </RequireGlobalAdmin>
  );
}

/* ---------------- COMPONENTES ---------------- */

function MetricCard({
  label,
  value,
  suffix,
  highlight,
}: {
  label: string;
  value: number;
  suffix?: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <p className="text-xs uppercase tracking-widest text-gray-500">
        {label}
      </p>
      <p
        className={`text-3xl font-extrabold mt-1 ${
          highlight ? "text-red-600" : "text-gray-900"
        }`}
      >
        {value}
        {suffix}
      </p>
    </div>
  );
}

function ChartCard({ title }: { title: string }) {
  return (
    <div className="rounded-xl border bg-white p-4 h-40 flex items-center justify-center text-sm text-gray-500">
      {title} (placeholder)
    </div>
  );
}
