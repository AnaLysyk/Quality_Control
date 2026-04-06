"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useSWRReleases } from "./useSWRReleases";

import { CreateManualReleaseButton } from "@/components/CreateManualReleaseButton";
import { getAppMeta } from "@/lib/appMeta";
import { formatRunText, formatRunTitle } from "@/lib/runPresentation";

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
  const { releases, loading, error } = useSWRReleases();

  const filtered = useMemo(() => {
    const target = query.trim().toLowerCase();
    const source = releases as ReleaseCard[];
    if (!target) return source;

    return source.filter((release) => {
      return (
        release.slug.toLowerCase().includes(target) ||
        release.title.toLowerCase().includes(target) ||
        (release.summary ?? "").toLowerCase().includes(target)
      );
    });
  }, [releases, query]);

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
          <p className="text-(--tc-text-secondary)">
            Selecione a aplicacao para acessar a run desejada.
          </p>
        </div>
        <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row md:items-center">
          <CreateManualReleaseButton />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar runs"
            className="w-full rounded-xl border border-(--tc-border) bg-(--tc-surface-dark) px-4 py-3 text-sm text-(--tc-text-inverse) placeholder:text-(--tc-text-muted) focus:border-(--tc-accent) focus:outline-none focus:ring-2 focus:ring-(--tc-accent)/40 md:w-90"
          />
        </div>
      </div>

      {loading && <p className="mt-4 text-sm text-(--tc-text-muted)">Carregando runs...</p>}
      {!loading && error && (
        <p className="mt-4 text-sm text-red-500">Nao foi possivel carregar as runs agora.</p>
      )}
      {!loading && !error && !filtered.length && (
        <p className="mt-4 text-sm text-(--tc-text-muted)">
          Nenhum resultado encontrado. Ajuste a busca ou clique em uma aplicacao.
        </p>
      )}

      <div className="mt-6 space-y-6">
        {Object.entries(grouped).map(([appKey, appReleases]) => {
          const meta = getAppMeta(appKey, appKey.toUpperCase());
          const appColorClass = APP_COLOR_CLASS[appKey] ?? "app-color-default";

          return (
            <section key={appKey} className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span
                  className={`inline-flex items-center justify-center rounded-full border border-(--app-tag-color) bg-(--app-tag-color) px-3 py-1 text-[12px] font-bold uppercase tracking-[0.12em] text-white ${appColorClass}`}
                >
                  {meta.label.toUpperCase()}
                </span>
                <Link
                  href={`/applications-hub/${appKey}`}
                  className="cursor-pointer text-sm font-semibold text-(--tc-accent) transition hover:brightness-110"
                >
                  {"Ver todas as runs desta aplicacao ->"}
                </Link>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {appReleases.map((release, index) => (
                  <Link
                    key={`${release.slug ?? "release"}-${release.createdAt ?? index}`}
                    href={`/release/${release.slug}`}
                    aria-label={`Abrir run ${formatRunTitle(release.title, release.slug)}`}
                    className={`group card-tc min-h-40 cursor-pointer rounded-xl border border-(--tc-border)/40 bg-white p-4 text-[#0b1a3c] transition hover:border-(--tc-accent)/60 hover:bg-(--tc-surface-hover) hover:shadow-[0_10px_30px_var(--tc-accent-soft)] ${appColorClass}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="wrap-break-word text-[12px] leading-tight tracking-[0.14em] text-(--tc-text-muted) uppercase">
                        {release.slug.replace(/_/g, " ")}
                      </span>
                    </div>

                    <div className="mt-2 space-y-1">
                      <h3 className="text-base font-semibold text-(--tc-text-inverse)">
                        {formatRunTitle(release.title, release.slug)}
                      </h3>
                      <p className="line-clamp-2 text-sm leading-relaxed text-(--tc-text-secondary)">
                        {formatRunText(release.summary, "Sem resumo informado.")}
                      </p>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-(--tc-text-muted)">
                      <span className="inline-flex items-center gap-2">
                        <span className="inline-flex items-center justify-center rounded-full bg-(--tc-surface-dark) px-2 py-1 text-white">
                          {release.source === "MANUAL" ? "Manual" : "Integrado Qase"}
                        </span>
                        <span>
                          Criado:{" "}
                          {release.createdAt
                            ? new Date(release.createdAt).toLocaleDateString("pt-BR")
                            : "-"}
                        </span>
                      </span>

                      <span className="inline-flex items-center gap-2 text-sm font-semibold text-(--tc-accent)">
                        {"Abrir run ->"}
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
