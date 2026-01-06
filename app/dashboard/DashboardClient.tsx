"use client";

import { useMemo, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import StatusChart from "@/components/StatusChart";
import StatusPill from "@/components/StatusPill";
import { STATUS_COLORS } from "@/utils/statusColors";
import { FiArrowLeft, FiArrowRight } from "react-icons/fi";
import { MotionFade, MotionScale } from "@/components/motion";

type Stats = { pass: number; fail: number; blocked: number; notRun: number };

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

type DashboardHeader = {
  kicker?: string;
  title?: string;
  description?: string;
};

function formatDate(value?: string) {
  if (!value) return "Data N/D";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data N/D";
  return date.toLocaleDateString("pt-BR");
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
}: {
  sections: Section[];
  header?: DashboardHeader;
  showHeader?: boolean;
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
