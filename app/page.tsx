"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { getAppMeta } from "@/lib/appMeta";

const applications = [
  { name: "SMART", slug: "smart" },
  { name: "PRINT", slug: "print" },
  { name: "BOOKING", slug: "booking" },
  { name: "TRUST", slug: "trust" },
  { name: "CIDADAO SMART", slug: "cidadao-smart" },
  { name: "MOBILE GRIAULE", slug: "mobile-griaule" },
];

type ReleaseCard = {
  id: string;
  title: string;
  summary: string;
  app?: string;
  project?: string;
  type: "aceitacao" | "regressao" | "outro";
};

export default function HomePage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [feedback, setFeedback] = useState("");
  const [releases, setReleases] = useState<ReleaseCard[]>([]);

  const appsRef = useRef<HTMLDivElement | null>(null);
  const aceRef = useRef<HTMLDivElement | null>(null);
  const regRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/releases", { cache: "no-store" });
        const json = await res.json();
        type RawRelease = { slug?: string; title?: string; summary?: string; app?: string; project?: string };
        const rawList: RawRelease[] = Array.isArray(json.releases) ? json.releases : [];
        const mapped: ReleaseCard[] = rawList.map((rel) => {
          const lower = (rel.title || "").toLowerCase();
          const type: ReleaseCard["type"] =
            lower.includes("aceitacao") || rel.slug?.includes("_ace")
              ? "aceitacao"
              : lower.includes("regressao") || rel.slug?.includes("_reg")
                ? "regressao"
                : "outro";
          return {
            id: rel.slug,
            title: rel.title,
            summary: rel.summary,
            app: rel.app ?? rel.project,
            project: rel.project,
            type,
          };
        });
        setReleases(mapped);
      } catch {
        setReleases([]);
      }
    };
    load();
  }, []);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredApps = applications.filter((app) =>
    normalizedQuery ? app.name.toLowerCase().includes(normalizedQuery) || app.slug.includes(normalizedQuery) : true,
  );

  const releaseList = useMemo(() => releases, [releases]);
  const filteredReleases = releaseList.filter((rel) => {
    if (!normalizedQuery) return true;
    const cleanId = rel.id.replace(/[^a-z0-9]/g, "");
    const cleanQuery = normalizedQuery.replace(/[^a-z0-9]/g, "");
    return (
      rel.id.toLowerCase().includes(normalizedQuery) ||
      cleanId.includes(cleanQuery) ||
      rel.title.toLowerCase().includes(normalizedQuery)
    );
  });

  const quickResults =
    normalizedQuery.length > 0
      ? [
          ...filteredApps.map((app) => ({ type: "app" as const, label: app.name, href: `/applications/${app.slug}` })),
          ...filteredReleases.map((rel) => ({ type: "release" as const, label: rel.title, href: `/release/${rel.id}` })),
        ]
      : [];

  const scrollBy = (ref: React.RefObject<HTMLDivElement | null>, delta: number) => {
    if (ref.current) {
      ref.current.scrollBy({ left: delta, behavior: "smooth" });
    }
  };

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const target = normalizedQuery;
    if (!target) return;

    const appHit = filteredApps[0];
    if (appHit) {
      router.push(`/applications/${appHit.slug}`);
      return;
    }
    const releaseHit = filteredReleases[0];
    if (releaseHit) {
      router.push(`/release/${releaseHit.id}`);
      return;
    }
    setFeedback("Nenhum resultado encontrado.");
  };

  const acceptances = filteredReleases.filter((rel) => rel.type === "aceitacao");
  const regressions = filteredReleases.filter((rel) => rel.type === "regressao");

  const renderReleaseCard = (rel: ReleaseCard) => {
    const appTag = (rel.app || rel.project || "smart").toLowerCase();
    const meta = getAppMeta(appTag, appTag.toUpperCase());
    const tagLabel = meta.label.toUpperCase();
    const tagStyle = { "--app-tag-color": meta.color } as CSSProperties;
    const displayName = rel.title?.split(" - ")[0] || rel.title;
    const subtitle = rel.type === "aceitacao" ? "Aceitação" : rel.type === "regressao" ? "Regressão" : "Release";
    return (
      <Link
        key={rel.id}
        href={`/release/${rel.id}`}
        className="min-w-[260px] w-[260px] h-[260px] rounded-2xl border border-[var(--surface-border,#e5e7eb)] bg-white p-5 shadow-lg shadow-black/10 transition hover:border-[var(--tc-accent)]/60 hover:-translate-y-1 flex flex-col justify-between"
        style={{ scrollSnapAlign: "start" }}
      >
        <div className="flex items-start justify-between gap-2 mb-3">
          <span style={tagStyle} className="app-tag text-[11px] leading-[1.1]">
            {tagLabel}
          </span>
          <span className="text-xs text-[var(--tc-text-muted)]">{subtitle}</span>
        </div>
        <p className="text-sm uppercase tracking-[0.35em] text-[var(--tc-primary)]">{displayName}</p>
        <p className="text-xs text-[var(--tc-text-muted)] mt-2 line-clamp-2">{rel.summary}</p>
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-[var(--page-bg,#ffffff)] text-[var(--page-text,#0b1a3c)]">
      <div className="max-w-6xl mx-auto px-6 py-10 space-y-8">
        <div className="space-y-4 text-center">
          <p className="text-xs uppercase tracking-[0.5em] text-[var(--tc-accent)]">Testing Company</p>
          <h1 className="text-4xl md:text-5xl font-extrabold text-[var(--page-text,#0b1a3c)]">Testing Metric</h1>
          <p className="text-[var(--tc-text-secondary,#4b5563)] max-w-3xl mx-auto">
            Monitoramento inteligente de qualidade em tempo real. Busque por aplicações e releases, acesse execuções e
            acompanhe indicadores críticos.
          </p>
        </div>

        <form onSubmit={handleSearch} className="flex flex-col gap-3 md:flex-row">
          <input
            type="search"
            placeholder="Buscar aplicação (ex: SMART) ou release (ex: v1_8_0_reg)"
            value={query}
            onChange={(event) => {
              setFeedback("");
              setQuery(event.target.value);
            }}
            className="flex-1 rounded-xl border border-[var(--surface-border,#e5e7eb)] bg-white px-4 py-3 text-[var(--page-text,#0b1a3c)] focus:border-[var(--tc-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--tc-accent)]/30 transition shadow-sm"
            aria-label="Buscar aplicação ou release"
          />
          <button
            type="submit"
            className="rounded-xl bg-[var(--tc-accent)] px-6 py-3 font-semibold text-white shadow-lg shadow-[var(--tc-accent)]/35 transition hover:bg-[var(--tc-accent-hover)]"
          >
            Buscar
          </button>
        </form>
        {feedback && <p className="text-sm text-[#F25C5C]">{feedback}</p>}

        {quickResults.length > 0 && (
          <div className="rounded-xl border border-[var(--surface-border,#e5e7eb)] bg-white px-4 py-3 space-y-2 shadow-sm">
            <p className="text-xs uppercase tracking-[0.4em] text-[var(--tc-accent)]">Resultados</p>
            <div className="flex flex-wrap gap-3">
              {quickResults.map((item, idx) => (
                <Link
                  key={`${item.type}-${idx}`}
                  href={item.href}
                  className="rounded-lg border border-[var(--surface-border,#e5e7eb)] bg-white px-3 py-2 text-sm text-[var(--page-text,#0b1a3c)] hover:border-[var(--tc-accent)]/60 transition shadow-sm"
                >
                  {item.type === "app" ? "Aplicação" : "Release"}: {item.label}
                </Link>
              ))}
            </div>
          </div>
        )}

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.4em] text-[var(--tc-accent)]">Aplicações</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => scrollBy(appsRef, -300)}
                className="rounded-full bg-white/10 px-3 py-2 hover:bg-[var(--tc-accent)]/15 transition"
                aria-label="Deslocar aplicações para esquerda"
              >
                ←
              </button>
              <button
                type="button"
                onClick={() => scrollBy(appsRef, 300)}
                className="rounded-full bg-white/10 px-3 py-2 hover:bg-[var(--tc-accent)]/15 transition"
                aria-label="Deslocar aplicações para direita"
              >
                →
              </button>
            </div>
          </div>
          <div
            ref={appsRef}
            className="flex gap-4 overflow-x-auto pb-2 custom-scroll"
            style={{ scrollSnapType: "x mandatory" }}
          >
            {(filteredApps.length ? filteredApps : applications).map((app) => (
              <Link
                key={app.slug}
                href={`/applications/${app.slug}`}
                className="min-w-[260px] w-[260px] h-[260px] rounded-2xl border border-[var(--surface-border,#e5e7eb)] bg-white p-6 shadow-lg shadow-black/10 transition hover:border-[var(--tc-accent)]/60 hover:-translate-y-1 flex flex-col items-center justify-center text-center gap-3 text-[var(--page-text,#0b1a3c)]"
                style={{ scrollSnapAlign: "start" }}
              >
                <h3 className="text-lg font-semibold">{app.name}</h3>
              </Link>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.4em] text-[var(--tc-accent)]">Releases — Aceitação</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => scrollBy(aceRef, -300)}
                className="rounded-full bg-white/10 px-3 py-2 hover:bg-[var(--tc-accent)]/15 transition"
                aria-label="Deslocar releases de aceitação para esquerda"
              >
                ←
              </button>
              <button
                type="button"
                onClick={() => scrollBy(aceRef, 300)}
                className="rounded-full bg-white/10 px-3 py-2 hover:bg-[var(--tc-accent)]/15 transition"
                aria-label="Deslocar releases de aceitação para direita"
              >
                →
              </button>
            </div>
          </div>
          <div
            ref={aceRef}
            className="flex gap-4 overflow-x-auto pb-2 custom-scroll"
            style={{ scrollSnapType: "x mandatory" }}
          >
            {(acceptances.length ? acceptances : filteredReleases.filter((r) => r.type === "aceitacao")).map(
              renderReleaseCard,
            )}
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.4em] text-[var(--tc-accent)]">Releases — Regressão</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => scrollBy(regRef, -300)}
                className="rounded-full bg-white/10 px-3 py-2 hover:bg-[var(--tc-accent)]/15 transition"
                aria-label="Deslocar releases de regressão para esquerda"
              >
                ←
              </button>
              <button
                type="button"
                onClick={() => scrollBy(regRef, 300)}
                className="rounded-full bg-white/10 px-3 py-2 hover:bg-[var(--tc-accent)]/15 transition"
                aria-label="Deslocar releases de regressão para direita"
              >
                →
              </button>
            </div>
          </div>
          <div
            ref={regRef}
            className="flex gap-4 overflow-x-auto pb-2 custom-scroll"
            style={{ scrollSnapType: "x mandatory" }}
          >
            {(regressions.length ? regressions : filteredReleases.filter((r) => r.type === "regressao")).map(
              renderReleaseCard,
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
