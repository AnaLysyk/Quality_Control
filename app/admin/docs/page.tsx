"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";

export default function AdminDocsPage() {
  return (
    <div className="min-h-screen bg-(--page-bg,#ffffff) text-(--page-text,#0b1a3c)">
        <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-10 space-y-6">
          <header className="rounded-2xl border border-[var(--tc-border)] bg-[var(--tc-surface)] p-5">
            <p className="text-xs uppercase tracking-[0.35em] text-[var(--tc-text-muted)]">Admin</p>
            <h1 className="mt-1 text-2xl font-bold text-[var(--tc-text)]">DocumentaÃ§Ã£o do sistema</h1>
            <p className="mt-2 text-sm text-[var(--tc-text-muted)]">
              Atalhos para documentos internos e referÃªncia rÃ¡pida de como as integraÃ§Ãµes funcionam.
            </p>
          </header>

          <section className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-[var(--tc-border)] bg-[var(--tc-surface)] p-5">
              <h2 className="text-lg font-semibold text-[var(--tc-text)]">Docs internas</h2>
              <p className="mt-1 text-sm text-[var(--tc-text-muted)]">
                As pÃ¡ginas em <span className="font-medium">/docs</span> renderizam arquivos Markdown/SQL do repositÃ³rio.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href="/docs"
                  className="rounded-lg bg-[var(--tc-accent,#ef0001)] px-4 py-2 text-sm font-semibold text-[var(--tc-text-inverse,#ffffff)] hover:bg-[var(--tc-accent-hover,#c80001)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--tc-focus)"
                >
                  Abrir /docs
                </Link>
                <Link
                  href="/docs/arquitetura_front"
                  className="rounded-lg border border-[var(--tc-border)] bg-[var(--tc-surface)] px-4 py-2 text-sm text-[var(--tc-text)] hover:bg-[var(--tc-surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--tc-focus)"
                >
                  Arquitetura (Front)
                </Link>
                <Link
                  href="/docs/arquitetura_api"
                  className="rounded-lg border border-[var(--tc-border)] bg-[var(--tc-surface)] px-4 py-2 text-sm text-[var(--tc-text)] hover:bg-[var(--tc-surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--tc-focus)"
                >
                  Arquitetura (API)
                </Link>
                <Link
                  href="/docs/banco_de_dados"
                  className="rounded-lg border border-[var(--tc-border)] bg-[var(--tc-surface)] px-4 py-2 text-sm text-[var(--tc-text)] hover:bg-[var(--tc-surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--tc-focus)"
                >
                  Banco de dados
                </Link>
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--tc-border)] bg-[var(--tc-surface)] p-5">
              <h2 className="text-lg font-semibold text-[var(--tc-text)]">IntegraÃ§Ãµes por empresa</h2>
              <p className="mt-1 text-sm text-[var(--tc-text-muted)]">
                No cadastro de empresa, vocÃª pode escolher:
              </p>
              <ul className="mt-3 list-disc pl-5 text-sm text-[var(--tc-text-muted)] space-y-2">
                <li>
                  <span className="font-medium text-[var(--tc-text)]">Qase</span>: salvar token + project code para automatizar
                  consultas.
                </li>
                <li>
                  <span className="font-medium text-[var(--tc-text)]">Sem integraÃ§Ã£o</span>: modo manual (entrada de runs / kanban
                  manual).
                </li>
              </ul>
              <p className="mt-4 text-xs text-[var(--tc-text-muted)]">
                ObservaÃ§Ã£o: tokens devem ser tratados como segredo e nÃ£o devem ser exibidos em telas pÃºblicas.
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--tc-border)] bg-[var(--tc-surface)] p-5">
            <h2 className="text-lg font-semibold text-[var(--tc-text)]">ReferÃªncia rÃ¡pida</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-[var(--tc-border)] bg-[var(--tc-surface-2)] p-4">
                <p className="text-sm font-semibold text-[var(--tc-text)]">Empresa Ã¢â€ â€™ Qase</p>
                <p className="mt-1 text-sm text-[var(--tc-text-muted)]">
                  Campos usados pela app para resolver configuraÃ§Ã£o: token + project code (ver helper de config).
                </p>
                <Link
                  href="/docs/arquitetura_api"
                  className="mt-3 inline-block text-sm font-semibold text-[var(--tc-accent)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--tc-focus)"
                >
                  Ver detalhes na doc da API
                </Link>
              </div>
              <div className="rounded-xl border border-[var(--tc-border)] bg-[var(--tc-surface-2)] p-4">
                <p className="text-sm font-semibold text-[var(--tc-text)]">Documentos por empresa</p>
                <p className="mt-1 text-sm text-[var(--tc-text-muted)]">
                  Cada empresa tem documentos privados em /empresas/[slug]/documentos (admin acessa todos).
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
  );
}

