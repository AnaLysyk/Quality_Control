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
  { slug: "gmt", name: "GMT MOBILE", tag: "MOBILE" },
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
};

export function ApplicationsList({ className }: ApplicationsListProps) {
  const [apps, setApps] = useState<AppInfo[]>(fallbackApps);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const loadApps = async () => {
      try {
        const res = await fetch("/api/applications", { cache: "no-store" });
        if (!res.ok) {
          setApps(fallbackApps);
          return;
        }
        const json = await res.json();

        type RawApp = { slug?: string; name?: string; tag?: string };
        const rawList: RawApp[] = Array.isArray(json.applications) ? json.applications : [];

        const mapped: AppInfo[] = rawList.map((app) => ({
          slug: app.slug ?? app.name?.toLowerCase()?.replace(/\s+/g, "-") ?? "",
          name: app.name ?? "Aplicação",
          tag: app.tag ?? app.name?.toUpperCase() ?? "APP",
        }));

        setApps(mapped.length > 0 ? mapped : fallbackApps);
      } catch {
        setApps(fallbackApps);
      }
    };

    loadApps();
  }, []);

  const filteredApps = useMemo(() => {
    const term = query.toLowerCase();
    return apps.filter((app) => app.name.toLowerCase().includes(term));
  }, [apps, query]);

  return (
    <div className={className}>
      <div className="relative max-w-md">
        <FiSearch className="absolute left-3 top-3 text-gray-500 text-lg" />
        <input
          type="text"
          placeholder="Buscar aplicação..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-xl bg-white border border-(--surface-border,#e5e7eb) py-2 pl-10 pr-4 text-sm text-(--page-text,#0b1a3c) placeholder-gray-500 shadow-sm focus:outline-none focus:border-(--tc-accent) focus:ring-2 focus:ring-(--tc-accent)/20"
        />
      </div>

      {filteredApps.length === 0 && (
        <div className="mt-6 rounded-2xl border border-(--surface-border,#e5e7eb) bg-white p-6 md:p-10 text-center text-(--page-text,#0b1a3c) space-y-4 shadow-sm">
          <p className="text-lg font-semibold">Nenhuma aplicação encontrada.</p>
        </div>
      )}

      {filteredApps.length > 0 && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredApps.map((app) => {
            const meta = getAppMeta(app.slug, app.tag);
            const appColorClass = APP_COLOR_CLASS[app.slug] ?? "app-color-default";
            return (
              <Link
                key={app.slug}
                href={`/applications-panel/${app.slug}`}
                className="rounded-2xl border border-(--surface-border,#e5e7eb) bg-white p-6 shadow-lg shadow-black/10 transition hover:border-(--tc-accent)/60 text-(--page-text,#0b1a3c)"
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
