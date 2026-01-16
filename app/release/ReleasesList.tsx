"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { getAppMeta } from "@/lib/appMeta";
import { CreateManualReleaseButton } from "@/components/CreateManualReleaseButton";

type ReleaseCard = {
  slug: string;
  title: string;
  summary: string;
  app?: string;
  project?: string;
  createdAt?: string;
  source?: string;
};

type ReleasesListProps = {
  className?: string;
};

const APP_COLOR_CLASS: Record<string, string> = {
  smart: "app-color-smart",
  sfq: "app-color-smart",
  print: "app-color-print",
  booking: "app-color-booking",
  cds: "app-color-cds",
  trust: "app-color-trust",
  "cidadao-smart": "app-color-cidadao",
  gmt: "app-color-gmt",
  "mobile-griaule": "app-color-gmt",
};

export function ReleasesList({ className }: ReleasesListProps) {
  const [query, setQuery] = useState("");
  const [list, setList] = useState<ReleaseCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [apiRes, manualRes] = await Promise.all([
          fetch("/api/releases", { cache: "no-store" }),
          fetch("/api/releases-manual", { cache: "no-store" }),
        ]);

        const apiJson = await apiRes.json().catch(() => ({}));
        const apiList = Array.isArray(apiJson?.releases) ? (apiJson.releases as ReleaseCard[]) : [];

        const manualJson = await manualRes.json().catch(() => []);
        const manualListRaw = Array.isArray(manualJson) ? (manualJson as unknown[]) : [];
        const manualList: ReleaseCard[] = [];
        for (const row of manualListRaw) {
          const r = (row ?? null) as Record<string, unknown> | null;
          if (!r) continue;
          const slug = typeof r.slug === "string" ? r.slug : "";
          if (!slug) continue;
          const title = typeof r.name === "string" ? r.name : typeof r.title === "string" ? r.title : slug;
          const summary =
            typeof r.observations === "string"
              ? r.observations
              : typeof r.summary === "string"
                ? r.summary
                : "Run manual";
          const app = typeof r.app === "string" ? r.app : undefined;
          const createdAt = typeof r.createdAt === "string" ? r.createdAt : undefined;
          const source = typeof r.source === "string" ? r.source : "MANUAL";
          manualList.push({ slug, title, summary, app, createdAt, source });
        }

        const merged = [...manualList, ...apiList];
        const unique = new Map<string, ReleaseCard>();
        for (const rel of merged) unique.set(rel.slug, rel);
        setList(Array.from(unique.values()));
      } catch {
        setList([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    const target = query.trim().toLowerCase();
    if (!target) return list;
    return list.filter((release) => {
      return (
        release.slug.toLowerCase().includes(target) ||
        release.title.toLowerCase().includes(target) ||
        (release.summary ?? "").toLowerCase().includes(target)
      );
    });
  }, [list, query]);

  const grouped = useMemo(() => {
    return filtered.reduce((acc, release) => {
      const bucket = (release.app || release.project || "smart").toLowerCase();
      if (!acc[bucket]) acc[bucket] = [];
      acc[bucket].push(release);
      return acc;
    }, {} as Record<string, ReleaseCard[]>);
  }, [filtered]);

  return (
    <div className={className}>
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-(--tc-text-inverse)">Runs monitoradas</h2>
          <p className="text-(--tc-text-secondary)">Selecione a aplicação para acessar a run desejada.</p>
        </div>
        <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto md:items-center">
          <CreateManualReleaseButton />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar runs"
            className="w-full md:w-90 rounded-xl border border-(--tc-border) bg-(--tc-surface-dark) px-4 py-3 text-sm text-(--tc-text-inverse) placeholder:text-(--tc-text-muted) focus:border-(--tc-accent) focus:outline-none focus:ring-2 focus:ring-(--tc-accent)/40"
          />
        </div>
      </div>

      {loading && <p className="mt-4 text-sm text-(--tc-text-muted)">Carregando runs...</p>}
      {!loading && !filtered.length && (
        <p className="mt-4 text-sm text-(--tc-text-muted)">
          Nenhum resultado encontrado. Ajuste a busca ou clique em uma aplicação.
        </p>
      )}

      <div className="space-y-6 mt-6">
        {Object.entries(grouped).map(([appKey, releases]) => {
          const meta = getAppMeta(appKey, appKey.toUpperCase());
          const appColorClass = APP_COLOR_CLASS[appKey] ?? "app-color-default";

          return (
            <section key={appKey} className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span
                  className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-[12px] font-bold uppercase tracking-[0.12em] text-white border border-(--app-tag-color) bg-(--app-tag-color) ${appColorClass}`}
                >
                  {meta.label.toUpperCase()}
                </span>
                <Link
                  href={`/applications-hub/${appKey}`}
                  className="cursor-pointer text-sm font-semibold text-(--tc-accent) hover:brightness-110 transition"
                >
                  Ver todas as runs desta aplicacao →
                </Link>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {releases.map((rel) => (
                  <Link
                    key={rel.slug}
                    href={`/release/${rel.slug}`}
                    aria-label={`Abrir run ${rel.title}`}
                    className={`cursor-pointer group card-tc bg-white text-[#0b1a3c] border border-(--tc-border)/40 p-4 min-h-40 rounded-xl transition hover:bg-(--tc-surface-hover) hover:border-(--tc-accent)/60 hover:shadow-[0_10px_30px_var(--tc-accent-soft)] ${appColorClass}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[12px] uppercase tracking-[0.14em] leading-tight text-(--tc-text-muted) wrap-break-word">
                        {rel.slug.replace(/_/g, " ")}
                      </span>
                    </div>

                    <div className="mt-2 space-y-1">
                      <h3 className="text-base font-semibold text-(--tc-text-inverse)">
                        {(rel.title ?? "").replace(/^run\s*/i, "")}
                      </h3>
                      <p className="text-sm text-(--tc-text-secondary) leading-relaxed line-clamp-2">{rel.summary}</p>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-(--tc-text-muted)">
                      <span className="inline-flex items-center gap-2">
                        <span className="inline-flex items-center justify-center rounded-full px-2 py-1 bg-(--tc-surface-dark) text-white">
                          {rel.source === "MANUAL" ? "Manual" : "Integrado Qase"}
                        </span>
                        <span>
                          Criado: {rel.createdAt ? new Date(rel.createdAt).toLocaleDateString("pt-BR") : "-"}
                        </span>
                      </span>

                      <span className="inline-flex items-center gap-2 text-sm font-semibold text-(--tc-accent)">
                        Abrir run →
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
