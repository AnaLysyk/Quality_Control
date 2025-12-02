"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { releaseOrder, releasesData } from "./data";

const appMeta: Record<string, { label: string; color: string }> = {
  smart: { label: "SMART", color: "#7CD343" },
  print: { label: "PRINT", color: "#4F9DFF" },
  booking: { label: "BOOKING", color: "#9C6CFF" },
  trust: { label: "TRUST", color: "#FFA73A" },
  "cidadao-smart": { label: "CIDADÃO SMART", color: "#00E5FF" },
  "mobile-griaule": { label: "MOBILE GRIAULE", color: "#FFD84D" },
};

type ReleaseCard = {
  id: string;
  title: string;
  summary: string;
  app: keyof typeof appMeta;
};

export default function ReleasesPage() {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const target = query.trim().toLowerCase();
    const list: ReleaseCard[] = releaseOrder.map((id) => ({
      id,
      title: releasesData[id].title,
      summary: releasesData[id].summary,
      app: releasesData[id].app as ReleaseCard["app"],
    }));

    if (!target) {
      return list;
    }

    return list.filter((release) => {
      return (
        release.id.toLowerCase().includes(target) ||
        release.title.toLowerCase().includes(target) ||
        release.summary.toLowerCase().includes(target)
      );
    });
  }, [query]);

  const grouped = useMemo(() => {
    return filtered.reduce((acc, release) => {
      const bucket = release.app || "smart";
      if (!acc[bucket]) {
        acc[bucket] = [];
      }
      acc[bucket].push(release);
      return acc;
    }, {} as Record<string, ReleaseCard[]>);
  }, [filtered]);

  return (
    <div className="text-white p-10 space-y-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-300">Releases monitoradas</h1>
          <p className="text-gray-400">Selecione a aplicação para acessar o release desejado.</p>
        </div>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar releases"
          className="w-full max-w-md rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-gray-500 focus:border-[#7CD343] focus:outline-none"
        />
      </div>

      {!filtered.length && (
        <p className="text-sm text-gray-400">Nenhum resultado encontrado. Ajuste a busca ou clique em uma aplicação.</p>
      )}

      {Object.entries(grouped).map(([appKey, releases]) => {
        const app = appMeta[appKey] ?? { label: appKey.toUpperCase(), color: "#7CD343" };

        return (
          <section key={appKey} className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span
                className="inline-flex items-center justify-center rounded-full px-3 py-1 text-sm font-semibold text-black"
                style={{ backgroundColor: app.color }}
              >
                {app.label.toUpperCase()}
              </span>
              <Link
                href={`/applications/${appKey}`}
                className="text-sm font-semibold text-[#7CD343] hover:text-[#9bf45b] transition"
              >
                Ver telas da aplicação →
              </Link>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {releases.map((rel) => (
                <Link
                  key={rel.id}
                  href={`/release/${rel.id}`}
                  className="group rounded-xl border border-white/10 bg-[#101528] p-5 transition hover:border-[#7CD343]/70 hover:shadow-[0_10px_30px_rgba(124,211,67,0.2)]"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-flex items-center justify-center rounded-full px-2 py-1 text-xs font-bold text-black"
                      style={{ backgroundColor: app.color }}
                    >
                      {app.label}
                    </span>
                    <p className="text-xs uppercase tracking-[0.4em] text-gray-500">{rel.id.replace(/_/g, " ")}</p>
                  </div>
                  <h2 className="text-lg font-semibold text-white mt-1">{rel.title}</h2>
                  <p className="text-sm text-gray-300 mt-2 leading-relaxed">{rel.summary}</p>
                  <span className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-[#7CD343]">
                    Abrir release →
                  </span>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
