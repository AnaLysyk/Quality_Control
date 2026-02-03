"use client";

import Link from "next/link";
import Breadcrumb from "@/components/Breadcrumb";
import { RequireAuth } from "@/components/RequireAuth";
import { CompanySelector } from "@/components/CompanySelector";

export default function DocumentosPage() {
  return (
    <RequireAuth>
      <div className="min-h-screen bg-(--page-bg,#ffffff) text-(--page-text,#0b1a3c)">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-10 space-y-6">
          <Breadcrumb items={[{ label: "Documentacoes" }]} />

          <header className="space-y-2">
            <p className="text-xs uppercase tracking-[0.35em] text-(--tc-text-muted,#6b7280)">Documentos</p>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-(--tc-text-primary,#0b1a3c)">
              Documentacoes por empresa
            </h1>
            <p className="text-sm text-(--tc-text-secondary,#4b5563)">
              Consulte arquivos e links por empresa, alem da documentacao da propria plataforma.
            </p>
          </header>

          <section className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#ffffff) p-5 space-y-3">
            <div>
              <h2 className="text-lg font-semibold text-(--tc-text-primary,#0b1a3c)">Documentacao da plataforma</h2>
              <p className="text-sm text-(--tc-text-muted,#6b7280)">
                Materiais internos e referencia tecnica.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/docs"
                className="rounded-lg bg-(--tc-accent,#ef0001) px-4 py-2 text-sm font-semibold text-(--tc-text-inverse,#ffffff) hover:bg-(--tc-accent-hover,#c80001) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--tc-focus)"
              >
                Abrir documentacao
              </Link>
            </div>
          </section>

          <section className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#ffffff) p-5">
            <CompanySelector
              title="Empresas com documentacao"
              description="Escolha uma empresa para ver e anexar documentos."
              buildHref={(company) => `/empresas/${encodeURIComponent(company.clientSlug)}/documentos`}
              ctaLabel="Abrir documentos"
            />
          </section>
        </div>
      </div>
    </RequireAuth>
  );
}
