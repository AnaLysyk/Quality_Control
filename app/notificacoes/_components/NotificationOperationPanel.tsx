"use client";

import type { ReactNode } from "react";
import useSWR from "swr";
import { FiBell, FiCheckCircle, FiCpu, FiLayers, FiRefreshCw, FiShield, FiSliders, FiUsers } from "react-icons/fi";

import { fetchApi } from "@/lib/api";

type NotificationModelPayload = {
  generatedAt: string;
  channels: string[];
  preferenceLayers: Array<{ id: string; label: string; priority: number; description: string; examples: string[] }>;
  workflows: Array<{
    id: string;
    eventType: string;
    label: string;
    category: string;
    description: string;
    criticality: string;
    mandatory: boolean;
    defaultChannels: string[];
    audienceScopes: string[];
    recipientRules: string[];
    preferenceRules: string[];
  }>;
  backlog: Array<{ id: string; title: string; area: string; priority: string; acceptanceCriteria: string[] }>;
  rules: string[];
  summary: {
    workflows: number;
    mandatory: number;
    configurable: number;
    channels: number;
    backlogItems: number;
    criticalBacklog: number;
  };
  preferenceSummary: {
    total: number;
    disabled: number;
    enabled: number;
    company: number;
    profile: number;
    user: number;
  };
};

async function fetcher(path: string) {
  const response = await fetchApi(path, { cache: "no-store" });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error || payload?.message || "Nao foi possivel carregar modelo de notificacoes.");
  }
  return payload as NotificationModelPayload;
}

function Badge({ children }: { children: ReactNode }) {
  return <span className="rounded-full border border-(--tc-border,#d7deea) bg-white px-2.5 py-1 text-[11px] font-bold text-(--tc-text-muted,#6b7280)">{children}</span>;
}

function StatCard({ label, value, note }: { label: string; value: string | number; note: string }) {
  return (
    <div className="rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-(--tc-text-muted,#6b7280)">{label}</p>
      <p className="mt-1 text-2xl font-black text-(--tc-text,#0b1a3c)">{value}</p>
      <p className="mt-1 text-xs leading-5 text-(--tc-text-muted,#6b7280)">{note}</p>
    </div>
  );
}

export function NotificationOperationPanel() {
  const { data, error, isLoading, mutate } = useSWR("/api/notification-model", fetcher, {
    refreshInterval: 60000,
    revalidateOnFocus: false,
  });

  return (
    <main className="space-y-5">
      <section className="rounded-[28px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#fff) p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-(--tc-text-muted,#6b7280)">
              <FiBell className="h-4 w-4 text-(--tc-accent,#ef0001)" /> Central de notificações
            </span>
            <h1 className="mt-3 text-2xl font-black text-(--tc-text,#0b1a3c)">Evento sempre registrado, recebimento configurável</h1>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-(--tc-text-secondary,#4b5563)">
              Modelo para notificações funcionais por empresa, perfil e usuário. Eventos críticos não podem ser desativados; eventos operacionais podem ter entrega suprimida, mas continuam auditáveis e visíveis para o Brain.
            </p>
          </div>
          <button type="button" onClick={() => void mutate()} className="inline-flex items-center gap-2 rounded-xl border border-(--tc-border,#d7deea) bg-white px-4 py-2 text-sm font-bold text-(--tc-text,#0b1a3c)">
            <FiRefreshCw className="h-4 w-4" /> Atualizar
          </button>
        </div>

        {error ? <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{error.message}</div> : null}

        <div className="mt-5 grid gap-3 md:grid-cols-6">
          <StatCard label="Eventos" value={isLoading ? "..." : data?.summary.workflows ?? 0} note="Catálogo inicial" />
          <StatCard label="Obrigatórios" value={isLoading ? "..." : data?.summary.mandatory ?? 0} note="Sem opt-out" />
          <StatCard label="Configuráveis" value={isLoading ? "..." : data?.summary.configurable ?? 0} note="Empresa/perfil/usuário" />
          <StatCard label="Canais" value={isLoading ? "..." : data?.summary.channels ?? 0} note="In-app, email, push, chat, Brain" />
          <StatCard label="Preferências" value={isLoading ? "..." : data?.preferenceSummary.total ?? 0} note="Ativas no store" />
          <StatCard label="Desativadas" value={isLoading ? "..." : data?.preferenceSummary.disabled ?? 0} note="Recebimento suprimido" />
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="space-y-4 rounded-[28px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#fff) p-5 shadow-sm">
          <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-(--tc-text-muted,#6b7280)">
            <FiLayers className="h-4 w-4 text-(--tc-accent,#ef0001)" /> Workflows de notificação
          </div>

          {data?.workflows.map((workflow) => (
            <article key={workflow.id} className="rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-(--tc-text-muted,#6b7280)">{workflow.eventType} · {workflow.category}</p>
                  <h2 className="mt-1 text-base font-black text-(--tc-text,#0b1a3c)">{workflow.label}</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge>{workflow.criticality}</Badge>
                  <Badge>{workflow.mandatory ? "Obrigatório" : "Configurável"}</Badge>
                </div>
              </div>
              <p className="mt-2 text-sm leading-6 text-(--tc-text-secondary,#4b5563)">{workflow.description}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {workflow.defaultChannels.map((channel) => <Badge key={channel}>{channel}</Badge>)}
              </div>
              <ul className="mt-3 space-y-1 text-xs leading-5 text-(--tc-text-secondary,#4b5563)">
                {workflow.preferenceRules.map((rule) => <li key={rule}>• {rule}</li>)}
              </ul>
            </article>
          ))}
        </div>

        <div className="space-y-4">
          <section className="rounded-[28px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#fff) p-5 shadow-sm">
            <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-(--tc-text-muted,#6b7280)">
              <FiSliders className="h-4 w-4 text-(--tc-accent,#ef0001)" /> Prioridade das preferências
            </div>
            <div className="mt-4 space-y-3">
              {data?.preferenceLayers.map((layer) => (
                <article key={layer.id} className="rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-sm font-black text-(--tc-text,#0b1a3c)">{layer.priority}. {layer.label}</h2>
                    <FiShield className="h-4 w-4 text-(--tc-accent,#ef0001)" />
                  </div>
                  <p className="mt-2 text-xs leading-5 text-(--tc-text-secondary,#4b5563)">{layer.description}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="rounded-[28px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#fff) p-5 shadow-sm">
            <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-(--tc-text-muted,#6b7280)">
              <FiCheckCircle className="h-4 w-4 text-(--tc-accent,#ef0001)" /> Regras duras
            </div>
            <ul className="mt-4 space-y-2 text-sm leading-6 text-(--tc-text-secondary,#4b5563)">
              {data?.rules.map((rule) => <li key={rule}>• {rule}</li>)}
            </ul>
          </section>

          <section className="rounded-[28px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#fff) p-5 shadow-sm">
            <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-(--tc-text-muted,#6b7280)">
              <FiCpu className="h-4 w-4 text-(--tc-accent,#ef0001)" /> Backlog de implementação
            </div>
            <div className="mt-4 space-y-3">
              {data?.backlog.map((item) => (
                <article key={item.id} className="rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-sm font-black text-(--tc-text,#0b1a3c)">{item.title}</h2>
                    <div className="flex gap-2"><Badge>{item.area}</Badge><Badge>{item.priority}</Badge></div>
                  </div>
                  <ul className="mt-3 space-y-1 text-xs leading-5 text-(--tc-text-secondary,#4b5563)">
                    {item.acceptanceCriteria.map((criteria) => <li key={criteria}>• {criteria}</li>)}
                  </ul>
                </article>
              ))}
            </div>
          </section>

          <section className="rounded-[28px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#fff) p-5 shadow-sm">
            <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-(--tc-text-muted,#6b7280)">
              <FiUsers className="h-4 w-4 text-(--tc-accent,#ef0001)" /> Preferências cadastradas
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <StatCard label="Empresa" value={data?.preferenceSummary.company ?? 0} note="Regras por empresa" />
              <StatCard label="Perfil" value={data?.preferenceSummary.profile ?? 0} note="Regras por perfil" />
              <StatCard label="Usuário" value={data?.preferenceSummary.user ?? 0} note="Regras individuais" />
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
