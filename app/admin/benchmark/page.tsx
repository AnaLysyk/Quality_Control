"use client";
import { useEffect, useState } from "react";
import { useAuthUser } from "@/hooks/useAuthUser";
import Breadcrumb from "@/components/Breadcrumb";


export default function AdminBenchmarkPage() {
  const { user, loading: userLoading } = useAuthUser();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState("30d");

  useEffect(() => {
    const isAdmin = Boolean(
      user?.isGlobalAdmin ||
        user?.globalRole === "global_admin" ||
        (typeof user?.role === "string" && user.role.toLowerCase() === "admin"),
    );
    if (userLoading || !user || !isAdmin) return;
    let canceled = false;
    setLoading(true);
    fetch(`/api/admin/benchmark?period=${period}`)
      .then((res) => res.json())
      .then((json) => {
        if (!canceled) setData(json);
      })
      .catch(() => {
        if (!canceled) setError("Erro ao carregar benchmark");
      })
      .finally(() => {
        if (!canceled) setLoading(false);
      });
    return () => {
      canceled = true;
    };
  }, [period, userLoading, user]);


  if (userLoading || !user) {
    return <div className="p-8 text-center text-lg">Carregando...</div>;
  }
  const isAdmin = Boolean(
    user?.isGlobalAdmin ||
      user?.globalRole === "global_admin" ||
      (typeof user?.role === "string" && user.role.toLowerCase() === "admin"),
  );
  if (!isAdmin) {
    return <div className="p-8 text-center text-lg">Acesso restrito ao admin.</div>;
  }

  return (
    <div className="min-h-screen bg-(--page-bg,#f7f9fb) text-(--page-text,#0b1a3c)">
      <div className="mx-auto w-full max-w-7xl px-4 pt-4 sm:px-6 sm:pt-6 lg:px-10 lg:pt-10 space-y-6">
        <Breadcrumb items={[{ label: "Admin", href: "/admin" }, { label: "Benchmark" }]} />
        <header className="space-y-2">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-(--tc-text-primary,#0b1a3c)">Benchmark entre empresas</h1>
          <p className="text-sm sm:text-base text-(--tc-text-secondary,#4b5563)">
            Ranking de risco, qualidade e priorização de suporte.
          </p>
        </header>
        <div className="flex gap-2 mb-4">
          <button
            className={`rounded px-3 py-1 text-sm font-semibold border ${period === "30d" ? "bg-(--tc-accent,#ef0001) text-white" : "bg-white text-(--tc-accent,#ef0001) border-(--tc-accent,#ef0001)"}`}
            data-testid="benchmark-period-30d"
            onClick={() => setPeriod("30d")}
          >
            30 dias
          </button>
          <button
            className={`rounded px-3 py-1 text-sm font-semibold border ${period === "7d" ? "bg-(--tc-accent,#ef0001) text-white" : "bg-white text-(--tc-accent,#ef0001) border-(--tc-accent,#ef0001)"}`}
            data-testid="benchmark-period-7d"
            onClick={() => setPeriod("7d")}
          >
            7 dias
          </button>
        </div>
        <section data-testid="benchmark">
          {loading && <div className="text-sm text-(--tc-text-muted,#6b7280)">Carregando ranking...</div>}
          {error && <div className="text-sm text-red-500">{error}</div>}
          {data && Array.isArray(data.items) && data.items.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {data.items.map((item: any) => (
                <div
                  key={item.companySlug}
                  data-testid="benchmark-card"
                  className="rounded-2xl border bg-white p-6 shadow flex flex-col gap-2"
                >
                  <div className="flex items-center gap-2">
                    <span className={`inline-block w-2 h-2 rounded-full ${item.risk === "high" ? "bg-red-500" : item.risk === "medium" ? "bg-yellow-400" : "bg-green-500"}`}></span>
                    <span className="font-bold text-lg" data-testid="benchmark-company">{item.companyName}</span>
                    <span className="ml-auto text-xs uppercase tracking-widest text-gray-500" data-testid="benchmark-risk">{item.risk}</span>
                  </div>
                  <div className="flex flex-wrap gap-4 mt-2">
                    <div>
                      <div className="text-xs text-gray-500">Score</div>
                      <div className="text-xl font-bold" data-testid="benchmark-score">{item.score}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">MTTR</div>
                      <div className="text-xl font-bold">{item.mttrDays ?? "—"} dias</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Abertos</div>
                      <div className="text-xl font-bold">{item.openDefects}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Fora SLA</div>
                      <div className="text-xl font-bold">{item.overSla}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Falhas</div>
                      <div className="text-xl font-bold">{item.failedReleases}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Tendência</div>
                      <div className="text-xl font-bold">{item.trend}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            !loading && <div className="text-sm text-(--tc-text-muted,#6b7280)">Nenhum dado encontrado.</div>
          )}
        </section>
      </div>
    </div>
  );
}
