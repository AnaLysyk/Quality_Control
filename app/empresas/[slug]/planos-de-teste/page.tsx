"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { FiClipboard, FiLayers } from "react-icons/fi";
import { fetchApi } from "@/lib/api";

type ApplicationItem = {
  id: string;
  name: string;
  slug: string;
  qaseProjectCode?: string | null;
  source?: string | null;
};

type TestPlanItem = {
  id: string;
  title: string;
  description?: string | null;
  casesCount: number;
  createdAt?: string | null;
  updatedAt?: string | null;
};

function formatDate(value?: string | null) {
  if (!value) return "Sem data";
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return "Sem data";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(time);
}

export default function TestPlansPage() {
  const { slug } = useParams<{ slug: string }>();
  const [applications, setApplications] = useState<ApplicationItem[]>([]);
  const [selectedApplicationId, setSelectedApplicationId] = useState<string>("");
  const [plans, setPlans] = useState<TestPlanItem[]>([]);
  const [loadingApplications, setLoadingApplications] = useState(true);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [projectCode, setProjectCode] = useState<string | null>(null);
  const [totalTests, setTotalTests] = useState(0);

  useEffect(() => {
    if (!slug) return;
    let canceled = false;

    async function loadApplications() {
      setLoadingApplications(true);
      setError(null);
      try {
        const response = await fetchApi(`/api/applications?companySlug=${encodeURIComponent(slug)}`);
        const payload = await response.json().catch(() => null);
        if (!response.ok) throw new Error("Erro ao carregar aplicacoes");
        const items = Array.isArray(payload?.items) ? (payload.items as ApplicationItem[]) : [];
        if (canceled) return;
        setApplications(items);
        setSelectedApplicationId(items[0]?.id ?? "");
      } catch {
        if (!canceled) setError("Nao foi possivel carregar as aplicacoes da empresa.");
      } finally {
        if (!canceled) setLoadingApplications(false);
      }
    }

    void loadApplications();

    return () => {
      canceled = true;
    };
  }, [slug]);

  const selectedApplication = useMemo(
    () => applications.find((item) => item.id === selectedApplicationId) ?? null,
    [applications, selectedApplicationId],
  );

  useEffect(() => {
    if (!slug || !selectedApplicationId) {
      setPlans([]);
      setWarning(null);
      setProjectCode(null);
      setTotalTests(0);
      return;
    }

    let canceled = false;

    async function loadPlans() {
      setLoadingPlans(true);
      setError(null);
      try {
        const response = await fetchApi(
          `/api/test-plans?companySlug=${encodeURIComponent(slug)}&applicationId=${encodeURIComponent(selectedApplicationId)}`,
        );
        const payload = await response.json().catch(() => null);
        if (canceled) return;

        if (!response.ok && !payload?.warning) {
          throw new Error("Erro ao carregar planos");
        }

        setPlans(Array.isArray(payload?.plans) ? payload.plans : []);
        setWarning(typeof payload?.warning === "string" ? payload.warning : null);
        setProjectCode(typeof payload?.projectCode === "string" ? payload.projectCode : null);
        setTotalTests(typeof payload?.totalTests === "number" ? payload.totalTests : 0);
      } catch {
        if (!canceled) {
          setPlans([]);
          setProjectCode(null);
          setTotalTests(0);
          setWarning(null);
          setError("Nao foi possivel consultar os planos de teste.");
        }
      } finally {
        if (!canceled) setLoadingPlans(false);
      }
    }

    void loadPlans();

    return () => {
      canceled = true;
    };
  }, [selectedApplicationId, slug]);

  return (
    <div className="min-h-screen bg-(--page-bg,#f5f6fa) px-4 py-8 text-(--page-text,#0b1a3c) sm:px-6 lg:px-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="rounded-3xl bg-white p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.4em] text-(--tc-accent,#ef0001)">Planos de teste</p>
          <h1 className="mt-2 text-3xl font-extrabold">Planos da empresa {slug}</h1>
          <p className="mt-2 text-sm text-(--tc-text-secondary,#4b5563)">
            A tela usa a aplicacao como origem do projeto. Se a aplicacao tiver project code do Qase, os planos sao carregados desse projeto.
          </p>
        </header>

        <section className="rounded-3xl border border-(--tc-border,#e5e7eb) bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-(--tc-text,#0b1a3c)">Aplicacao em foco</h2>
              <p className="mt-1 text-sm text-(--tc-text-secondary,#4b5563)">
                Aplicacoes manuais continuam na lista, mas so aplicacoes com Qase conseguem puxar planos automaticamente.
              </p>
            </div>
          </div>

          {loadingApplications ? (
            <p className="mt-4 text-sm text-(--tc-text-muted,#6b7280)">Carregando aplicacoes...</p>
          ) : applications.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-(--tc-border,#d8dee9) bg-(--tc-surface,#f9fafb) p-6 text-sm text-(--tc-text-secondary,#4b5563)">
              Nenhuma aplicacao cadastrada para esta empresa.
            </div>
          ) : (
            <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
              <label className="block text-xs font-semibold text-(--tc-text-muted,#6b7280)">
                Aplicacao
                <select
                  value={selectedApplicationId}
                  onChange={(event) => setSelectedApplicationId(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-(--tc-border,#e5e7eb) bg-(--tc-input-bg,#eef4ff) px-3 py-2 text-sm text-(--tc-text,#0b1a3c) outline-none focus:ring-2 focus:ring-(--tc-accent,#ef0001)"
                >
                  {applications.map((application) => (
                    <option key={application.id} value={application.id}>
                      {application.name}
                      {application.qaseProjectCode ? ` (${application.qaseProjectCode})` : " (manual)"}
                    </option>
                  ))}
                </select>
              </label>

              <div className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#f9fafb) px-4 py-3 text-sm text-(--tc-text-secondary,#4b5563)">
                Projeto vinculado: <span className="font-semibold text-(--tc-text,#0b1a3c)">{projectCode ?? selectedApplication?.qaseProjectCode ?? "Sem Qase"}</span>
              </div>
            </div>
          )}
        </section>

        {error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
        ) : null}

        {warning ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">{warning}</div>
        ) : null}

        <section className="rounded-3xl border border-(--tc-border,#e5e7eb) bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-(--tc-text,#0b1a3c)">Planos encontrados</h2>
              <p className="mt-1 text-sm text-(--tc-text-secondary,#4b5563)">
                {projectCode ? `${plans.length} plano(s) carregado(s) para ${projectCode} | ${totalTests} casos no total.` : "Selecione uma aplicacao integrada para consultar os planos."}
              </p>
            </div>
          </div>

          {loadingPlans ? (
            <p className="mt-4 text-sm text-(--tc-text-muted,#6b7280)">Carregando planos de teste...</p>
          ) : plans.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-(--tc-border,#d8dee9) bg-(--tc-surface,#f9fafb) p-8 text-center">
              <FiClipboard size={28} className="mx-auto text-(--tc-text-muted,#6b7280)" />
              <p className="mt-3 text-sm text-(--tc-text-secondary,#4b5563)">
                Nenhum plano retornado para a aplicacao atual.
              </p>
            </div>
          ) : (
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#f9fafb) p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-base font-bold text-(--tc-text,#0b1a3c)">{plan.title}</div>
                      <div className="mt-1 text-xs uppercase tracking-[0.2em] text-(--tc-text-muted,#6b7280)">
                        ID {plan.id}
                      </div>
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                      <FiLayers size={12} />
                      {plan.casesCount} casos
                    </div>
                  </div>

                  <p className="mt-3 text-sm text-(--tc-text-secondary,#4b5563)">
                    {plan.description?.trim() || "Plano sem descricao detalhada no retorno atual do Qase."}
                  </p>

                  <div className="mt-4 text-xs text-(--tc-text-muted,#6b7280)">
                    Criado: {formatDate(plan.createdAt)} | Atualizado: {formatDate(plan.updatedAt)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
