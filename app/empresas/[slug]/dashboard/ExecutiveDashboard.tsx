"use client";
import React, { useEffect, useState } from "react";

export default function ExecutiveDashboard({ slug }: { slug: string }) {
  const [data, setData] = useState<any>(null);
  const [health, setHealth] = useState<any>(null);
  const [releaseStatus, setReleaseStatus] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [goals, setGoals] = useState<any[]>([]);
  const [goalsError, setGoalsError] = useState<string | null>(null);
  const [goalAlerts, setGoalAlerts] = useState<any[]>([]);
  const [releaseQuality, setReleaseQuality] = useState<any[]>([]);
  const [releaseQualityError, setReleaseQualityError] = useState<string | null>(null);
  const [trend, setTrend] = useState<{ trend?: string; metrics?: any } | null>(null);
  const [trendError, setTrendError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const summaryPromise = slug === "griaule"
      ? fetch("/data/dashboard-summary-griaule.json").then((res) => res.json())
      : fetch(`/api/dashboard/summary?slug=${encodeURIComponent(slug)}`).then((res) => res.json());
    Promise.all([
      summaryPromise,
      fetch(`/api/releases/status`).then((res) => res.json()),
    ])
      .then(([summary, statusData]) => {
        setData(summary);
        fetch(`/api/empresas/${slug}/quality/health`).then((res) => res.json()).then(setHealth).catch(() => setHealth(null));
        if (Array.isArray(statusData?.releases)) {
          const map: Record<string, any> = {};
          for (const rel of statusData.releases) {
            map[rel.releaseSlug] = rel;
          }
          setReleaseStatus(map);
        }
      })
      .catch(() => setError("Erro ao carregar dashboard"))
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    const loadGoals = async () => {
      try {
        setGoalsError(null);
        const res = await fetch(`/api/empresas/${slug}/quality-goals/status`, { cache: "no-store" });
        if (!res.ok) throw new Error("Erro ao carregar metas");
        const json = await res.json().catch(() => []);
        setGoals(Array.isArray(json) ? json : []);
      } catch (err) {
        setGoalsError(err instanceof Error ? err.message : "Erro ao carregar metas");
        setGoals([]);
      }
    };
    loadGoals();
  }, [slug]);

  useEffect(() => {
    const loadGoalAlerts = async () => {
      try {
        const res = await fetch(`/api/empresas/${slug}/alerts`, { cache: "no-store" });
        const json = await res.json().catch(() => []);
        setGoalAlerts(Array.isArray(json) ? json : []);
      } catch {
        setGoalAlerts([]);
      }
    };
    loadGoalAlerts();
  }, [slug]);

  useEffect(() => {
    const loadReleaseQuality = async () => {
      try {
        setReleaseQualityError(null);
        const res = await fetch(`/api/empresas/${slug}/releases/quality`, { cache: "no-store" });
        if (!res.ok) throw new Error("Erro ao carregar qualidade por release");
        const json = await res.json().catch(() => ({ releases: [] }));
        setReleaseQuality(Array.isArray(json.releases) ? json.releases : []);
      } catch (err) {
        setReleaseQuality([]);
        setReleaseQualityError(err instanceof Error ? err.message : "Erro ao carregar qualidade por release");
      }
    };
    loadReleaseQuality();
  }, [slug]);

  useEffect(() => {
    const loadTrend = async () => {
      try {
        setTrendError(null);
        const res = await fetch(`/api/empresas/${slug}/quality/trend`, { cache: "no-store" });
        if (!res.ok) throw new Error("Erro ao carregar tendência");
        const json = await res.json().catch(() => null);
        setTrend(json);
      } catch (err) {
        setTrend(null);
        setTrendError(err instanceof Error ? err.message : "Erro ao carregar tendência");
      }
    };
    loadTrend();
  }, [slug]);

  if (loading) return <div>Carregando dashboard...</div>;
  if (error) return <div className="text-red-600">{error}</div>;
  if (!data) return <div>Nenhum dado encontrado.</div>;

  return (
    <>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border bg-white p-6 shadow flex flex-col items-start">
          <div className="text-xs uppercase tracking-widest text-gray-500">Health Score</div>
          <div className="mt-2 flex items-center text-3xl font-extrabold text-gray-900">
            {health?.score ?? "--"}
            {health?.status === "healthy" && <span data-testid="health-score-healthy" className="ml-2 text-green-600 font-bold">🟢</span>}
            {health?.status === "attention" && <span data-testid="health-score-attention" className="ml-2 text-yellow-600 font-bold">🟡</span>}
            {health?.status === "critical" && <span data-testid="health-score-critical" className="ml-2 text-red-600 font-bold">🔴</span>}
          </div>
          {health?.reasons && Array.isArray(health.reasons) && health.reasons.length > 0 && (
            <ul className="mt-2 text-xs text-(--tc-text-secondary,#4b5563) space-y-1">
              {health.reasons.map((r: string, idx: number) => (
                <li key={idx}>• {r}</li>
              ))}
            </ul>
          )}
        </div>
        <div data-testid="quality-score" className="rounded-2xl border bg-white p-6 shadow flex flex-col items-start">
          <div className="text-xs uppercase tracking-widest text-gray-500">Quality Score</div>
          <div className="mt-2 flex items-center text-3xl font-extrabold text-gray-900">
            {data.score}
            {data.score >= 85 && <span className="ml-2 text-green-600 font-bold">🟢</span>}
            {data.score >= 70 && data.score < 85 && <span className="ml-2 text-yellow-600 font-bold">🟡</span>}
            {data.score < 70 && <span className="ml-2 text-red-600 font-bold">🔴</span>}
          </div>
        </div>
        <div data-testid="mttr" className="rounded-2xl border bg-white p-6 shadow flex flex-col items-start">
          <div className="text-xs uppercase tracking-widest text-gray-500">MTTR</div>
          <div className="mt-2 text-3xl font-extrabold text-gray-900">{data.mttr?.value ?? "—"} dias</div>
          <div className="mt-1 text-xs text-gray-500">Tendência: {data.mttr?.trend === "up" ? "↑" : data.mttr?.trend === "down" ? "↓" : "="}</div>
        </div>
        <div className="rounded-2xl border bg-white p-6 shadow flex flex-col items-start">
          <div className="text-xs uppercase tracking-widest text-gray-500">Defeitos críticos</div>
          <div className="mt-2 text-2xl font-extrabold text-gray-900">Abertos: {data.defects?.open ?? 0}</div>
          <div className="mt-1 text-2xl font-extrabold text-red-600">Fora do SLA: {data.defects?.overSla ?? 0}</div>
        </div>
        <div data-testid="releases-status" className="rounded-2xl border bg-white p-6 shadow flex flex-col items-start">
          <div className="text-xs uppercase tracking-widest text-gray-500">Releases impactadas</div>
          <ul className="mt-2 space-y-1">
            {Array.isArray(data.releases) && data.releases.length > 0 ? (
              data.releases.map((r: any) => {
                const relStatus = releaseStatus[r.version] || {};
                const status = relStatus.status || "ok";
                return (
                  <li key={r.version} data-testid="release-card">
                    <a
                      href={`/empresas/${encodeURIComponent(slug)}/releases/${encodeURIComponent(r.version)}`}
                      className="block text-sm font-semibold hover:underline focus:outline-none focus:ring-2 focus:ring-(--tc-accent) rounded"
                    >
                      <span data-testid="release-status">{status}</span>{" "}
                      {status === "risk" && <span data-testid="release-risk" className="text-red-600 font-bold ml-2">⚠️</span>}
                      <span className={status === "risk" ? "text-red-600 ml-2" : status === "blocked" ? "text-yellow-600 ml-2" : "text-green-600 ml-2"}>{r.version}</span>
                    </a>
                  </li>
                );
              })
            ) : (
              <li className="text-gray-500">Nenhuma release impactada</li>
            )}
          </ul>
        </div>
      </div>
      {/* Alerts Section */}
      <div data-testid="alerts" className="mt-8 rounded-2xl border bg-white p-6 shadow">
        <div className="text-xs uppercase tracking-widest text-gray-500 mb-2">Alertas recentes</div>
        {Array.isArray(data.alerts) && data.alerts.length > 0 ? (
          <ul className="space-y-2">
            {data.alerts.map((alert: any, idx: number) => (
              <li key={alert.timestamp + idx} className="flex items-center gap-2">
                <span className={
                  alert.severity === "critical"
                    ? "text-red-600 font-bold"
                    : alert.severity === "warning"
                    ? "text-yellow-600 font-bold"
                    : "text-gray-600"
                }>
                  {alert.severity === "critical" ? "⚠️" : "ℹ️"}
                </span>
                <span className="text-sm">{alert.message}</span>
                <span className="ml-auto text-xs text-gray-400">{new Date(alert.timestamp).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-gray-500 text-sm">Nenhum alerta crítico recente.</div>
        )}
      </div>
      <div className="mt-6 rounded-2xl border bg-white p-6 shadow">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-widest text-gray-500">Tendência de Qualidade</div>
            <p className="text-sm text-(--tc-text-secondary,#4b5563)">Últimas 5 releases</p>
          </div>
          {trendError && <span className="text-xs text-red-600">{trendError}</span>}
        </div>
        <div className="mt-3 flex items-center gap-3 text-sm">
          {trend?.trend === "improving" && (
            <span
              data-testid="quality-trend-improving"
              className="inline-flex items-center gap-2 rounded-full bg-emerald-50 text-emerald-700 px-3 py-1 font-semibold"
            >
              ↑ Melhorando
            </span>
          )}
          {trend?.trend === "degrading" && (
            <span
              data-testid="quality-trend-degrading"
              className="inline-flex items-center gap-2 rounded-full bg-red-50 text-red-700 px-3 py-1 font-semibold"
            >
              ↓ Piorando
            </span>
          )}
          {(!trend || trend?.trend === "stable") && (
            <span
              data-testid="quality-trend-stable"
              className="inline-flex items-center gap-2 rounded-full bg-gray-100 text-gray-700 px-3 py-1 font-semibold"
            >
              → Estável
            </span>
          )}
          {trend?.metrics && (
            <div className="text-xs text-(--tc-text-secondary,#4b5563)">
              MTTR: {trend.metrics.mttr_change_percent}% • Defeitos: {trend.metrics.defects_change_percent}%
            </div>
          )}
        </div>
      </div>
      <div className="mt-6 rounded-2xl border bg-white p-6 shadow">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-widest text-gray-500">Alertas de metas</div>
            <p className="text-sm text-(--tc-text-secondary,#4b5563)">Mudanças de status das metas de qualidade</p>
          </div>
        </div>
        {goalAlerts.length === 0 ? (
          <div className="mt-2 text-sm text-(--tc-text-muted,#6b7280)">Nenhum alerta de meta recente.</div>
        ) : (
          <ul className="mt-3 space-y-2">
            {goalAlerts.map((a, idx) => (
              <li
                key={`${a.goal_id || a.goal}-${a.created_at}-${idx}`}
                data-testid="quality-alert-item"
                className="rounded-lg border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#ffffff) p-3 text-sm flex items-start gap-3"
              >
                <span className="text-lg">⚠️</span>
                <div className="flex-1">
                  <div className="font-semibold">{a.goal || a.goal_id}</div>
                  <div className="text-xs text-(--tc-text-secondary,#4b5563)">
                    {a.from ?? "n/d"} → {a.to} • {new Date(a.created_at).toLocaleString()}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="mt-8 rounded-2xl border bg-white p-6 shadow">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-widest text-gray-500">Metas de Qualidade</div>
            <p className="text-sm text-(--tc-text-secondary,#4b5563)">Status das metas acordadas</p>
          </div>
          {goalsError && <span className="text-xs text-red-600">{goalsError}</span>}
        </div>
        {goals.length === 0 ? (
          <div className="mt-3 text-sm text-(--tc-text-muted,#6b7280)">Nenhuma meta configurada.</div>
        ) : (
          <ul className="mt-3 space-y-3">
            {goals.map((g, idx) => (
              <li
                key={g.id || idx}
                className="rounded-lg border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#ffffff) p-3 flex items-center justify-between"
                data-testid="quality-goal-item"
              >
                <div className="text-sm font-semibold text-(--tc-text-primary,#0b1a3c)">{g.goal}</div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-(--tc-text-secondary,#4b5563)">Atual: {g.current ?? "-"}</span>
                  <span
                    data-testid="quality-goal-status"
                    className={
                      g.status === "met"
                        ? "rounded-full bg-emerald-50 text-emerald-700 px-3 py-1 text-xs font-bold"
                        : g.status === "risk"
                        ? "rounded-full bg-amber-50 text-amber-700 px-3 py-1 text-xs font-bold"
                        : "rounded-full bg-red-50 text-red-700 px-3 py-1 text-xs font-bold"
                    }
                  >
                    {g.status === "met" ? "Atendida" : g.status === "risk" ? "Em risco" : "Violada"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="mt-8 rounded-2xl border bg-white p-6 shadow">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-widest text-gray-500">Qualidade por Release</div>
            <p className="text-sm text-(--tc-text-secondary,#4b5563)">Comparativo executivo entre releases</p>
          </div>
          {releaseQualityError && <span className="text-xs text-red-600">{releaseQualityError}</span>}
        </div>
        {releaseQuality.length === 0 ? (
          <div className="mt-3 text-sm text-(--tc-text-muted,#6b7280)">Nenhuma release avaliada.</div>
        ) : (
          <ul className="mt-3 space-y-3">
            {releaseQuality.map((r: any) => {
              const badgeClass =
                r.quality_status === "ok"
                  ? "bg-emerald-50 text-emerald-700"
                  : r.quality_status === "risk"
                  ? "bg-amber-50 text-amber-700"
                  : "bg-red-50 text-red-700";
              return (
                <li
                  key={r.release}
                  className="rounded-lg border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#ffffff) p-3 flex items-center justify-between gap-3"
                  data-testid={r.quality_status === "risk" ? "release-quality-risk" : undefined}
                >
                  <div className="space-y-1">
                    <div className="text-sm font-semibold text-(--tc-text-primary,#0b1a3c)">{r.release}</div>
                    <div className="text-xs text-(--tc-text-secondary,#4b5563)">
                      Defeitos: {r.defects?.total ?? 0} (abertos {r.defects?.open ?? 0}, fechados {r.defects?.closed ?? 0})
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-(--tc-text-secondary,#4b5563)">MTTR: {r.mttr_hours ?? "-"}h</span>
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${badgeClass}`}>
                      {r.quality_status === "ok" ? "OK" : r.quality_status === "risk" ? "Risco" : "Violada"}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
