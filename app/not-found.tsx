"use client";

import Link from "next/link";

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-(--page-bg,#ffffff) text-(--page-text,#0b1a3c) flex flex-col items-center justify-center px-6 py-16">
      <div className="max-w-xl w-full space-y-6 text-center">
        <p className="text-xs uppercase tracking-[0.4em] text-[var(--tc-accent,#ef0001)]">Erro 404</p>
        <h1 className="text-3xl md:text-4xl font-extrabold">PÃ¡gina nÃ£o encontrada.</h1>
        <p className="text-[var(--tc-text-secondary,#4b5563)]">
          O recurso que vocÃª tentou acessar nÃ£o estÃ¡ disponÃ­vel. Verifique o endereÃ§o ou volte para a pÃ¡gina inicial.
        </p>
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-xl border border-[var(--tc-border,#e5e7eb)] px-4 py-2 text-sm font-semibold text-(--page-text,#0b1a3c) hover:border-[var(--tc-accent,#ef0001)]/60"
          >
            Voltar para home
          </Link>
          <Link
            href="/applications-panel"
            className="inline-flex items-center justify-center rounded-xl bg-[var(--tc-accent,#ef0001)] px-4 py-2 text-sm font-semibold text-white shadow-[var(--tc-accent-soft,rgba(239,0,1,0.12)]) transition hover:brightness-110"
          >
            Ver aplicaÃ§Ãµes
          </Link>
        </div>
      </div>
    </div>
  );
}

