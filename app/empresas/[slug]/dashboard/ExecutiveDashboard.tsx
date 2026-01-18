"use client";
import React, { useEffect, useState } from "react";

export default function ExecutiveDashboard({ slug }: { slug: string }) {
  const [data, setData] = useState<any>(null);
  const [releaseStatus, setReleaseStatus] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  if (loading) return <div>Carregando dashboard...</div>;
  if (error) return <div className="text-red-600">{error}</div>;
  if (!data) return <div>Nenhum dado encontrado.</div>;

  return (
    <>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
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
                      href={`/release/${encodeURIComponent(r.version)}`}
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
    </>
  );
}
