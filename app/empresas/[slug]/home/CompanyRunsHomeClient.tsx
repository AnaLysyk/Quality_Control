"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  FiActivity,
  FiAlertTriangle,
  FiArrowRight,
  FiCheckCircle,
  FiExternalLink,
  FiLayers,
  FiPlayCircle,
  FiRefreshCw,
  FiShield,
  FiTarget,
} from "react-icons/fi";
import { CreateManualReleaseButton } from "@/components/CreateManualReleaseButton";
import { getAppColorClass, getAppMeta } from "@/lib/appMeta";
import type {
  CompanyRunsHeroStats,
  HomeRunItem,
  HomeStatusBadge,
  RunIntegrationProvider,
  RunSourceType,
  Tone,
} from "./homeTypes";

type CompanyRunsHomeClientProps = {
  companySlug: string;
  companyName: string;
  companyInitials: string;
  subtitle: string;
  companyStatus: HomeStatusBadge;
  integrationStatus: HomeStatusBadge;
  heroStats: CompanyRunsHeroStats;
  runs: HomeRunItem[];
  variant?: "dashboard" | "metrics";
};

type AttentionItem = {
  id: string;
  title: string;
  detail: string;
  tone: Tone;
  href?: string;
};

type RunEvent = {
  id: string;
  title: string;
  detail: string;
  tone: Tone;
  at: number;
};

function toTimestamp(value?: string | null) {
  const time = value ? Date.parse(value) : NaN;
  return Number.isFinite(time) ? time : 0;
}

function formatDate(value?: string | null) {
  const time = toTimestamp(value);
  if (!time) return "Sem data";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(time);
}

function formatRelative(value?: string | null | number) {
  const time = typeof value === "number" ? value : toTimestamp(value);
  if (!time) return "sem registro recente";
  const diffMinutes = Math.round((time - Date.now()) / 60000);
  const absMinutes = Math.abs(diffMinutes);
  const formatter = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });

  if (absMinutes < 60) return formatter.format(diffMinutes, "minute");
  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) return formatter.format(diffHours, "hour");
  const diffDays = Math.round(diffHours / 24);
  if (Math.abs(diffDays) < 30) return formatter.format(diffDays, "day");
  const diffMonths = Math.round(diffDays / 30);
  return formatter.format(diffMonths, "month");
}

function isOlderThanDays(value?: string | null, days = 3) {
  const time = toTimestamp(value);
  if (!time) return false;
  return Date.now() - time > days * 24 * 60 * 60 * 1000;
}

function pluralize(value: number, singular: string, plural = `${singular}s`) {
  return `${value} ${value === 1 ? singular : plural}`;
}

function toneClasses(tone: Tone) {
  if (tone === "positive") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (tone === "warning") return "border-amber-200 bg-amber-50 text-amber-700";
  if (tone === "critical") return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-slate-200 bg-slate-100 text-slate-700";
}

function numberToneClasses(tone: Tone) {
  if (tone === "positive") return "text-emerald-600";
  if (tone === "warning") return "text-amber-600";
  if (tone === "critical") return "text-rose-600";
  return "text-slate-700";
}

function sourceLabel(sourceType: RunSourceType) {
  return sourceType === "manual" ? "Manual" : "Integracao";
}

function providerLabel(provider: RunIntegrationProvider) {
  if (provider === "qase") return "Qase";
  if (provider === "jira") return "Jira";
  return null;
}

function buildAttentionItems(companySlug: string, run: HomeRunItem | null): AttentionItem[] {
  if (!run) {
    return [
      {
        id: "empty",
        title: "Nenhuma run selecionada",
        detail: "Escolha uma run acima para ver prioridades, sinais de risco e entradas rapidas.",
        tone: "neutral",
      },
    ];
  }

  const items: AttentionItem[] = [];

  if (run.stats.fail > 0) {
    items.push({
      id: "fail",
      title: "Falhas na run",
      detail: `${pluralize(run.stats.fail, "caso")} falhou nesta execucao e merece triagem imediata.`,
      tone: "critical",
      href: `/empresas/${encodeURIComponent(companySlug)}/defeitos?run=${encodeURIComponent(run.slug)}`,
    });
  }

  if (run.stats.blocked > 0) {
    items.push({
      id: "blocked",
      title: "Casos bloqueados",
      detail: `${pluralize(run.stats.blocked, "caso")} segue bloqueado e pode travar a leitura final da run.`,
      tone: "warning",
      href: run.href,
    });
  }

  if (run.stats.notRun > 0) {
    items.push({
      id: "not-run",
      title: "Cobertura incompleta",
      detail: `${pluralize(run.stats.notRun, "caso")} ainda nao foi executado nesta run.`,
      tone: "warning",
      href: run.href,
    });
  }

  if (!run.isCompleted && isOlderThanDays(run.updatedAt ?? run.createdAt, 3)) {
    items.push({
      id: "stale",
      title: "Execucao sem atualizacao recente",
      detail: "A run segue aberta ha mais de 3 dias sem nova movimentacao registrada.",
      tone: "warning",
      href: run.href,
    });
  }

  if (run.sourceType === "integration" && run.integrationProvider) {
    items.push({
      id: "integration",
      title: "Origem integrada confirmada",
      detail: `Esta run veio da integracao ${providerLabel(run.integrationProvider)} e reaproveita a tela oficial ja existente.`,
      tone: "positive",
      href: run.href,
    });
  }

  if (items.length === 0) {
    items.push({
      id: "clear",
      title: "Sem alertas imediatos",
      detail: "A run selecionada nao expoe sinais criticos de risco neste resumo rapido.",
      tone: "positive",
      href: run.href,
    });
  }

  return items;
}

function buildRunEvents(run: HomeRunItem | null): RunEvent[] {
  if (!run) return [];

  const events: RunEvent[] = [];

  if (run.createdAt) {
    events.push({
      id: "created",
      title: "Run criada",
      detail: `Criada em ${formatDate(run.createdAt)} para ${run.applicationName}.`,
      tone: "neutral",
      at: toTimestamp(run.createdAt),
    });
  }

  if (run.updatedAt && run.updatedAt !== run.createdAt) {
    events.push({
      id: "updated",
      title: "Ultima atualizacao",
      detail: `A run recebeu atualizacao ${formatRelative(run.updatedAt)}.`,
      tone: run.isCompleted ? "positive" : "warning",
      at: toTimestamp(run.updatedAt),
    });
  }

  events.push({
    id: "source",
    title: run.sourceType === "manual" ? "Origem manual" : "Origem integrada",
    detail:
      run.sourceType === "manual"
        ? "Execucao criada manualmente no painel da empresa."
        : `Run sincronizada via ${providerLabel(run.integrationProvider) ?? "integracao"}.`,
    tone: run.sourceType === "manual" ? "neutral" : "positive",
    at: toTimestamp(run.updatedAt ?? run.createdAt),
  });

  if (run.stats.fail > 0) {
    events.push({
      id: "fail",
      title: "Falhas registradas",
      detail: `${pluralize(run.stats.fail, "caso")} foi marcado como falha nesta run.`,
      tone: "critical",
      at: toTimestamp(run.updatedAt ?? run.createdAt),
    });
  }

  if (run.releaseLabel) {
    events.push({
      id: "release",
      title: "Release associada",
      detail: run.releaseLabel,
      tone: "neutral",
      at: toTimestamp(run.createdAt),
    });
  }

  return events.sort((a, b) => b.at - a.at).slice(0, 5);
}
function SectionHeader(props: { eyebrow: string; title: string; description: string }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-(--tc-accent,#ef0001)">
        {props.eyebrow}
      </p>
      <h2 className="text-xl font-extrabold text-(--tc-text,#0b1a3c)">{props.title}</h2>
      <p className="text-sm text-(--tc-text-secondary,#4b5563)">{props.description}</p>
    </div>
  );
}

function HeroMetric(props: { label: string; value: string; note: string; tone: Tone }) {
  return (
    <div className="rounded-3xl border border-white/60 bg-white/70 p-4 shadow-[0_18px_45px_rgba(15,23,42,0.08)] backdrop-blur">
      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-(--tc-text-muted,#6b7280)">
        {props.label}
      </p>
      <div className={`mt-3 text-3xl font-extrabold ${numberToneClasses(props.tone)}`}>{props.value}</div>
      <p className="mt-2 text-sm text-(--tc-text-secondary,#4b5563)">{props.note}</p>
    </div>
  );
}

function SummaryValue(props: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-[22px] border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#ffffff) p-4 shadow-sm">
      <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">
        {props.label}
      </div>
      <div className="mt-3 text-lg font-extrabold text-(--tc-text,#0b1a3c)">{props.value}</div>
      <div className="mt-2 text-sm text-(--tc-text-secondary,#4b5563)">{props.note}</div>
    </div>
  );
}
export default function CompanyRunsHomeClient(props: CompanyRunsHomeClientProps) {
  const {
    companySlug,
    companyName,
    companyInitials,
    subtitle,
    companyStatus,
    integrationStatus,
    heroStats,
    runs,
    variant = "dashboard",
  } = props;
  const isMetricsView = variant === "metrics";
  const [selectedRunSlug, setSelectedRunSlug] = useState<string | null>(runs[0]?.slug ?? null);

  const selectedRun = useMemo(
    () => runs.find((run) => run.slug === selectedRunSlug) ?? runs[0] ?? null,
    [runs, selectedRunSlug],
  );
  const attentionItems = useMemo(
    () => buildAttentionItems(companySlug, selectedRun),
    [companySlug, selectedRun],
  );
  const runEvents = useMemo(() => buildRunEvents(selectedRun), [selectedRun]);

  return (
    <div className="relative isolate min-h-screen bg-(--page-bg,#f5f6fa) px-4 py-8 text-(--page-text,#0b1a3c) sm:px-6 lg:px-10">
      <div className="relative z-10 mx-auto flex max-w-7xl flex-col gap-6">
        <section className="overflow-hidden rounded-[36px] border border-(--tc-border,#dfe5f1) bg-[linear-gradient(135deg,#031843_0%,#0b2d72_48%,#57153f_76%,#b01a33_100%)] p-6 text-white shadow-[0_32px_80px_rgba(15,23,42,0.18)] sm:p-8">
          <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-[28px] border border-white/20 bg-white/10 text-3xl font-extrabold tracking-[0.2em] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]">
                  {companyInitials}
                </div>
                <div className="max-w-3xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-white/80">
                      {isMetricsView ? "Metricas operacionais" : "Dashboard de runs"}
                    </span>
                    <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] ${toneClasses(companyStatus.tone)}`}>
                      {companyStatus.title}
                    </span>
                    <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] ${toneClasses(integrationStatus.tone)}`}>
                      {integrationStatus.title}
                    </span>
                  </div>
                  <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-white sm:text-5xl">{companyName}</h1>
                  <p className="mt-4 max-w-3xl text-sm leading-6 text-white/82 sm:text-base">{subtitle}</p>
                  <p className="mt-3 text-sm font-semibold text-white/90">
                    {heroStats.total > 0
                      ? `${pluralize(heroStats.total, "run")} agregada${heroStats.total === 1 ? "" : "s"} entre fluxos manuais e integrados.`
                      : "Sem runs agregadas ainda para esta empresa."}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3 lg:max-w-sm lg:justify-end">
                <CreateManualReleaseButton companySlug={companySlug} redirectToRun={false} />
                <Link
                  href={`/empresas/${encodeURIComponent(companySlug)}/runs`}
                  className="inline-flex items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-semibold text-(--tc-text,#0b1a3c) shadow-sm transition hover:bg-slate-100"
                >
                  {isMetricsView ? "Abrir runs" : "Ver lista completa"}
                </Link>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
              <HeroMetric label="Runs totais" value={String(heroStats.total)} note="Base consolidada da empresa." tone="neutral" />
              <HeroMetric label="Em andamento" value={String(heroStats.inProgress)} note="Runs ainda abertas ou em execucao." tone={heroStats.inProgress > 0 ? "warning" : "neutral"} />
              <HeroMetric label="Concluidas" value={String(heroStats.completed)} note="Runs com ciclo encerrado." tone={heroStats.completed > 0 ? "positive" : "neutral"} />
              <HeroMetric label="Manuais" value={String(heroStats.manual)} note="Criadas no proprio painel." tone={heroStats.manual > 0 ? "neutral" : "warning"} />
              <HeroMetric label="Integradas" value={String(heroStats.integration)} note="Vindas de integracoes ativas." tone={heroStats.integration > 0 ? "positive" : "neutral"} />
              <HeroMetric label="Ultima execucao" value={heroStats.latestExecutionAt ? formatRelative(heroStats.latestExecutionAt) : "-"} note={`${heroStats.alerts} alertas recentes | ${heroStats.openDefects} defeitos abertos | ${heroStats.applications} apps`} tone={heroStats.alerts > 0 || heroStats.openDefects > 0 ? "warning" : "positive"} />
            </div>
          </div>
        </section>

        <section className="rounded-4xl border border-(--tc-border,#e5e7eb) bg-white p-6 shadow-sm sm:p-7">
          <SectionHeader
            eyebrow="Selecao rapida"
            title={isMetricsView ? "Base operacional das runs da empresa" : "Runs mais recentes da empresa"}
            description={isMetricsView ? "Leitura operacional detalhada, organizada por execucao, projeto, status e origem." : "Cards ordenados da execucao mais recente para a mais antiga, combinando fontes manuais e integradas."}
          />

          {runs.length === 0 ? (
            <div className="mt-6 rounded-[28px] border border-dashed border-(--tc-border,#d8dee9) bg-(--tc-surface,#f9fafb) p-8 text-center">
              <p className="text-lg font-bold text-(--tc-text,#0b1a3c)">Nenhuma run encontrada para esta empresa.</p>
              <p className="mt-2 text-sm text-(--tc-text-secondary,#4b5563)">
                Assim que a empresa receber uma run manual ou integrada, ela aparece aqui com tags de origem, projeto e status.
              </p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                <CreateManualReleaseButton companySlug={companySlug} redirectToRun={false} />
                <Link
                  href={`/empresas/${encodeURIComponent(companySlug)}/runs`}
                  className="inline-flex items-center rounded-full border border-(--tc-border,#e5e7eb) bg-white px-4 py-2 text-sm font-semibold text-(--tc-text,#0b1a3c)"
                >
                  Ver runs
                </Link>
              </div>
            </div>
          ) : (
            <div className="mt-6 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex min-w-max gap-4">
                {runs.map((run) => {
                  const selected = run.slug === selectedRun?.slug;
                  const appMeta = getAppMeta(run.applicationKey, run.applicationName);
                  const appColorClass = getAppColorClass(run.applicationKey);
                  const provider = providerLabel(run.integrationProvider);
                  return (
                    <div
                      key={run.id}
                      className={`relative flex w-92 shrink-0 flex-col overflow-hidden rounded-[28px] border p-4 shadow-sm transition ${
                        selected
                          ? "border-[rgba(239,0,1,0.28)] bg-[linear-gradient(180deg,#ffffff_0%,#eef4ff_100%)] shadow-[0_24px_44px_rgba(1,24,72,0.12)] ring-1 ring-[rgba(239,0,1,0.16)]"
                          : "border-(--tc-border,#e5e7eb) bg-white"
                      }`}
                    >
                      {selected ? <span className="absolute inset-y-0 left-0 w-1.5 bg-[linear-gradient(180deg,var(--tc-primary)_0%,var(--tc-accent)_100%)]" /> : null}
                      <button type="button" onClick={() => setSelectedRunSlug(run.slug)} className="flex flex-1 flex-col gap-4 text-left">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">
                              {formatDate(run.createdAt)}
                            </div>
                            <div className="text-xl font-extrabold tracking-[-0.03em] text-(--tc-text,#0b1a3c)">
                              {run.title}
                            </div>
                          </div>
                          <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${toneClasses(run.statusTone)}`}>
                            {run.statusLabel}
                          </span>
                        </div>

                        <p className="min-h-12 text-sm leading-6 text-(--tc-text-secondary,#4b5563)">
                          {run.summary || `Projeto ${run.projectCode ?? run.applicationName} | ultima atualizacao ${formatRelative(run.updatedAt ?? run.createdAt)}.`}
                        </p>

                        <div className="flex flex-wrap gap-2">
                          <span
                            className={`app-tag app-tag-soft px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${appColorClass}`}
                          >
                            {appMeta.label}
                          </span>
                          {run.projectCode ? (
                            <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-700">
                              {run.projectCode}
                            </span>
                          ) : null}
                          <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-700">
                            {sourceLabel(run.sourceType)}
                          </span>
                          {provider ? (
                            <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-700">
                              {provider}
                            </span>
                          ) : null}
                        </div>

                        <div className="grid grid-cols-3 gap-3 border-t border-(--tc-border,#e5e7eb) pt-4">
                          <div>
                            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-(--tc-text-muted,#6b7280)">Casos</div>
                            <div className="mt-2 text-lg font-extrabold text-(--tc-text,#0b1a3c)">{run.stats.total}</div>
                          </div>
                          <div>
                            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-(--tc-text-muted,#6b7280)">Pass rate</div>
                            <div className="mt-2 text-lg font-extrabold text-(--tc-text,#0b1a3c)">{run.stats.passRate != null ? `${run.stats.passRate}%` : "-"}</div>
                          </div>
                          <div>
                            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-(--tc-text-muted,#6b7280)">Falhas</div>
                            <div className={`mt-2 text-lg font-extrabold ${run.stats.fail > 0 ? "text-rose-600" : "text-(--tc-text,#0b1a3c)"}`}>{run.stats.fail}</div>
                          </div>
                        </div>
                      </button>

                      <div className="mt-4 flex items-center justify-between border-t border-(--tc-border,#e5e7eb) pt-4">
                        <button type="button" onClick={() => setSelectedRunSlug(run.slug)} className="inline-flex items-center gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
                          <FiTarget className="h-4 w-4" />
                          Ver resumo
                        </button>
                        <Link href={run.href} className="inline-flex items-center gap-2 rounded-full bg-(--tc-primary,#0b1a3c) px-4 py-2 text-sm font-semibold text-white">
                          Abrir run
                          <FiExternalLink className="h-4 w-4" />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {selectedRun ? (
          <>
            <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
              <section className="rounded-4xl border border-(--tc-border,#e5e7eb) bg-white p-6 shadow-sm sm:p-7">
                <SectionHeader
                  eyebrow="Run em foco"
                  title={selectedRun.title}
                  description="Resumo rapido da run selecionada, sem substituir a tela oficial de execucao."
                />

                <div className="mt-5 flex flex-wrap gap-2">
                  <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${toneClasses(selectedRun.statusTone)}`}>
                    {selectedRun.statusLabel}
                  </span>
                  <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-700">
                    {sourceLabel(selectedRun.sourceType)}
                  </span>
                  {providerLabel(selectedRun.integrationProvider) ? (
                    <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-700">
                      {providerLabel(selectedRun.integrationProvider)}
                    </span>
                  ) : null}
                </div>

                <p className="mt-4 text-sm leading-6 text-(--tc-text-secondary,#4b5563)">
                  {selectedRun.summary || "A home mostra um resumo operacional desta run e usa a tela oficial existente para o aprofundamento completo."}
                </p>

                <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <SummaryValue label="Aplicacao" value={selectedRun.applicationName} note="Contexto principal desta run." />
                  <SummaryValue label="Projeto" value={selectedRun.projectCode ?? "Nao informado"} note="Projeto ou codigo vinculado a execucao." />
                  <SummaryValue label="Origem" value={sourceLabel(selectedRun.sourceType)} note={selectedRun.integrationProvider ? `Provedor ${providerLabel(selectedRun.integrationProvider)}` : "Run criada manualmente."} />
                  <SummaryValue label="Criada em" value={formatDate(selectedRun.createdAt)} note="Data base da execucao." />
                  <SummaryValue label="Ultima atualizacao" value={formatDate(selectedRun.updatedAt ?? selectedRun.createdAt)} note={formatRelative(selectedRun.updatedAt ?? selectedRun.createdAt)} />
                  <SummaryValue label="Casos totais" value={String(selectedRun.stats.total)} note="Soma de aprovados, falhados, bloqueados e nao executados." />
                  <SummaryValue label="Aprovados" value={String(selectedRun.stats.pass)} note="Casos que passaram nesta run." />
                  <SummaryValue label="Falhados" value={String(selectedRun.stats.fail)} note="Casos com falha registrada." />
                  <SummaryValue label="Bloqueados" value={String(selectedRun.stats.blocked)} note="Casos que ainda dependem de destravamento." />
                  <SummaryValue label="Nao executados" value={String(selectedRun.stats.notRun)} note="Casos ainda sem execucao nesta leitura." />
                  <SummaryValue label="Pass rate" value={selectedRun.stats.passRate != null ? `${selectedRun.stats.passRate}%` : "Sem telemetria"} note="Percentual atual de aprovacao." />
                  <SummaryValue label="Release associada" value={selectedRun.releaseLabel ?? "Nao informada"} note={selectedRun.responsibleLabel ? `Responsavel: ${selectedRun.responsibleLabel}` : "Sem responsavel vinculado."} />
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  <Link href={selectedRun.href} className="inline-flex items-center gap-2 rounded-full bg-(--tc-primary,#0b1a3c) px-5 py-3 text-sm font-semibold text-white">
                    Abrir run real
                    <FiExternalLink className="h-4 w-4" />
                  </Link>
                  <Link href={`/empresas/${encodeURIComponent(companySlug)}/defeitos?run=${encodeURIComponent(selectedRun.slug)}`} className="inline-flex items-center gap-2 rounded-full border border-(--tc-border,#e5e7eb) bg-white px-5 py-3 text-sm font-semibold text-(--tc-text,#0b1a3c)">
                    Ver defeitos da run
                  </Link>
                </div>
              </section>

              <aside className="rounded-4xl border border-(--tc-border,#e5e7eb) bg-white p-6 shadow-sm sm:p-7">
                <SectionHeader
                  eyebrow="Prioridades"
                  title="Atencao da run"
                  description="Sinais de risco, pendencia ou consistencia para a run atualmente selecionada."
                />

                <div className="mt-6 grid gap-4">
                  {attentionItems.map((item) => {
                    const content = (
                      <div className={`rounded-3xl border p-4 ${toneClasses(item.tone)}`}>
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-semibold">{item.title}</div>
                          {item.href ? <FiArrowRight className="h-4 w-4 shrink-0" /> : null}
                        </div>
                        <div className="mt-2 text-sm opacity-90">{item.detail}</div>
                      </div>
                    );
                    return item.href ? <Link key={item.id} href={item.href}>{content}</Link> : <div key={item.id}>{content}</div>;
                  })}
                </div>

                <div className="mt-6 rounded-3xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#f9fafb) p-5">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-(--tc-accent,#ef0001)">
                    <FiShield className="h-4 w-4" />
                    Leitura da run
                  </div>
                  <div className="mt-4 grid gap-3">
                    <div className="rounded-2xl bg-white px-4 py-3 shadow-sm">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-(--tc-text-muted,#6b7280)">Tipo de execucao</div>
                      <div className="mt-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
                        {sourceLabel(selectedRun.sourceType)}
                        {providerLabel(selectedRun.integrationProvider) ? ` | ${providerLabel(selectedRun.integrationProvider)}` : ""}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-white px-4 py-3 shadow-sm">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-(--tc-text-muted,#6b7280)">Resultado dominante</div>
                      <div className="mt-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
                        {selectedRun.stats.fail > 0
                          ? "Falhas exigem leitura imediata"
                          : selectedRun.stats.blocked > 0
                            ? "Bloqueios impactam o fechamento"
                            : selectedRun.isCompleted
                              ? "Run concluida"
                              : "Execucao em andamento"}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-white px-4 py-3 shadow-sm">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-(--tc-text-muted,#6b7280)">Ultima movimentacao</div>
                      <div className="mt-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
                        {formatRelative(selectedRun.updatedAt ?? selectedRun.createdAt)}
                      </div>
                    </div>
                  </div>
                </div>
              </aside>
            </div>

            <section className="rounded-4xl border border-(--tc-border,#e5e7eb) bg-white p-6 shadow-sm sm:p-7">
              <SectionHeader
                eyebrow="Eventos recentes"
                title="Movimentos da run selecionada"
                description="Linha do tempo enxuta da run em foco, sem criar uma nova tela paralela de execucao."
              />

              <div className="mt-6 grid gap-4">
                {runEvents.map((event) => (
                  <div key={event.id} className="flex items-start gap-4 rounded-3xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#ffffff) p-4 shadow-sm">
                    <div className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${toneClasses(event.tone)}`}>
                      {event.tone === "critical" ? <FiAlertTriangle className="h-5 w-5" /> : event.tone === "positive" ? <FiCheckCircle className="h-5 w-5" /> : event.id === "source" ? <FiRefreshCw className="h-5 w-5" /> : event.id === "created" ? <FiPlayCircle className="h-5 w-5" /> : event.id === "release" ? <FiLayers className="h-5 w-5" /> : <FiActivity className="h-5 w-5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <div className="text-sm font-semibold text-(--tc-text,#0b1a3c)">{event.title}</div>
                        <div className="text-xs font-medium uppercase tracking-[0.18em] text-(--tc-text-muted,#6b7280)">
                          {formatRelative(event.at)}
                        </div>
                      </div>
                      <div className="mt-2 text-sm text-(--tc-text-secondary,#4b5563)">{event.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}
