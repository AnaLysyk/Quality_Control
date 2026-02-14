import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getAccessContextFromStores } from "@/lib/auth/session";
import { readAlertsStore, type QualityAlert } from "@/lib/qualityAlert";

type Severity = QualityAlert["severity"] | string;

const SEVERITY_STYLES: Record<string, string> = {
  critical: "text-red-600 font-bold text-xs",
  warning: "text-amber-600 font-bold text-xs",
  info: "text-sky-600 font-bold text-xs",
};

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function resolveSeverityStyle(severity: Severity) {
  const key = typeof severity === "string" ? severity.toLowerCase() : "";
  return SEVERITY_STYLES[key] ?? "text-slate-600 font-bold text-xs";
}

export const dynamic = "force-dynamic";

export default async function AdminAlertsPage() {
  const cookieStore = await cookies();
  const access = await getAccessContextFromStores(undefined, cookieStore);

  if (!access) {
    redirect("/login");
  }
  if (!access.isGlobalAdmin) {
    redirect("/admin");
  }

  let alerts: QualityAlert[] = [];
  let error: string | null = null;

  try {
    alerts = await readAlertsStore();
  } catch (err) {
    console.error("[admin/alerts] Falha ao ler alertas", err);
    error = "Não foi possível carregar os alertas";
  }

  const orderedAlerts = alerts
    .slice()
    .sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));

  return (
    <div className="min-h-screen bg-(--page-bg,#f7f9fb) text-(--page-text,#0b1a3c)">
      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-10">
        <h1 className="mb-4 text-2xl font-bold">Alertas de Qualidade</h1>
        {error ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
        ) : (
          <div className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-white p-4 shadow-sm">
            {orderedAlerts.length === 0 ? (
              <div className="text-sm text-(--tc-text-muted,#6b7280)">Nenhum alerta registrado.</div>
            ) : (
              <ul className="space-y-3">
                {orderedAlerts.map((alert, idx) => (
                  <li
                    key={`${alert.companySlug}-${alert.type}-${alert.timestamp}-${idx}`}
                    data-testid="quality-alert"
                    className="rounded-lg border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#ffffff) p-3 text-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-semibold">{alert.message}</div>
                      <span className={resolveSeverityStyle(alert.severity)}>{String(alert.severity).toUpperCase()}</span>
                    </div>
                    <div className="mt-1 text-xs text-(--tc-text-muted,#6b7280)">
                      {alert.companySlug} • {alert.type} • {formatTimestamp(alert.timestamp)}
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
