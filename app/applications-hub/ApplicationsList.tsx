"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FiSearch } from "react-icons/fi";

import { getAppMeta } from "@/lib/appMeta";

type AppInfo = {
  slug: string;
  name: string;
  tag: string;
};

type ApplicationsListProps = {
  className?: string;
};

const fallbackApps: AppInfo[] = [
  { slug: "smart", name: "SMART", tag: "SMART" },
  { slug: "print", name: "PRINT", tag: "PRINT" },
  { slug: "booking", name: "BOOKING", tag: "BOOKING" },
  { slug: "trust", name: "TRUST", tag: "TRUST" },
  { slug: "cidadao-smart", name: "CIDADAO SMART", tag: "CIDADAO" },
  { slug: "mobile-griaule", name: "GRIAULE MOBILE", tag: "MOBILE" },
];

const APP_COLOR_CLASS: Record<string, string> = {
  smart: "app-color-smart",
  sfq: "app-color-smart",
  print: "app-color-print",
  booking: "app-color-booking",
  trust: "app-color-trust",
  cds: "app-color-cds",
  "cidadao-smart": "app-color-cidadao",
  gmt: "app-color-gmt",
  "mobile-griaule": "app-color-gmt",
};

export function ApplicationsList({ className }: ApplicationsListProps) {
  const [apps, setApps] = useState<AppInfo[]>(fallbackApps);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Prevent race conditions
  useEffect(() => {
    let cancelled = false;
    const loadApps = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/applications", { cache: "no-store" });
        if (!res.ok) {
          if (!cancelled) {
            setApps(fallbackApps);
            setError("Erro ao buscar aplicações");
          }
          return;
        }
        const json = await res.json();
        type RawApp = { slug?: string; name?: string; tag?: string };
        const rawList: RawApp[] = Array.isArray(json.applications) ? json.applications : [];
        const mapped: AppInfo[] = rawList.map((app) => ({
          slug: app.slug?.toLowerCase().trim() ?? app.name?.toLowerCase()?.replace(/\s+/g, "-")?.trim() ?? "",
          name: app.name?.trim() ?? "Aplicacao",
          tag: app.tag?.trim() ?? app.name?.toUpperCase() ?? "APP",
        }));
        if (!cancelled) {
          setApps(mapped.length > 0 ? mapped : fallbackApps);
        }
      } catch {
        if (!cancelled) {
          setApps(fallbackApps);
          setError("Erro ao buscar aplicações");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadApps();
    return () => {
      cancelled = true;
    };
  }, []);

  // Sanitize and trim search input
  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value.replace(/\s+/g, " ").trimStart());
  };

  const filteredApps = useMemo(() => {
    const term = query.toLowerCase().trim();
    return apps.filter((app) => app.name.toLowerCase().includes(term));
  }, [apps, query]);

  return (
    <div className={className} data-testid="applications-list">
      <div className="relative max-w-md">
        <FiSearch className="absolute left-3 top-3 text-gray-500 text-lg" aria-hidden="true" />
        <input
          type="text"
          placeholder="Buscar aplicacao..."
          value={query}
          onChange={handleQueryChange}
          aria-label="Buscar aplicação"
          className="w-full rounded-xl bg-white border border-(--surface-border,#e5e7eb) py-2 pl-10 pr-4 text-sm text-(--page-text,#0b1a3c) placeholder-gray-500 shadow-sm focus:outline-none focus:border-(--tc-accent) focus:ring-2 focus:ring-(--tc-accent)/20"
        />
      </div>

      {loading && (
        <div className="mt-6 text-center text-gray-500" role="status">Carregando aplicações...</div>
      )}

      {error && !loading && (
        <div className="mt-6 rounded-2xl border border-(--surface-border,#e5e7eb) bg-white p-6 md:p-10 text-center text-red-600 space-y-4 shadow-sm" role="alert">
          <p className="text-lg font-semibold">{error}</p>
        </div>
      )}

      {!loading && !error && filteredApps.length === 0 && (
        <div className="mt-6 rounded-2xl border border-(--surface-border,#e5e7eb) bg-white p-6 md:p-10 text-center text-(--page-text,#0b1a3c) space-y-4 shadow-sm">
          <p className="text-lg font-semibold">Nenhuma aplicacao encontrada.</p>
        </div>
      )}

      {!loading && !error && filteredApps.length > 0 && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredApps.map((app, idx) => {
            const meta = getAppMeta(app.slug, app.tag);
            const appColorClass = APP_COLOR_CLASS[app.slug] ?? "app-color-default";
            return (
              <Link
                key={app.slug || idx}
                href={`/applications-hub/${app.slug}`}
                className="rounded-2xl border border-(--surface-border,#e5e7eb) bg-white p-6 shadow-lg shadow-black/10 transition hover:border-(--tc-accent)/60 text-(--page-text,#0b1a3c) focus:outline-none focus:ring-2 focus:ring-(--tc-accent)/40"
                tabIndex={0}
                aria-label={`Abrir aplicação ${app.name}`}
                data-testid={`app-card-${app.slug}`}
              >
                <div className="space-y-3">
                  <span className={`app-tag text-[12px] ${appColorClass}`}>
                    {meta.label.toUpperCase()}
                  </span>
                  <p className="text-lg font-semibold">{app.name}</p>
                  <p className="text-sm font-semibold text-(--tc-accent) flex items-center gap-2">
                    Ver runs <span aria-hidden="true">→</span>
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
