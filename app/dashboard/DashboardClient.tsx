"use client";

import { useMemo, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import StatusChart from "@/components/StatusChart";
import StatusPill from "@/components/StatusPill";
import { STATUS_COLORS } from "@/utils/statusColors";
import { FiArrowLeft, FiArrowRight } from "react-icons/fi";
import { MotionFade, MotionScale } from "@/components/motion";

type Stats = { pass: number; fail: number; blocked: number; notRun: number };
type ReleaseType = "aceitacao" | "regressao" | "outro";
type QualityGateStatus = "pass" | "warn" | "fail" | "no_data";

type QualityGate = {
  status: QualityGateStatus;
  label: string;
  reasons: string[];
  total: number;
  passRate: number;
  failRate: number;
  blockedRate: number;
  notRunRate: number;
};

type QualityGateThresholds = {
  passRate: number;
  maxFailRate: number;
  maxBlockedRate: number;
  maxNotRunRate: number;
  minTotal: number;
};

type ReleaseSlide = {
  app: string;
  appLabel: string;
  appColor?: string;
  slug: string;
  title: string;
  createdAt?: string;
  stats: Stats;
  percent: number;
};

type Section = {
  app: string;
  appLabel: string;
  appColor?: string;
  releases: ReleaseSlide[];
};

type ExecutiveRelease = ReleaseSlide & {
  type: ReleaseType;
  gate: QualityGate;
};

type ExecutiveSummary = {
  totalReleases: number;
  totalCases: number;
  stats: Stats;
  passRate: number;
  failRate: number;
  blockedRate: number;
  notRunRate: number;
  gate: Record<QualityGateStatus, number>;
  thresholds: QualityGateThresholds;
};

type ExecutiveData = {
  summary: ExecutiveSummary;
  releases: ExecutiveRelease[];
};

type DashboardHeader = {
  kicker?: string;
  title?: string;
  description?: string;
};

const GATE_META: Record<
  QualityGateStatus,
  { label: string; dot: string; badge: string; border: string; glow: string }
> = {
  pass: {
    label: "Aprovado",
    dot: "bg-emerald-300",
    badge: "bg-emerald-500/15 text-emerald-200",
    border: "border-emerald-500/40",
    glow: "shadow-[0_12px_30px_rgba(16,185,129,0.18)]",
  },
  warn: {
    label: "Atencao",
    dot: "bg-amber-300",
    badge: "bg-amber-500/15 text-amber-200",
    border: "border-amber-500/35",
    glow: "shadow-[0_12px_30px_rgba(245,158,11,0.16)]",
  },
  fail: {
    label: "Reprovado",
    dot: "bg-rose-300",
    badge: "bg-rose-500/20 text-rose-200",
    border: "border-rose-500/40",
    glow: "shadow-[0_12px_30px_rgba(244,63,94,0.18)]",
  },
  no_data: {
    label: "Sem dados",
    dot: "bg-slate-300",
    badge: "bg-slate-500/20 text-slate-200",
    border: "border-slate-400/35",
    glow: "shadow-[0_12px_30px_rgba(148,163,184,0.12)]",
  },
};

const RELEASE_TYPE_LABEL: Record<ReleaseType, string> = {
  aceitacao: "Aceitacao",
  regressao: "Regressao",
  outro: "Run",
};

function formatDate(value?: string) {
  if (!value) return "Data N/D";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data N/D";
  return date.toLocaleDateString("pt-BR");
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

function GateBadge({ gate }: { gate: QualityGate }) {
  const meta = GATE_META[gate.status];
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold border ${meta.badge} ${meta.border}`}
    >
      <span className={`h-2 w-2 rounded-full ${meta.dot}`} aria-hidden />
      {gate.label || meta.label}
    </span>
  );
}

function MetricCard({
  label,
  value,
  accent,
  note,
}: {
  label: string;
  value: string;
  accent?: string;
  note?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
      <p className="text-xs uppercase tracking-[0.28em] text-[var(--tc-text-muted)]">{label}</p>
      <p className={`text-2xl font-bold ${accent ?? "text-white"}`}>{value}</p>
      {note && <p className="text-xs text-[var(--tc-text-muted)]">{note}</p>}
    </div>
  );
}

function ThresholdChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs text-white/80">
      {label}
    </span>
  );
}

function GateSummaryCard({ status, value, label }: { status: QualityGateStatus; value: number; label: string }) {
  const meta = GATE_META[status];
  return (
    <div className={`rounded-2xl border ${meta.border} bg-white/5 px-4 py-4 ${meta.glow}`}>
      <p className="text-xs uppercase tracking-[0.28em] text-[var(--tc-text-muted)]">{label}</p>
      <p className="text-3xl font-bold text-white">{formatNumber(value)}</p>
      <span className={`text-xs font-semibold border ${meta.badge} ${meta.border} inline-flex px-2 py-0.5 rounded-full`}>
        {meta.label}
      </span>
    </div>
  );
}

function ReleaseGateCard({ release }: { release: ExecutiveRelease }) {
  const total = release.gate.total;
  const meta = GATE_META[release.gate.status];
  const appColorStyle = { "--app-tag-color": release.appColor || "var(--tc-accent)" } as CSSProperties;

  const statLine = (label: string, value: number, percent: number) => (
    <div className="flex items-center justify-between text-xs text-[var(--tc-text-muted)]">
      <span>{label}</span>
      <span className="text-white/90">
        {formatNumber(value)} <span className="text-[var(--tc-text-muted)]">({percent}%)</span>
      </span>
    </div>
  );

  return (
    <div className={`rounded-2xl border ${meta.border} bg-[var(--tc-surface-muted)]/80 p-4 ${meta.glow}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <span
            style={appColorStyle}
            className="inline-flex items-center justify-center rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-white border border-[--app-tag-color] bg-[--app-tag-color]"
          >
            {release.appLabel}
          </span>
          <h3 className="text-base font-semibold text-white">{release.title}</h3>
          <p className="text-xs text-[var(--tc-text-muted)]">
            {RELEASE_TYPE_LABEL[release.type]} - {formatDate(release.createdAt)}
          </p>
        </div>
        <GateBadge gate={release.gate} />
      </div>

      <div className="mt-4 space-y-2">
        {statLine("Pass", release.stats.pass, release.gate.passRate)}
        {statLine("Fail", release.stats.fail, release.gate.failRate)}
        {statLine("Blocked", release.stats.blocked, release.gate.blockedRate)}
        {statLine("Not Run", release.stats.notRun, release.gate.notRunRate)}
        <p className="text-xs text-[var(--tc-text-muted)]">Total {formatNumber(total)}</p>
      </div>

      {release.gate.reasons.length > 0 && (
        <div className="mt-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80 space-y-1">
          {release.gate.reasons.map((reason) => (
            <p key={reason}>- {reason}</p>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-[var(--tc-text-muted)]">Gate: {release.gate.label}</span>
        <Link href={`/release/${release.slug}`} className="text-xs font-semibold text-[var(--tc-accent)]">
          Ver release
        </Link>
      </div>
    </div>
  );
}

function ReleaseCarousel({ section }: { section: Section }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const ref = useRef<HTMLDivElement | null>(null);
  const appColorStyle = { "--app-tag-color": section.appColor || "var(--tc-accent)" } as CSSProperties;

  const handleScroll = () => {
    const container = ref.current;
    if (!container || !container.firstElementChild) return;
    const childWidth = (container.firstElementChild as HTMLElement).clientWidth;
    const gap = 24;
    const index = Math.round(container.scrollLeft / (childWidth + gap));
    setActiveIndex(index);
  };

  const scrollBy = (dir: "left" | "right") => {
    const container = ref.current;
    if (!container) return;
    const delta = dir === "left" ? -1 : 1;
    const amount = container.clientWidth * 0.9;
    container.scrollBy({ left: amount * delta, behavior: "smooth" });
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <span
            style={appColorStyle}
            className="inline-flex items-center justify-center rounded-full px-3 py-1 text-[12px] font-bold uppercase tracking-[0.12em] text-white border border-[--app-tag-color] bg-[--app-tag-color]"
          >
            {section.appLabel}
          </span>
          <h2 className="text-lg sm:text-xl font-bold text-[var(--tc-text-inverse)]">Runs desta aplicacao</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => scrollBy("left")}
            className="rounded-full bg-white/10 p-2 border border-[var(--tc-border)]/30 hover:bg-[var(--tc-accent-soft)] transition"
            aria-label="Anterior"
          >
            <FiArrowLeft />
          </button>
          <button
            onClick={() => scrollBy("right")}
            className="rounded-full bg-white/10 p-2 border border-[var(--tc-border)]/30 hover:bg-[var(--tc-accent-soft)] transition"
            aria-label="Proximo"
          >
            <FiArrowRight />
          </button>
        </div>
      </div>

      <div
        ref={ref}
        onScroll={handleScroll}
        className="flex gap-6 overflow-x-auto pb-4 snap-x snap-mandatory scroll-smooth custom-scroll"
      >
        {section.releases.map((rel) => {
          const total = rel.stats.pass + rel.stats.fail + rel.stats.blocked + rel.stats.notRun;
          const pct = (value: number) => (total > 0 ? Math.round((value / total) * 100) : 0);

          return (
            <MotionFade
              key={rel.slug}
              className="snap-center shrink-0 w-[88%] sm:w-full max-w-[560px] min-w-[260px] sm:min-w-[320px] lg:min-w-[380px]"
              delay={0.05}
            >
              <div className="card-tc bg-[var(--tc-surface-muted)]/90 text-[var(--tc-text-inverse)] border-[var(--tc-border)]/20 p-5 shadow-[0_18px_38px_rgba(0,0,0,0.25)]">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="space-y-1">
                    <span
                      style={{ "--app-tag-color": rel.appColor || "var(--tc-accent)" } as CSSProperties}
                      className="inline-flex items-center justify-center rounded-full px-3 py-1 text-[12px] font-bold uppercase tracking-[0.12em] text-white border border-[--app-tag-color] bg-[--app-tag-color]"
                    >
                      {rel.appLabel}
                    </span>
                    <h3 className="text-lg font-semibold text-[var(--tc-text-inverse)] leading-tight">{rel.title}</h3>
                    <p className="text-xs text-[var(--tc-text-muted)]">Criada em {formatDate(rel.createdAt)}</p>
                  </div>
                  <Link
                    href={`/release/${rel.slug}`}
                    className="text-xs font-semibold text-[var(--tc-accent)] hover:brightness-110 transition"
                  >
                    Ver detalhes
                  </Link>
                </div>

                <div className="flex flex-col md:flex-row gap-4 md:items-center">
                  <MotionScale className="w-full md:max-w-[260px] flex items-center justify-center">
                    <StatusChart stats={rel.stats} />
                  </MotionScale>
                  <div className="flex-1 space-y-3 text-sm text-[var(--tc-text-inverse)]">
                    <div className="flex flex-wrap gap-3">
                      <StatusPill label="Pass" value={rel.stats.pass} percent={pct(rel.stats.pass)} color={STATUS_COLORS.pass} />
                      <StatusPill label="Fail" value={rel.stats.fail} percent={pct(rel.stats.fail)} color={STATUS_COLORS.fail} />
                      <StatusPill label="Blocked" value={rel.stats.blocked} percent={pct(rel.stats.blocked)} color={STATUS_COLORS.blocked} />
                      <StatusPill label="Not Run" value={rel.stats.notRun} percent={pct(rel.stats.notRun)} color={STATUS_COLORS.notRun} />
                    </div>
                    <p className="text-xs text-[var(--tc-text-muted)]">
                      Total {total} | Pass {pct(rel.stats.pass)}%
                    </p>
                  </div>
                </div>
              </div>
            </MotionFade>
          );
        })}
      </div>

      <div className="flex items-center justify-center gap-2">
        {section.releases.map((_, idx) => (
          <span
            key={idx}
            className={`h-2.5 w-2.5 rounded-full transition ${idx === activeIndex ? "bg-[var(--tc-accent)]" : "bg-white/20"}`}
          />
        ))}
      </div>
    </section>
  );
}

export default function DashboardClient({
  sections,
  header,
  showHeader = true,
  executive,
}: {
  sections: Section[];
  header?: DashboardHeader;
  showHeader?: boolean;
  executive?: ExecutiveData;
}) {
  const appOrder = useMemo(
    () => ["sfq", "print", "booking", "cds", "gmt", "smart", "trust", "cidadao-smart", "mobile-griaule"],
    []
  );
  const ordered = useMemo(() => {
    return [...sections].sort((a, b) => {
      const idxA = appOrder.indexOf(a.app.toLowerCase());
      const idxB = appOrder.indexOf(b.app.toLowerCase());
      const aPos = idxA === -1 ? appOrder.length + 1 : idxA;
      const bPos = idxB === -1 ? appOrder.length + 1 : idxB;
      if (aPos !== bPos) return aPos - bPos;
      return a.app.localeCompare(b.app);
    });
  }, [sections, appOrder]);

  const headerContent = {
    kicker: header?.kicker ?? "Testing Metric",
    title: header?.title ?? "Runs por aplicacao",
    description:
      header?.description ??
      "Navegue pelas runs de cada aplicacao em um carrossel horizontal com graficos e estatisticas resumidas.",
  };

  const summary = executive?.summary;
  const releases = executive?.releases ?? [];
  const gateTotal = summary
    ? summary.gate.pass + summary.gate.warn + summary.gate.fail + summary.gate.no_data
    : 0;
  const gateScore = summary && gateTotal > 0 ? Math.round((summary.gate.pass / gateTotal) * 100) : 0;

  return (
    <div className="min-h-screen tc-dark text-[var(--tc-text-inverse)] bg-[var(--tc-bg)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-10 py-8 space-y-8 sm:space-y-10">
        {showHeader && (
          <header className="space-y-3">
            <p className="text-[11px] sm:text-xs uppercase tracking-[0.32em] sm:tracking-[0.45em] text-[var(--tc-accent)]">
              {headerContent.kicker}
            </p>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-[var(--tc-text-inverse)]">
              {headerContent.title}
            </h1>
            <p className="text-sm sm:text-base text-[var(--tc-text-secondary)] max-w-4xl">
              {headerContent.description}
            </p>
          </header>
        )}

        {summary && (
          <MotionFade className="space-y-6">
            <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(239,0,1,0.18),transparent_45%),radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.14),transparent_50%)] p-6 md:p-8">
              <div className="absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.12),transparent_55%)]" />
              <div className="relative grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="space-y-4">
                  <p className="text-xs uppercase tracking-[0.35em] text-[var(--tc-accent)]">Quality Gate</p>
                  <h2 className="text-2xl md:text-3xl font-extrabold text-white">
                    Radar executivo de releases
                  </h2>
                  <p className="text-sm text-white/70">
                    Visao consolidada das runs mais recentes, com gate baseado em pass rate, falhas e cobertura.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <ThresholdChip label={`Pass >= ${summary.thresholds.passRate}%`} />
                    <ThresholdChip label={`Fail <= ${summary.thresholds.maxFailRate}%`} />
                    <ThresholdChip label={`Blocked <= ${summary.thresholds.maxBlockedRate}%`} />
                    <ThresholdChip label={`Not Run <= ${summary.thresholds.maxNotRunRate}%`} />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <MetricCard
                    label="Releases monitoradas"
                    value={formatNumber(summary.totalReleases)}
                    note={`Casos: ${formatNumber(summary.totalCases)}`}
                  />
                  <MetricCard
                    label="Pass rate global"
                    value={`${summary.passRate}%`}
                    accent="text-emerald-300"
                    note={`Fail ${summary.failRate}% - Blocked ${summary.blockedRate}%`}
                  />
                  <MetricCard
                    label="Gate aprovado"
                    value={formatNumber(summary.gate.pass)}
                    accent="text-emerald-300"
                    note={`Score ${gateScore}%`}
                  />
                  <MetricCard
                    label="Gate em risco"
                    value={formatNumber(summary.gate.warn + summary.gate.fail)}
                    accent="text-amber-300"
                    note={`${summary.gate.fail} criticas`}
                  />
                </div>
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-4">
              <GateSummaryCard status="pass" value={summary.gate.pass} label="Gate OK" />
              <GateSummaryCard status="warn" value={summary.gate.warn} label="Gate alerta" />
              <GateSummaryCard status="fail" value={summary.gate.fail} label="Gate critico" />
              <GateSummaryCard status="no_data" value={summary.gate.no_data} label="Sem dados" />
            </section>

            <section className="space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white">Releases e quality gate</h2>
                  <p className="text-sm text-[var(--tc-text-muted)]">
                    Ordenado por risco. Clique em uma release para detalhes completos.
                  </p>
                </div>
                <div className="text-xs text-[var(--tc-text-muted)]">
                  Gate ativo com minimo {summary.thresholds.minTotal} casos
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                {releases.map((release) => (
                  <MotionFade key={release.slug} delay={0.02}>
                    <ReleaseGateCard release={release} />
                  </MotionFade>
                ))}
                {releases.length === 0 && (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/70">
                    Nenhuma release encontrada para o quality gate.
                  </div>
                )}
              </div>
            </section>
          </MotionFade>
        )}

        <div className="space-y-12">
          {ordered.map((section, idx) => (
            <MotionFade key={section.app} delay={idx * 0.05}>
              <ReleaseCarousel section={section} />
            </MotionFade>
          ))}
        </div>
      </div>
    </div>
  );
}
