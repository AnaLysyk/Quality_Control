"use client";

import { useMemo, useState } from "react";
import { FiBookOpen, FiSearch } from "react-icons/fi";
import { documentationEntries } from "@/data/documentation";

export default function DocumentationPage() {
  const [query, setQuery] = useState("");
  const [activeArea, setActiveArea] = useState<string>("Todas");
  const areas = useMemo(() => ["Todas", ...Array.from(new Set(documentationEntries.map((entry) => entry.area)))], []);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return documentationEntries.filter((entry) => {
      const matchesArea = activeArea === "Todas" || entry.area === activeArea;
      const haystack = `${entry.area} ${entry.title} ${entry.summary} ${entry.content}`.toLowerCase();
      return matchesArea && (!needle || haystack.includes(needle));
    });
  }, [activeArea, query]);

  return (
    <main className="min-h-screen bg-(--tc-page-bg,#f5f7fb) px-4 py-6 text-(--tc-text,#0b1a3c) lg:px-8">
      <section className="mx-auto max-w-7xl space-y-5">
        <div className="rounded-[28px] bg-[linear-gradient(135deg,#071b49,#102f72_58%,#b60018)] p-6 text-white shadow-[0_24px_70px_rgba(15,23,42,0.2)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/60">Quality Control</p>
              <h1 className="mt-2 text-3xl font-black">Documentacao viva</h1>
              <p className="mt-2 max-w-3xl text-sm text-white/72">
                Base interna para decisoes, fluxos, permissoes e retomada tecnica do produto.
              </p>
            </div>
            <div className="relative w-full max-w-md">
              <FiSearch className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="w-full rounded-2xl border border-white/16 bg-white/10 py-3 pr-4 pl-11 text-sm text-white placeholder:text-white/48 outline-none focus:ring-2 focus:ring-white/30"
                placeholder="Buscar por titulo ou conteudo"
              />
            </div>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
          <aside className="rounded-[24px] border border-(--tc-border,#dfe5f1) bg-(--tc-surface,#fff) p-3 shadow-sm">
            {areas.map((area) => (
              <button
                key={area}
                type="button"
                onClick={() => setActiveArea(area)}
                className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold transition ${
                  activeArea === area ? "bg-(--tc-accent,#ef0001) text-white" : "text-(--tc-text,#0b1a3c) hover:bg-(--tc-surface-2,#eef4ff)"
                }`}
              >
                <FiBookOpen className="h-4 w-4" />
                {area}
              </button>
            ))}
          </aside>

          <section className="grid gap-4 md:grid-cols-2">
            {filtered.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-(--tc-border,#dfe5f1) bg-(--tc-surface,#fff) p-8 text-sm text-(--tc-text-muted,#64748b) md:col-span-2">
                Nenhum documento encontrado para a busca atual.
              </div>
            ) : (
              filtered.map((entry) => (
                <article key={entry.id} className="rounded-[24px] border border-(--tc-border,#dfe5f1) bg-(--tc-surface,#fff) p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <span className="rounded-full bg-(--tc-accent-soft,#fee2e2) px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-(--tc-accent,#ef0001)">
                      {entry.area}
                    </span>
                    <span className="text-xs text-(--tc-text-muted,#64748b)">{entry.updatedAt}</span>
                  </div>
                  <h2 className="mt-4 text-xl font-black">{entry.title}</h2>
                  <p className="mt-2 text-sm font-semibold text-(--tc-text-secondary,#475569)">{entry.summary}</p>
                  <p className="mt-4 text-sm leading-6 text-(--tc-text-muted,#64748b)">{entry.content}</p>
                </article>
              ))
            )}
          </section>
        </div>
      </section>
    </main>
  );
}
