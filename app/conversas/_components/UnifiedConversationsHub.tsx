"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import useSWR from "swr";
import { FiBarChart2, FiCpu, FiMessageCircle, FiRefreshCw, FiShield, FiUsers } from "react-icons/fi";

import { fetchApi } from "@/backend/api";

type ConversationSignal = {
  id: string;
  messageId: string;
  threadKey: string;
  summary: string;
  status: string;
  reason: string;
  createdAt: string;
  actorName: string;
  peerName: string;
  companySlug: string | null;
  companyName: string | null;
  projectSlug: string | null;
  profileKind: string | null;
};

type FeedPayload = {
  generatedAt: string;
  summary: {
    total: number;
    candidates: number;
    approved: number;
    ignored: number;
    companies: number;
    projects: number;
  };
  signals: ConversationSignal[];
  model: {
    summary: {
      rules: number;
      requiredRules: number;
      metrics: number;
      brianActions: number;
    };
    rules: Array<{ id: string; title: string; description: string; required: boolean; acceptanceCriteria: string[] }>;
    metrics: Array<{ id: string; label: string; description: string; formula: string; source: string[] }>;
    brianActions: Array<{ id: string; label: string; userCommand: string; requiredContext: string[]; expectedResult: string[] }>;
  };
};

async function fetcher(path: string) {
  const response = await fetchApi(path, { cache: "no-store" });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error || payload?.message || "Nao foi possivel carregar o hub de conversas.");
  }
  return payload as FeedPayload;
}

function StatCard({ label, value, note }: { label: string; value: string | number; note: string }) {
  return (
    <div className="rounded-2xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--tc-text-muted,#6b7280)]">{label}</p>
      <p className="mt-1 text-2xl font-black text-[var(--tc-text,#0b1a3c)]">{value}</p>
      <p className="mt-1 text-xs leading-5 text-[var(--tc-text-muted,#6b7280)]">{note}</p>
    </div>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return <span className="rounded-full border border-[var(--tc-border,#d7deea)] bg-white px-2.5 py-1 text-[11px] font-bold text-[var(--tc-text-muted,#6b7280)]">{children}</span>;
}

export function UnifiedConversationsHub() {
  const { data, error, isLoading, mutate } = useSWR("/api/chat/brain-feed?limit=80", fetcher, {
    refreshInterval: 60000,
    revalidateOnFocus: false,
  });

  return (
    <main className="space-y-5">
      <section className="rounded-[28px] border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#fff)] p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-[var(--tc-text-muted,#6b7280)]">
              <FiMessageCircle className="h-4 w-4 text-[var(--tc-accent,#ef0001)]" /> Conversas unificadas
            </span>
            <h1 className="mt-3 text-2xl font-black text-[var(--tc-text,#0b1a3c)]">Um lugar único para empresa, projeto, perfil e Brain</h1>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-[var(--tc-text-secondary,#4b5563)]">
              Todas as conversas continuam acontecendo no mesmo chat, mas agora cada mensagem pode carregar contexto de empresa, projeto e perfil para alimentar memória, métricas e ações do Brian.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href="/chat" className="inline-flex items-center gap-2 rounded-xl bg-[var(--tc-accent,#ef0001)] px-4 py-2 text-sm font-black text-white">
              <FiMessageCircle className="h-4 w-4" /> Abrir chat único
            </Link>
            <button type="button" onClick={() => void mutate()} className="inline-flex items-center gap-2 rounded-xl border border-[var(--tc-border,#d7deea)] bg-white px-4 py-2 text-sm font-bold text-[var(--tc-text,#0b1a3c)]">
              <FiRefreshCw className="h-4 w-4" /> Atualizar
            </button>
          </div>
        </div>

        {error ? <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{error.message}</div> : null}

        <div className="mt-5 grid gap-3 md:grid-cols-6">
          <StatCard label="Sinais" value={isLoading ? "..." : data?.summary.total ?? 0} note="Mensagens relevantes" />
          <StatCard label="Candidatos" value={isLoading ? "..." : data?.summary.candidates ?? 0} note="Para o Brain lembrar" />
          <StatCard label="Empresas" value={isLoading ? "..." : data?.summary.companies ?? 0} note="Com contexto capturado" />
          <StatCard label="Projetos" value={isLoading ? "..." : data?.summary.projects ?? 0} note="Com projeto informado" />
          <StatCard label="Regras" value={isLoading ? "..." : data?.model.summary.requiredRules ?? 0} note="Obrigatórias" />
          <StatCard label="Ações Brian" value={isLoading ? "..." : data?.model.summary.brianActions ?? 0} note="Conversacionais" />
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="space-y-4 rounded-[28px] border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#fff)] p-5 shadow-sm">
          <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-[var(--tc-text-muted,#6b7280)]">
            <FiCpu className="h-4 w-4 text-[var(--tc-accent,#ef0001)]" /> Feed para memória do Brain
          </div>

          {data?.signals.length ? (
            data.signals.map((signal) => (
              <article key={signal.id} className="rounded-2xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-black text-[var(--tc-text,#0b1a3c)]">{signal.actorName} → {signal.peerName}</h2>
                    <p className="mt-1 text-xs leading-5 text-[var(--tc-text-muted,#6b7280)]">{new Date(signal.createdAt).toLocaleString("pt-BR")}</p>
                  </div>
                  <Badge>{signal.status}</Badge>
                </div>
                <p className="mt-3 text-sm leading-6 text-[var(--tc-text-secondary,#4b5563)]">{signal.summary}</p>
                <p className="mt-2 text-xs font-semibold text-[var(--tc-text-muted,#6b7280)]">{signal.reason}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {signal.companyName ? <Badge>{signal.companyName}</Badge> : null}
                  {signal.companySlug ? <Badge>{signal.companySlug}</Badge> : null}
                  {signal.projectSlug ? <Badge>{signal.projectSlug}</Badge> : null}
                  {signal.profileKind ? <Badge>{signal.profileKind}</Badge> : null}
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] p-5 text-sm font-semibold text-[var(--tc-text-muted,#6b7280)]">
              Ainda não há mensagens candidatas para memória. Envie no chat algo com regra, decisão, bug, plano, run, automação ou peça para “lembrar”.
            </div>
          )}
        </div>

        <div className="space-y-4">
          <section className="rounded-[28px] border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#fff)] p-5 shadow-sm">
            <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-[var(--tc-text-muted,#6b7280)]">
              <FiShield className="h-4 w-4 text-[var(--tc-accent,#ef0001)]" /> Regras de funcionamento
            </div>
            <div className="mt-4 space-y-3">
              {data?.model.rules.map((rule) => (
                <article key={rule.id} className="rounded-2xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-sm font-black text-[var(--tc-text,#0b1a3c)]">{rule.title}</h2>
                    {rule.required ? <Badge>Obrigatório</Badge> : null}
                  </div>
                  <p className="mt-2 text-xs leading-5 text-[var(--tc-text-secondary,#4b5563)]">{rule.description}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="rounded-[28px] border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#fff)] p-5 shadow-sm">
            <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-[var(--tc-text-muted,#6b7280)]">
              <FiUsers className="h-4 w-4 text-[var(--tc-accent,#ef0001)]" /> O que o Brian pode fazer
            </div>
            <div className="mt-4 space-y-3">
              {data?.model.brianActions.map((action) => (
                <article key={action.id} className="rounded-2xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] p-4">
                  <h2 className="text-sm font-black text-[var(--tc-text,#0b1a3c)]">{action.label}</h2>
                  <p className="mt-2 rounded-xl border border-[var(--tc-border,#d7deea)] bg-white p-3 text-xs font-bold text-[var(--tc-text,#0b1a3c)]">“{action.userCommand}”</p>
                  <div className="mt-3 flex flex-wrap gap-2">{action.requiredContext.map((item) => <Badge key={item}>{item}</Badge>)}</div>
                </article>
              ))}
            </div>
          </section>

          <section className="rounded-[28px] border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#fff)] p-5 shadow-sm">
            <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-[var(--tc-text-muted,#6b7280)]">
              <FiBarChart2 className="h-4 w-4 text-[var(--tc-accent,#ef0001)]" /> Métricas futuras
            </div>
            <div className="mt-4 space-y-3">
              {data?.model.metrics.map((metric) => (
                <article key={metric.id} className="rounded-2xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] p-4">
                  <h2 className="text-sm font-black text-[var(--tc-text,#0b1a3c)]">{metric.label}</h2>
                  <p className="mt-2 text-xs leading-5 text-[var(--tc-text-secondary,#4b5563)]">{metric.description}</p>
                  <p className="mt-2 font-mono text-[11px] text-[var(--tc-text-muted,#6b7280)]">{metric.formula}</p>
                </article>
              ))}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

