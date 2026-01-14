"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FiAlertTriangle, FiChevronDown, FiExternalLink } from "react-icons/fi";
import { RequireGlobalAdmin } from "@/components/RequireGlobalAdmin";
import type { CompanyRow, Stats } from "@/lib/quality";
import styles from "./page.module.css";

type QualityOverviewResponse = {
  companies: CompanyRow[];
  period: number;
  coverage: { total: number; withStats: number; percent: number };
  releaseCount: number;
  globalStats: Stats;
  globalPassRate: number | null;
  passRateTone: "good" | "warn" | "neutral";
  gateCounts: Record<string, number>;
  riskCount: number;
  warningCount: number;
  trendPoints: { label: string; value: number | null; total: number }[];
  trendSummary: { direction: "up" | "down" | "flat"; delta: number };
  policy: Record<string, number>;
};

type DefectItem = {
  id: string;
  title: string;
  status: string;
  origin?: "manual" | "automatico";
  companyName?: string | null;
  run_id?: string | number | null;
  url?: string;
};

type DefectsResponse = {
  items: DefectItem[];
  total: number;
};

type AuditLogItem = {
  id: string;
  created_at: string;
  action: string;
  actor_email: string | null;
  entity_label: string | null;
  entity_type: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  fail: "Em falha",
  blocked: "Bloqueado",
  pending: "Aguardando teste",
  done: "Concluído",
};

const RISK_TONE: Record<string, string> = {
  failed: "border-red-200 bg-red-50 text-red-600",
  warning: "border-amber-200 bg-amber-50 text-amber-600",
  approved: "border-emerald-200 bg-emerald-50 text-emerald-600",
  no_data: "border-slate-200 bg-slate-50 text-slate-500",
};

function formatDate(value?: string) {
  if (!value) return "--";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "--";
  return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function sumStats(stats?: Stats | null) {
  if (!stats) return 0;
  return stats.fail + stats.blocked + stats.notRun;
}

export default function AdminHomePage() {
  const [overview, setOverview] = useState<QualityOverviewResponse | null>(null);
  const [defectsPayload, setDefectsPayload] = useState<DefectsResponse | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [loadingDefects, setLoadingDefects] = useState(true);
  const [loadingAudit, setLoadingAudit] = useState(true);
  const [selectedCompanySlug, setSelectedCompanySlug] = useState<string | null>(null);
  const [selectedRunSlug, setSelectedRunSlug] = useState<string | null>(null);

  useEffect(() => {
    let canceled = false;
    const loadOverview = async () => {
      setLoadingOverview(true);
      try {
        const res = await fetch("/api/admin/quality/overview?period=30", { cache: "no-store" });
        const payload = (await res.json()) as QualityOverviewResponse;
        if (!canceled) setOverview(payload);
      } catch {
        if (!canceled) setOverview(null);
      } finally {
        if (!canceled) setLoadingOverview(false);
      }
    };
    loadOverview();
    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    let canceled = false;
    const loadDefects = async () => {
      setLoadingDefects(true);
      try {
        const res = await fetch("/api/admin/defeitos", { cache: "no-store" });
        const payload = (await res.json()) as DefectsResponse;
        if (!canceled) setDefectsPayload(payload);
      } catch {
        if (!canceled) setDefectsPayload(null);
      } finally {
        if (!canceled) setLoadingDefects(false);
      }
    };
    loadDefects();
    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    let canceled = false;
    const loadLogs = async () => {
      setLoadingAudit(true);
      try {
        const res = await fetch("/api/admin/audit-logs?limit=5", { cache: "no-store" });
        const payload = await res.json();
        if (!canceled) setAuditLogs(payload?.items ?? []);
      } catch {
        if (!canceled) setAuditLogs([]);
      } finally {
        if (!canceled) setLoadingAudit(false);
      }
    };
    loadLogs();
    return () => {
      canceled = true;
    };
  }, []);

  const companies = overview?.companies ?? [];
  useEffect(() => {
    if (companies.length && !selectedCompanySlug) {
      setSelectedCompanySlug(companies[0].slug ?? companies[0].id);
    }
  }, [companies, selectedCompanySlug]);

  const selectedCompany = useMemo(() => {
    if (!companies.length) return null;
    return companies.find((company) => company.slug === selectedCompanySlug) ?? companies[0];
  }, [companies, selectedCompanySlug]);

  useEffect(() => {
    if (!selectedCompany || !selectedCompany.releases.length) return;
    const firstSlug = selectedCompany.releases[0].slug;
    if (firstSlug && firstSlug !== selectedRunSlug) {
      setSelectedRunSlug(firstSlug);
    }
  }, [selectedCompany, selectedRunSlug]);

  const runOptions = selectedCompany?.releases ?? [];
  const selectedRun = runOptions.find((run) => run.slug === selectedRunSlug) ?? runOptions[0] ?? null;

  const attentionItems = useMemo(() => {
    if (!defectsPayload) return [];
    const attention: { id: string; text: string; href: string }[] = [];
    const fail = defectsPayload.items.find((d) => d.status === "fail");
    if (fail) attention.push({ id: fail.id, text: `Defeito em falha: ${fail.title}`, href: `/admin/defeitos/${fail.id}` });
    const blocked = defectsPayload.items.find((d) => d.status === "blocked");
    if (blocked) attention.push({ id: blocked.id, text: `Bloqueado aguardando teste: ${blocked.title}`, href: `/admin/defeitos/${blocked.id}` });
    if (overview && selectedCompany) {
      attention.push({
        id: "release",
        text: `${selectedCompany.latestRelease?.title ?? "Release crítica"} sem execução recente`,
        href: `/admin/runs`,
      });
    }
    return attention.slice(0, 5);
  }, [defectsPayload, overview, selectedCompany]);

  const relevantDefects = useMemo(() => {
    const defects = defectsPayload?.items ?? [];
    return defects.filter((d) => ["fail", "blocked", "pending"].includes(d.status)).slice(0, 6);
  }, [defectsPayload]);

  const historyItems = useMemo(() => auditLogs, [auditLogs]);

  const passRateDisplay = selectedCompany?.passRate ?? overview?.globalPassRate ?? null;
  const defectCount = defectsPayload?.total ?? "--";
  const releasesAtRisk = overview?.riskCount ?? ("--" as const);

  const runStats = selectedRun?.stats ?? { pass: 0, fail: 0, blocked: 0, notRun: 0 };
  const runTotal = Object.values(runStats).reduce((sum, value) => sum + value, 0);
  const runStatEntries = [
    { id: "pass", label: "Pass", value: runStats.pass, progressClass: styles.progressPass },
    { id: "fail", label: "Fail", value: runStats.fail, progressClass: styles.progressFail },
    { id: "blocked", label: "Blocked", value: runStats.blocked, progressClass: styles.progressBlocked },
    { id: "notRun", label: "Not run", value: runStats.notRun, progressClass: styles.progressNotRun },
  ].filter((entry) => entry.value > 0);

  const companyRiskText = selectedCompany?.gate?.status ?? "no_data";

  const companyCards = companies.map((company) => {
    const totalFailures = sumStats(company.stats);
    return {
      id: company.id,
      slug: company.slug ?? company.id,
      name: company.name,
      risk: company.gate?.status ?? "no_data",
      passRate: company.passRate,
      defectCount: totalFailures,
      gateCopy: company.gate?.status === "failed" ? "Risco alto" : company.gate?.status === "warning" ? "Atenção" : "Estável",
    };
  });

  return (
    <RequireGlobalAdmin>
      <div className="min-h-screen bg-(--page-bg,#f4f5f7) text-(--page-text,#0b1a3c)">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6 lg:p-8">
          <section className="rounded-4xl bg-white p-6 shadow-xl">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.5em] text-(--tc-accent,#ef0001)">Testing Metric</p>
                <h1 className="text-4xl font-extrabold text-(--page-text,#0b1a3c)">Qualidade em execução</h1>
                <p className="mt-2 max-w-2xl text-sm text-(--tc-text-muted,#6b7280)">
                  Risco, falhas e decisão em tempo real. O painel responde “onde agir agora” sem criar ruído.
                </p>
                {loadingOverview && (
                  <p className="mt-1 text-xs uppercase tracking-[0.4em] text-(--tc-text-muted,#6b7280)">Atualizando dados...</p>
                )}
              </div>
              <div className="flex items-center gap-3 rounded-full border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#f9fafb) px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em]">
                <span>{selectedCompany?.name ?? "Contexto global"}</span>
                <span className="rounded-full bg-(--tc-accent,#ef0001)/10 px-3 py-1 text-(--tc-accent,#ef0001)">Admin</span>
              </div>
            </div>
            <div className="mt-6 space-y-2 border-t border-(--tc-border,#e5e7eb) pt-6">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.3em] text-(--tc-text-muted,#6b7280)">
                <span>Empresas</span>
                <span>Arraste para ver</span>
              </div>
              <div className="flex w-full gap-4 overflow-x-auto pb-2">
                {companyCards.map((company) => {
                  const tone = RISK_TONE[company.risk] ?? RISK_TONE.no_data;
                  const isSelected = company.slug === (selectedCompany?.slug ?? selectedCompany?.id);
                  return (
                    <button
                      key={company.id}
                      type="button"
                      onClick={() => setSelectedCompanySlug(company.slug)}
                      className={`flex min-w-56 flex-col gap-2 rounded-2xl border p-4 shadow-sm transition ${tone} ${
                        isSelected ? "ring-2 ring-offset-2 ring-(--tc-border,#e5e7eb)" : "opacity-80 hover:opacity-100"
                      }`}
                    >
                      <div className="text-sm font-bold text-(--page-text,#0b1a3c)">{company.name}</div>
                      <div className="text-3xl font-extrabold">{company.defectCount}</div>
                      <div className="text-xs text-(--tc-text-muted,#6b7280)">{company.gateCopy}</div>
                      <div className="text-xs text-(--tc-text-muted,#6b7280)">
                        Pass rate: {company.passRate !== null ? `${company.passRate}%` : "--"}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="rounded-4xl bg-linear-to-br from-white to-[#fef0ef] p-6 md:p-8 shadow-xl">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <h2 className="text-3xl font-bold text-(--page-text,#0b1a3c)">
                Estado atual — {selectedCompany?.name ?? "visão global"}
              </h2>
              <div className="text-sm font-semibold uppercase tracking-[0.4em] text-(--tc-text-muted,#6b7280)">
                {companyRiskText === "failed" ? "Risco elevado" : companyRiskText === "warning" ? "Atenção" : "Estável"}
              </div>
            </div>
            <div className="mt-8 grid gap-6 grid-cols-1 sm:grid-cols-2 md:grid-cols-4">
              <div className="space-y-1">
                <p className="text-sm text-(--tc-text-secondary,#4b5563)">Pass rate</p>
                <p className="text-4xl font-extrabold text-(--tc-text-primary,#0b1a3c)">
                  {passRateDisplay !== null ? `${passRateDisplay}%` : "--"}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-(--tc-text-secondary,#4b5563)">Defeitos abertos</p>
                <p className="text-4xl font-extrabold text-red-600">{defectCount}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-(--tc-text-secondary,#4b5563)">Releases em risco</p>
                <p className="text-4xl font-extrabold text-amber-600">{releasesAtRisk}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-(--tc-text-secondary,#4b5563)">Última execução</p>
                <p className="text-4xl font-extrabold text-(--page-text,#0b1a3c)">
                  {formatDate(selectedCompany?.latestRelease?.createdAt)}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-4xl bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-(--page-text,#0b1a3c)">Atenção agora</h3>
              <span className="text-xs uppercase tracking-[0.4em] text-(--tc-text-muted,#6b7280)">máx. 5</span>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {!loadingDefects && attentionItems.length === 0 && (
                <p className="text-sm text-(--tc-text-muted,#6b7280)">Nada crítico sendo reportado.</p>
              )}
              {attentionItems.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className="flex items-center justify-between rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#f9fafb) px-4 py-3 text-sm font-semibold text-(--page-text,#0b1a3c) transition hover:border-(--tc-accent,#ef0001)"
                >
                  <span className="flex items-center gap-2">
                    <FiAlertTriangle className="text-(--tc-accent,#ef0001)" />
                    {item.text}
                  </span>
                  <FiChevronDown className="text-(--tc-accent,#ef0001)" />
                </Link>
              ))}
            </div>
          </section>

          <section className="rounded-4xl bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-(--page-text,#0b1a3c)">Defeitos abertos</h3>
              <span className="text-xs uppercase tracking-[0.4em] text-(--tc-text-muted,#6b7280)">Visão por empresa</span>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {!loadingDefects && relevantDefects.length === 0 && (
                <p className="text-sm text-(--tc-text-muted,#6b7280)">Nada em destaque neste momento.</p>
              )}
              {relevantDefects.map((defect) => (
                <div
                  key={defect.id}
                  className="group flex flex-col gap-3 rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#f9fafb) p-4 shadow-sm transition hover:border-(--tc-accent,#ef0001)"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-base font-semibold text-(--page-text,#0b1a3c)">{defect.title}</p>
                    <span className="text-xs font-semibold uppercase text-(--tc-accent,#ef0001)">
                      {STATUS_LABELS[defect.status] ?? defect.status}
                    </span>
                  </div>
                  <div className="text-xs text-(--tc-text-muted,#6b7280)">Origem: {defect.origin === "manual" ? "Manual" : "Automático (Qase)"}</div>
                  <div className="flex flex-wrap items-center justify-between text-xs text-(--tc-text-secondary,#4b5563)">
                    <span>Run: {defect.run_id ?? "--"}</span>
                    <span>Empresa: {defect.companyName ?? "Sem empresa"}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-(--tc-text-secondary,#4b5563)">
                    <Link href={defect.url ?? "#"} target="_blank" rel="noreferrer" className="font-semibold text-(--tc-accent,#ef0001)">
                      Ver caso
                    </Link>
                    <div className="opacity-0 transition group-hover:opacity-100">
                      <FiExternalLink className="text-(--tc-text-muted,#6b7280)" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="grid gap-6 rounded-4xl bg-white p-6 shadow-sm lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-semibold text-(--page-text,#0b1a3c)">Run em foco</h3>
                  <span className="sr-only">Selecionar run</span>
                </div>
                <select
                  className="rounded-full border border-(--tc-border,#e5e7eb) bg-white px-4 py-1 text-sm font-semibold text-(--page-text,#0b1a3c)"
                  value={selectedRun?.slug ?? ""}
                  onChange={(event) => setSelectedRunSlug(event.target.value || null)}
                  aria-label="Selecionar run em foco"
                >
                  {runOptions.map((run) => (
                    <option key={run.slug} value={run.slug}>
                      {run.title ?? run.slug}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-4 space-y-3">
                {runStatEntries.length === 0 && (
                  <p className="text-sm text-(--tc-text-muted,#6b7280)">Nenhum dado de run disponível.</p>
                )}
                {runStatEntries.map((entry) => (
                  <div key={entry.id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.3em] text-(--tc-text-muted,#6b7280)">
                      <span>{entry.label}</span>
                      <span>{entry.value}</span>
                    </div>
                    <progress
                      className={`${styles.progress} ${entry.progressClass}`}
                      value={entry.value}
                      max={Math.max(runTotal, 1)}
                      aria-label={`${entry.label} (${entry.value} de ${Math.max(runTotal, 1)})`}
                    />
                  </div>
                ))}
                <div className="text-xs text-(--tc-text-muted,#6b7280)">Total de métricas: {runTotal}</div>
              </div>
            </div>
            <div className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#f9fafb) p-4">
              <p className="text-xs uppercase tracking-[0.4em] text-(--tc-text-muted,#6b7280)">Histórico rápido</p>
              <ul className="mt-3 space-y-3 text-sm text-(--tc-text-secondary,#4b5563)">
                {historyItems.slice(0, 4).map((log) => (
                  <li key={log.id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-(--tc-text-muted,#6b7280)">
                      <span>{log.action}</span>
                      <span>{formatDate(log.created_at)}</span>
                    </div>
                    <div className="text-xs text-(--tc-text-muted,#6b7280)">
                      {log.actor_email ?? "Sistema"} · {log.entity_label ?? log.entity_type ?? "sem referência"}
                    </div>
                  </li>
                ))}
                {!historyItems.length && !loadingAudit && (
                  <li className="text-xs text-(--tc-text-muted,#6b7280)">Nenhuma ação registrada.</li>
                )}
                {loadingAudit && <li className="text-xs text-(--tc-text-muted,#6b7280)">Carregando histórico...</li>}
              </ul>
            </div>
          </section>

          <section className="rounded-4xl bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-(--page-text,#0b1a3c)">Ações rápidas</h3>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href="/empresas/griaule/defeitos?me=true"
                className="inline-flex items-center gap-2 rounded-full border border-(--tc-accent,#ef0001) px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-(--tc-accent,#ef0001)"
              >
                Criar defeito manual
              </Link>
              <Link
                href="/admin/defeitos"
                className="inline-flex items-center gap-2 rounded-full bg-(--tc-accent,#ef0001) px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white"
              >
                Ver defeitos da empresa
              </Link>
              <Link
                href="/admin/runs"
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-700"
              >
                Ver releases
              </Link>
            </div>
          </section>
        </div>
      </div>
    </RequireGlobalAdmin>
  );
}
