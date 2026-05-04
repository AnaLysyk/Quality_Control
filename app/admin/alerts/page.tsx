"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";

type AlertItem = {
  companySlug: string;
  type: string;
  severity: string;
  message: string;
  timestamp: string;
};

export default function AdminAlertsPage() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let canceled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/admin/alerts", { cache: "no-store" });
        if (!res.ok) throw new Error("Erro ao carregar alertas");
        const json = await res.json().catch(() => ({ alerts: [] }));
        if (!canceled) {
          setAlerts(Array.isArray(json.alerts) ? json.alerts : []);
        }
      } catch (err) {
        if (!canceled) setError(err instanceof Error ? err.message : "Erro ao carregar alertas");
      } finally {
        if (!canceled) setLoading(false);
      }
    };
    load();
    return () => {
      canceled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-(--page-bg,#f7f9fb) text-(--page-text,#0b1a3c)">
      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-10">
        <h1 className="text-2xl font-bold mb-4">Alertas de Qualidade</h1>
        {loading && <div>Carregando...</div>}
        {error && <div className="text-red-600">{error}</div>}
        {!loading && !error && (
          <div className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-white p-4 shadow-sm">
            {alerts.length === 0 ? (
              <div className="text-sm text-(--tc-text-muted,#6b7280)">Nenhum alerta registrado.</div>
            ) : (
              <ul className="space-y-3">
                {alerts
                  .slice()
                  .sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)))
                  .map((alert, idx) => (
                    <li
                      key={`${alert.companySlug}-${alert.type}-${alert.timestamp}-${idx}`}
                      data-testid="quality-alert"
                      className="rounded-lg border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#ffffff) p-3 text-sm"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-semibold">{alert.message}</div>
                        <span
                          className={
                            alert.severity === "critical"
                              ? "text-red-600 font-bold text-xs"
                              : "text-yellow-600 font-bold text-xs"
                          }
                        >
                          {alert.severity.toUpperCase()}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-(--tc-text-muted,#6b7280)">
                        {alert.companySlug} • {alert.type} • {new Date(alert.timestamp).toLocaleString()}
                      </div>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
