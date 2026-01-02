"use client";

import { useEffect, useMemo, useState } from "react";
import { FiAlertTriangle, FiTrendingDown, FiZap } from "react-icons/fi";
import { RequireGlobalAdmin } from "@/components/RequireGlobalAdmin";

type RunItem = { slug: string; title: string; app?: string; project?: string; summary?: string; status?: string; clientName?: string | null };
type ClientItem = { id: string; name: string; slug?: string | null };

export default function AdminDefeitosPage() {
  const [runs, setRuns] = useState<RunItem[]>([]);
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [runRes, cliRes] = await Promise.all([
          fetch("/api/releases", { cache: "no-store" }),
          fetch("/api/clients", { cache: "no-store" }),
        ]);
        const runJson = await runRes.json().catch(() => ({ releases: [] }));
        const cliJson = await cliRes.json().catch(() => ({ items: [] }));
        setRuns(Array.isArray(runJson.releases) ? runJson.releases : []);
        setClients(Array.isArray(cliJson.items) ? cliJson.items : []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar dados");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const defects = useMemo(
    () =>
      runs.filter((r) => {
        const st = String(r.status ?? "").toLowerCase();
        return st === "failed" || st === "fail";
      }),
    [runs],
  );

  const defectsByCompany = useMemo(() => {
    const map: Record<string, number> = {};
    defects.forEach((d) => {
      const name = d.clientName || "Empresa";
      map[name] = (map[name] || 0) + 1;
    });
    return Object.entries(map).map(([name, count]) => ({ name, count }));
  }, [defects]);

  const defectsByRun = useMemo(() => {
    const map: Record<string, { count: number; app: string; client: string | null | undefined }> = {};
    defects.forEach((d) => {
      const key = d.slug ?? "";
      if (!key) return;
      map[key] = map[key] || { count: 0, app: d.app ?? d.project ?? "APP", client: d.clientName };
      map[key].count += 1;
    });
    return Object.entries(map).map(([slug, data]) => ({ slug, ...data }));
  }, [defects]);

  const defectsByApp = useMemo(() => {
    const map: Record<string, number> = {};
    defects.forEach((d) => {
      const app = d.app ?? d.project ?? "APP";
      map[app] = (map[app] || 0) + 1;
    });
    return Object.entries(map).map(([app, count]) => ({ app, count }));
  }, [defects]);

  return (
    <RequireGlobalAdmin>
      <style jsx global>{`
        @keyframes pulseUp {
          from {
            opacity: 0;
            transform: translateY(6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .metric-animate {
          animation: pulseUp 0.6s ease-out both;
        }
      `}</style>
      <div className="min-h-screen bg-[var(--page-bg,#f7f9fb)] text-[var(--page-text,#0b1a3c)] p-6 md:p-10 space-y-6">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.32em] text-[var(--tc-accent,#ef0001)]">Defeitos</p>
          <h1 className="text-3xl md:text-4xl font-extrabold text-[var(--tc-text-primary,#0b1a3c)]">
            Painel de defeitos (global)
          </h1>
          <p className="text-sm text-[var(--tc-text-secondary,#4B5563)]">
            Visao consolidada de falhas por empresa e por run. Clique para entrar no contexto da empresa.
          </p>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}
        {loading && <p className="text-sm text-[var(--tc-text-muted,#6B7280)]">Carregando defeitos...</p>}

        {!loading && (
          <>
            {/* cards de risco */}
            <section className="grid gap-4 md:grid-cols-3">
              <MetricCard label="Defeitos abertos" value={defects.length} color="text-red-600" icon={<FiAlertTriangle />} />
              <MetricCard label="Empresas com defeitos" value={defectsByCompany.length} icon={<FiTrendingDown />} />
              <MetricCard label="Runs inspecionadas" value={runs.length} icon={<FiZap />} />
            </section>

            <section className="rounded-2xl border border-[var(--tc-border,#e5e7eb)] bg-white p-6 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-[var(--tc-text-primary,#0b1a3c)]">Por empresa</h2>
                  <p className="text-sm text-[var(--tc-text-secondary,#4B5563)]">Ranking de falhas</p>
                </div>
              </div>
              {defectsByCompany.length === 0 ? (
                <p className="text-sm text-[var(--tc-text-muted,#6B7280)]">Nenhuma falha registrada.</p>
              ) : (
                <div className="space-y-3">
                  {defectsByCompany.map((c, idx) => {
                    const slug = clients.find((cl) => cl.name === c.name)?.slug || "empresa";
                    const barWidth = Math.min(100, c.count * 10);
                    const tone =
                      c.count > 10 ? "bg-red-500" : c.count > 5 ? "bg-amber-500" : "bg-emerald-500";
                    return (
                      <div key={idx} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <p className="font-semibold text-[var(--tc-text-primary,#0b1a3c)]">{c.name}</p>
                          <a
                            href={`/empresas/${slug}/defeitos`}
                            className="text-xs font-semibold text-[var(--tc-accent,#ef0001)] hover:underline"
                          >
                            Entrar
                          </a>
                        </div>
                        <div className="h-2 rounded-full bg-[var(--tc-input-bg,#eef4ff)]">
                          <div className={`h-full rounded-full ${tone}`} style={{ width: `${barWidth}%` }} />
                        </div>
                        <p className="text-xs text-[var(--tc-text-secondary,#4B5563)]">{c.count} defeitos</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-[var(--tc-border,#e5e7eb)] bg-white p-6 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-[var(--tc-text-primary,#0b1a3c)]">Runs com falha</h2>
                <a href="/admin/runs" className="text-sm font-semibold text-[var(--tc-accent,#ef0001)] hover:underline">
                  Ver todas
                </a>
              </div>
              {defects.length === 0 ? (
                <p className="text-sm text-[var(--tc-text-muted,#6B7280)]">Nenhuma run com falha.</p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {defects.slice(0, 6).map((r, idx) => (
                    <div
                      key={r.slug ?? idx}
                      className="rounded-xl border border-[var(--tc-border,#e5e7eb)] bg-white p-4 shadow-sm space-y-2 hover:shadow-md transition"
                    >
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-[var(--tc-text-primary,#0b1a3c)]">{r.title}</p>
                        <span className="text-xs text-red-600">falha</span>
                      </div>
                      <p className="text-xs text-[var(--tc-text-secondary,#4B5563)]">App: {r.app ?? r.project ?? "APP"}</p>
                      <p className="text-xs text-[var(--tc-text-muted,#6B7280)]">Empresa: {r.clientName ?? "Empresa"}</p>
                      <a
                        href={`/runs/${r.slug}`}
                        className="text-xs font-semibold text-[var(--tc-accent,#ef0001)] hover:underline"
                      >
                        Abrir run
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Defeitos por run (grafico simples) */}
            <section className="rounded-2xl border border-[var(--tc-border,#e5e7eb)] bg-white p-6 shadow-sm space-y-3">
              <h2 className="text-xl font-semibold text-[var(--tc-text-primary,#0b1a3c)]">Defeitos por run</h2>
              {defectsByRun.length === 0 ? (
                <p className="text-sm text-[var(--tc-text-muted,#6B7280)]">Nenhuma run com defeitos.</p>
              ) : (
                <div className="space-y-2">
                  {defectsByRun.map((r, idx) => {
                    const barWidth = Math.min(100, r.count * 12);
                    return (
                      <div key={r.slug ?? idx} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-semibold text-[var(--tc-text-primary,#0b1a3c)]">{r.slug}</span>
                          <a
                            href={`/runs/${r.slug}`}
                            className="text-xs font-semibold text-[var(--tc-accent,#ef0001)] hover:underline"
                          >
                            Abrir run
                          </a>
                        </div>
                        <div className="h-2 rounded-full bg-[var(--tc-input-bg,#eef4ff)]">
                          <div className="h-full rounded-full bg-red-500" style={{ width: `${barWidth}%` }} />
                        </div>
                        <p className="text-xs text-[var(--tc-text-secondary,#4B5563)]">
                          {r.count} defeitos • {r.app} • {r.client ?? "Empresa"}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Defeitos por aplicação */}
            <section className="rounded-2xl border border-[var(--tc-border,#e5e7eb)] bg-white p-6 shadow-sm space-y-3">
              <h2 className="text-xl font-semibold text-[var(--tc-text-primary,#0b1a3c)]">Defeitos por aplicação</h2>
              {defectsByApp.length === 0 ? (
                <p className="text-sm text-[var(--tc-text-muted,#6B7280)]">Nenhuma aplicação com defeitos.</p>
              ) : (
                <div className="space-y-2">
                  {defectsByApp.map((a, idx) => {
                    const barWidth = Math.min(100, a.count * 10);
                    return (
                      <div key={idx} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-semibold text-[var(--tc-text-primary,#0b1a3c)]">{a.app}</span>
                        </div>
                        <div className="h-2 rounded-full bg-[var(--tc-input-bg,#eef4ff)]">
                          <div className="h-full rounded-full bg-amber-500" style={{ width: `${barWidth}%` }} />
                        </div>
                        <p className="text-xs text-[var(--tc-text-secondary,#4B5563)]">{a.count} defeitos</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </RequireGlobalAdmin>
  );
}

function MetricCard({ label, value, color, icon }: { label: string; value: number; color?: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[var(--tc-border,#e5e7eb)] bg-white p-5 shadow-sm flex items-center gap-3">
      <div className="h-12 w-12 rounded-xl bg-[var(--tc-input-bg,#eef4ff)] border border-[var(--tc-border,#e5e7eb)] flex items-center justify-center text-[var(--tc-accent,#ef0001)]">
        {icon}
      </div>
      <div>
        <p className="text-sm text-[var(--tc-text-muted,#6B7280)]">{label}</p>
        <p className={`text-3xl font-bold ${color ?? "text-[var(--tc-text-primary,#0b1a3c)]"}`}>{value}</p>
      </div>
    </div>
  );
}
