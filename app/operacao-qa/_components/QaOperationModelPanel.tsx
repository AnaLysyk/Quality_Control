"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { FiActivity, FiBarChart2, FiCheckCircle, FiCpu, FiGitBranch, FiLayers, FiList, FiMessageCircle, FiPlayCircle } from "react-icons/fi";

import { fetchApi } from "@/lib/api";

type QaOperationStep = {
  id: string;
  title: string;
  kind: string;
  description: string;
  required: boolean;
  emptyState: string;
  routes: string[];
  owns: string[];
  rules: string[];
};

type QaMetricDefinition = {
  id: string;
  label: string;
  scope: string;
  description: string;
  formula: string;
  source: string[];
};

type BrianOperationCommand = {
  id: string;
  label: string;
  intent: string;
  example: string;
  requiredContext: string[];
  actions: string[];
  guardrails: string[];
};

type QaImplementationBacklogItem = {
  id: string;
  title: string;
  area: string;
  priority: string;
  status: string;
  acceptanceCriteria: string[];
};

type OperationModelPayload = {
  generatedAt: string;
  hierarchy: QaOperationStep[];
  automationStatusFlow: Array<{ status: string; label: string; meaning: string; visibleInAutomation: boolean }>;
  runLifecycle: string[];
  metrics: QaMetricDefinition[];
  brianCommands: BrianOperationCommand[];
  backlog: QaImplementationBacklogItem[];
  summary: {
    hierarchyItems: number;
    metrics: number;
    brianCommands: number;
    backlogItems: number;
    criticalBacklog: number;
    readyBacklog: number;
  };
};

type TabId = "hierarchy" | "automation" | "runs" | "metrics" | "brian" | "backlog";

async function fetcher(path: string) {
  const response = await fetchApi(path, { cache: "no-store" });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error || payload?.message || "Nao foi possivel carregar o modelo operacional de QA.");
  }
  return payload as OperationModelPayload;
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full border border-[var(--tc-border,#d7deea)] bg-white px-2.5 py-1 text-[11px] font-bold text-[var(--tc-text-muted,#6b7280)]">{children}</span>;
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return <article className="rounded-2xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] p-4 shadow-sm">{children}</article>;
}

const tabs: Array<{ id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: "hierarchy", label: "Modelo", icon: FiLayers },
  { id: "automation", label: "Automação", icon: FiCpu },
  { id: "runs", label: "Runs", icon: FiPlayCircle },
  { id: "metrics", label: "Métricas", icon: FiBarChart2 },
  { id: "brian", label: "Brian", icon: FiMessageCircle },
  { id: "backlog", label: "Backlog", icon: FiList },
];

export function QaOperationModelPanel() {
  const { data, error, isLoading } = useSWR("/api/quality/operation-model", fetcher, {
    refreshInterval: 60000,
    revalidateOnFocus: false,
  });
  const [tab, setTab] = useState<TabId>("hierarchy");

  const criticalBacklog = useMemo(() => data?.backlog.filter((item) => item.priority === "critical") ?? [], [data]);

  const summaryCards: Array<{ label: string; value: number; icon: React.ComponentType<{ className?: string }> }> = [
    { label: "Blocos", value: data?.summary.hierarchyItems ?? 0, icon: FiLayers },
    { label: "Métricas", value: data?.summary.metrics ?? 0, icon: FiBarChart2 },
    { label: "Comandos Brian", value: data?.summary.brianCommands ?? 0, icon: FiMessageCircle },
    { label: "Backlog", value: data?.summary.backlogItems ?? 0, icon: FiList },
    { label: "Prontos", value: data?.summary.readyBacklog ?? 0, icon: FiCheckCircle },
  ];

  return (
    <main className="space-y-5">
      <section className="rounded-[28px] border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#fff)] p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-[var(--tc-text-muted,#6b7280)]">
              <FiGitBranch className="h-4 w-4 text-[var(--tc-accent,#ef0001)]" /> Modelo operacional de QA
            </span>
            <h1 className="mt-3 text-2xl font-black text-[var(--tc-text,#0b1a3c)]">Projeto → Repositório → Plano → Run → Métricas → Brian</h1>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-[var(--tc-text-secondary,#4b5563)]">
              Organização canônica para o Quality Control: toda execução nasce de um plano, todo plano puxa casos do repositório do projeto, todo resultado gera número e o Brian opera com auditoria.
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] px-4 py-3 text-sm font-bold text-[var(--tc-text,#0b1a3c)]">
            {isLoading ? "Carregando..." : `${data?.summary.criticalBacklog ?? 0} críticos prontos`}
          </div>
        </div>

        {error ? <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{error.message}</div> : null}

        <div className="mt-5 grid gap-3 md:grid-cols-5">
          {summaryCards.map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-2xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--tc-text-muted,#6b7280)]">{label}</p>
                <Icon className="h-4 w-4 text-[var(--tc-accent,#ef0001)]" />
              </div>
              <p className="mt-1 text-2xl font-black text-[var(--tc-text,#0b1a3c)]">{isLoading ? "..." : String(value)}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {tabs.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold ${active ? "border-[var(--tc-accent,#ef0001)] bg-[var(--tc-accent,#ef0001)] text-white" : "border-[var(--tc-border,#d7deea)] bg-white text-[var(--tc-text,#0b1a3c)]"}`}
              >
                <Icon className="h-4 w-4" /> {item.label}
              </button>
            );
          })}
        </div>
      </section>

      {tab === "hierarchy" ? (
        <section className="grid gap-3 lg:grid-cols-2">
          {data?.hierarchy.map((item, index) => (
            <SectionCard key={item.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--tc-text-muted,#6b7280)]">{String(index + 1).padStart(2, "0")} · {item.kind}</p>
                  <h2 className="mt-1 text-lg font-black text-[var(--tc-text,#0b1a3c)]">{item.title}</h2>
                  <p className="mt-1 text-sm leading-6 text-[var(--tc-text-secondary,#4b5563)]">{item.description}</p>
                </div>
                <Badge>{item.required ? "Obrigatório" : "Opcional"}</Badge>
              </div>
              <p className="mt-3 rounded-xl border border-[var(--tc-border,#d7deea)] bg-white p-3 text-sm font-semibold text-[var(--tc-text,#0b1a3c)]">Vazio: {item.emptyState}</p>
              <div className="mt-3 flex flex-wrap gap-2">{item.routes.map((route) => <Badge key={route}>{route}</Badge>)}</div>
              <ul className="mt-3 space-y-1 text-xs leading-5 text-[var(--tc-text-secondary,#4b5563)]">{item.rules.map((rule) => <li key={rule}>• {rule}</li>)}</ul>
            </SectionCard>
          ))}
        </section>
      ) : null}

      {tab === "automation" ? (
        <section className="grid gap-3 lg:grid-cols-2">
          {data?.automationStatusFlow.map((item) => (
            <SectionCard key={item.status}>
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-black text-[var(--tc-text,#0b1a3c)]">{item.label}</h2>
                <Badge>{item.visibleInAutomation ? "Aparece na automação" : "Só manual"}</Badge>
              </div>
              <p className="mt-2 text-sm leading-6 text-[var(--tc-text-secondary,#4b5563)]">{item.meaning}</p>
              <p className="mt-3 font-mono text-xs font-bold text-[var(--tc-accent,#ef0001)]">{item.status}</p>
            </SectionCard>
          ))}
        </section>
      ) : null}

      {tab === "runs" ? (
        <section className="rounded-[28px] border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#fff)] p-5 shadow-sm">
          <h2 className="text-xl font-black text-[var(--tc-text,#0b1a3c)]">Lifecycle obrigatório da execução</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {data?.runLifecycle.map((step, index) => (
              <div key={step} className="flex gap-3 rounded-2xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] p-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--tc-accent,#ef0001)] text-sm font-black text-white">{index + 1}</span>
                <p className="text-sm font-semibold leading-6 text-[var(--tc-text,#0b1a3c)]">{step}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {tab === "metrics" ? (
        <section className="grid gap-3 lg:grid-cols-2">
          {data?.metrics.map((metric) => (
            <SectionCard key={metric.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--tc-text-muted,#6b7280)]">{metric.scope}</p>
                  <h2 className="mt-1 text-lg font-black text-[var(--tc-text,#0b1a3c)]">{metric.label}</h2>
                </div>
                <FiActivity className="h-5 w-5 text-[var(--tc-accent,#ef0001)]" />
              </div>
              <p className="mt-2 text-sm leading-6 text-[var(--tc-text-secondary,#4b5563)]">{metric.description}</p>
              <p className="mt-3 rounded-xl border border-[var(--tc-border,#d7deea)] bg-white p-3 font-mono text-xs leading-5 text-[var(--tc-text,#0b1a3c)]">{metric.formula}</p>
              <div className="mt-3 flex flex-wrap gap-2">{metric.source.map((source) => <Badge key={source}>{source}</Badge>)}</div>
            </SectionCard>
          ))}
        </section>
      ) : null}

      {tab === "brian" ? (
        <section className="grid gap-3 lg:grid-cols-2">
          {data?.brianCommands.map((command) => (
            <SectionCard key={command.id}>
              <h2 className="text-lg font-black text-[var(--tc-text,#0b1a3c)]">{command.label}</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--tc-text-secondary,#4b5563)]">{command.intent}</p>
              <p className="mt-3 rounded-xl border border-[var(--tc-border,#d7deea)] bg-white p-3 text-sm font-bold text-[var(--tc-text,#0b1a3c)]">“{command.example}”</p>
              <div className="mt-3 flex flex-wrap gap-2">{command.requiredContext.map((context) => <Badge key={context}>{context}</Badge>)}</div>
              <ul className="mt-3 space-y-1 text-xs leading-5 text-[var(--tc-text-secondary,#4b5563)]">{command.guardrails.map((rule) => <li key={rule}>• {rule}</li>)}</ul>
            </SectionCard>
          ))}
        </section>
      ) : null}

      {tab === "backlog" ? (
        <section className="space-y-3">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
            Primeira fila crítica: {criticalBacklog.map((item) => item.title).join(" · ") || "sem itens críticos"}
          </div>
          {data?.backlog.map((item) => (
            <SectionCard key={item.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--tc-text-muted,#6b7280)]">{item.area}</p>
                  <h2 className="mt-1 text-lg font-black text-[var(--tc-text,#0b1a3c)]">{item.title}</h2>
                </div>
                <div className="flex gap-2"><Badge>{item.priority}</Badge><Badge>{item.status}</Badge></div>
              </div>
              <ul className="mt-3 space-y-1 text-sm leading-6 text-[var(--tc-text-secondary,#4b5563)]">{item.acceptanceCriteria.map((criteria) => <li key={criteria}>• {criteria}</li>)}</ul>
            </SectionCard>
          ))}
        </section>
      ) : null}
    </main>
  );
}

