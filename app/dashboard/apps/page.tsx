"use client";

import Link from "next/link";

const applications = [
  { slug: "sfq", name: "SFQ", info: "Runs monitoradas com gráficos e detalhamento." },
  { slug: "print", name: "PRINT", info: "Status resumido e avisos rápidos assim que forem publicados." },
  { slug: "booking", name: "Booking", info: "Linha do tempo simples para as próximas entregas." },
  { slug: "cds", name: "CDS", info: "Indicadores e runs priorizados para o CDS." },
  { slug: "gmt", name: "GMT", info: "Histórico compacto das execuções GMT." },
];

export default function DashboardApps() {
  return (
    <div className="min-h-screen tc-dark bg-(--tc-bg) text-(--tc-text-inverse) px-6 py-10 md:px-10">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.5em] text-(--tc-accent)">Aplicações</p>
          <h1 className="text-3xl font-bold leading-tight text-(--tc-text-inverse)">Testing Metric</h1>
          <p className="text-sm text-(--tc-text-secondary)">Selecione uma aplicação para navegar pelas runs e execuções.</p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {applications.map((app) => (
            <Link
              key={app.slug}
              href={`/applications/${app.slug}`}
              className="group block h-full no-underline rounded-2xl border border-(--tc-border)/20 bg-(--tc-surface-muted)/90 p-6 shadow-xl transition hover:-translate-y-1 hover:border-(--tc-accent)/60 hover:shadow-[0_16px_40px_var(--tc-accent-soft)]"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-xl font-semibold tracking-wide text-(--tc-text-inverse)">{app.name}</h2>
                  <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-(--tc-text-inverse)">
                    App
                  </span>
                </div>
                <p className="text-sm text-(--tc-text-secondary) leading-relaxed line-clamp-3">{app.info}</p>
                <p className="text-sm font-semibold text-(--tc-accent) flex items-center gap-2">
                  Abrir aplicação <span aria-hidden="true">→</span>
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
