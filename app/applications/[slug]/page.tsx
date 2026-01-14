"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type ReleaseCard = {
  id: string;
  title: string;
  summary: string;
  app?: string;
  project?: string;
  type: "aceitacao" | "regressao" | "outro";
};

type RawRelease = {
  slug?: string;
  title?: string;
  summary?: string;
  app?: string;
  project?: string;
};

const SLUG_ALIASES: Record<string, string[]> = {
  sfq: ["sfq", "smart"],
  gmt: ["gmt", "mobile-griaule"],
};

const colorClassMap: Record<string, string> = {
  sfq: "bg-(--stat-pass)",
  smart: "bg-(--stat-pass)",
  print: "bg-(--color-print,var(--tc-accent))",
  booking: "bg-(--color-booking,var(--tc-accent))",
  cds: "bg-(--color-cds,var(--tc-accent))",
  trust: "bg-(--color-trust,var(--tc-accent))",
  "cidadao-smart": "bg-(--color-cidadao,var(--tc-accent))",
  "mobile-griaule": "bg-(--color-gmt,var(--tc-accent))",
  gmt: "bg-(--color-gmt,var(--tc-accent))",
};

export default function ApplicationPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const slug = params?.slug?.toString().toLowerCase() ?? "";

  const slugMatches = useMemo(() => SLUG_ALIASES[slug] ?? [slug], [slug]);

  const [releases, setReleases] = useState<ReleaseCard[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/releases", { cache: "no-store" });
        const json = await res.json();
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
            id: rel.slug ?? "",
            title: rel.title ?? "",
            summary: rel.summary ?? "",
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

  const filtered = useMemo(() => {
    return releases.filter((rel) => {
      const appKey = (rel.app ?? rel.project ?? "").toLowerCase();
      return slugMatches.includes(appKey);
    });
  }, [releases, slugMatches]);

  const hasReleases = filtered.length > 0;

  const renderReleaseCard = (rel: ReleaseCard) => {
    const appKey = (rel.app || rel.project || slug || "app").toLowerCase();
    const colorClass = colorClassMap[appKey] ?? "bg-(--tc-accent)";
    const appTag = appKey.toUpperCase();
    const displayName = rel.title?.split(" - ")[0] || rel.title;
    const subtitle =
      rel.type === "aceitacao" ? "Aceitacao" : rel.type === "regressao" ? "Regressao" : "Run";
    return (
      <Link
        key={rel.id}
        href={`/release/${rel.id}`}
        className="block h-full rounded-2xl border border-white/10 bg-linear-to-br from-[#11131e] to-[#0c101a] p-5 shadow-lg shadow-black/60 transition hover:border-(--tc-accent)/60"
      >
        <div className="flex items-start justify-between gap-2 mb-3">
          <span className={`rounded-full px-2.5 py-1 text-[11px] leading-[1.1] font-semibold text-black text-center min-w-22 ${colorClass}`}>
            {appTag}
          </span>
          <span className="text-xs text-gray-300">{subtitle}</span>
        </div>
        <p className="text-sm uppercase tracking-[0.35em] text-(--tc-accent)">{displayName}</p>
        <p className="text-xs text-gray-400 mt-2 line-clamp-2">{rel.summary}</p>
      </Link>
    );
  };

  return (
    <div className="min-h-screen text-white px-4 sm:px-6 md:px-10 py-8 md:py-10">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.5em] text-(--tc-accent)">Aplicacao</p>
            <h1 className="text-3xl font-bold">{slug.toUpperCase()}</h1>
          </div>
          <button
            type="button"
            onClick={() => router.push("/applications")}
            className="rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold hover:border-(--tc-accent)/70 transition"
          >
            Voltar
          </button>
        </div>

        {!hasReleases && (
          <div className="rounded-2xl border border-white/10 bg-[#101528] p-6 md:p-10 text-center text-gray-200 space-y-4">
            <p className="text-lg font-semibold">Esta aplicacao ainda nao possui runs disponiveis.</p>
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => router.push("/applications")}
                className="inline-flex items-center gap-2 rounded-xl bg-(--tc-accent) px-4 py-2 text-sm font-semibold text-black hover:brightness-110 transition"
              >
                Voltar para aplicações
              </button>
            </div>
          </div>
        )}

        {hasReleases && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.4em] text-(--tc-accent)">Runs</p>
              <span className="text-sm text-gray-300">{filtered.length} resultado(s)</span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map(renderReleaseCard)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
