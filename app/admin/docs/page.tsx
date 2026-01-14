"use client";

import Link from "next/link";
import { RequireGlobalAdmin } from "@/components/RequireGlobalAdmin";

export default function AdminDocsPage() {
  return (
    <RequireGlobalAdmin>
      <div className="min-h-screen bg-(--page-bg,#ffffff) text-(--page-text,#0b1a3c)">
        <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-10 space-y-6">
          <header className="rounded-2xl border border-(--tc-border) bg-(--tc-surface) p-5">
            <p className="text-xs uppercase tracking-[0.35em] text-(--tc-text-muted)">Admin</p>
            <h1 className="mt-1 text-2xl font-bold text-(--tc-text)">Documentação do sistema</h1>
            <p className="mt-2 text-sm text-(--tc-text-muted)">
              Atalhos para documentos internos e referência rápida de como as integrações funcionam.
            </p>
          </header>

          <section className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-(--tc-border) bg-(--tc-surface) p-5">
              <h2 className="text-lg font-semibold text-(--tc-text)">Docs internas</h2>
              <p className="mt-1 text-sm text-(--tc-text-muted)">
                As páginas em <span className="font-medium">/docs</span> renderizam arquivos Markdown/SQL do repositório.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href="/docs"
                  className="rounded-lg bg-(--tc-accent,#ef0001) px-4 py-2 text-sm font-semibold text-(--tc-text-inverse,#ffffff) hover:bg-(--tc-accent-hover,#c80001) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--tc-focus)"
                >
                  Abrir /docs
                </Link>
                <Link
                  href="/docs/arquitetura_front"
                  className="rounded-lg border border-(--tc-border) bg-(--tc-surface) px-4 py-2 text-sm text-(--tc-text) hover:bg-(--tc-surface-2) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--tc-focus)"
                >
                  Arquitetura (Front)
                </Link>
                <Link
                  href="/docs/arquitetura_api"
                  className="rounded-lg border border-(--tc-border) bg-(--tc-surface) px-4 py-2 text-sm text-(--tc-text) hover:bg-(--tc-surface-2) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--tc-focus)"
                >
                  Arquitetura (API)
                </Link>
                <Link
                  href="/docs/banco_de_dados"
                  className="rounded-lg border border-(--tc-border) bg-(--tc-surface) px-4 py-2 text-sm text-(--tc-text) hover:bg-(--tc-surface-2) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--tc-focus)"
                >
                  Banco de dados
                </Link>
              </div>
            </div>

            <div className="rounded-2xl border border-(--tc-border) bg-(--tc-surface) p-5">
              <h2 className="text-lg font-semibold text-(--tc-text)">Integrações por empresa</h2>
              <p className="mt-1 text-sm text-(--tc-text-muted)">
                No cadastro de empresa, você pode escolher:
              </p>
              <ul className="mt-3 list-disc pl-5 text-sm text-(--tc-text-muted) space-y-2">
                <li>
                  <span className="font-medium text-(--tc-text)">Qase</span>: salvar token + project code para automatizar
                  consultas.
                </li>
                <li>
                  <span className="font-medium text-(--tc-text)">Sem integração</span>: modo manual (entrada de runs / kanban
                  manual).
                </li>
              </ul>
              <p className="mt-4 text-xs text-(--tc-text-muted)">
                Observação: tokens devem ser tratados como segredo e não devem ser exibidos em telas públicas.
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-(--tc-border) bg-(--tc-surface) p-5">
            <h2 className="text-lg font-semibold text-(--tc-text)">Referência rápida</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-(--tc-border) bg-(--tc-surface-2) p-4">
                <p className="text-sm font-semibold text-(--tc-text)">Empresa → Qase</p>
                <p className="mt-1 text-sm text-(--tc-text-muted)">
                  Campos usados pela app para resolver configuração: token + project code (ver helper de config).
                </p>
                <Link
                  href="/docs/arquitetura_api"
                  className="mt-3 inline-block text-sm font-semibold text-(--tc-accent) hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--tc-focus)"
                >
                  Ver detalhes na doc da API
                </Link>
              </div>
              <div className="rounded-xl border border-(--tc-border) bg-(--tc-surface-2) p-4">
                <p className="text-sm font-semibold text-(--tc-text)">Documentos por empresa</p>
                <p className="mt-1 text-sm text-(--tc-text-muted)">
                  Cada empresa tem documentos privados em /empresas/[slug]/documentos (admin acessa todos).
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </RequireGlobalAdmin>
  );
}
