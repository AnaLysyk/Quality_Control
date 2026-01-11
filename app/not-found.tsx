"use client";

import Link from "next/link";

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-(--page-bg,#ffffff) text-(--page-text,#0b1a3c) flex flex-col items-center justify-center px-6 py-16">
      <div className="max-w-xl w-full space-y-6 text-center">
        <p className="text-xs uppercase tracking-[0.4em] text-(--tc-accent,#ef0001)">Erro 404</p>
        <h1 className="text-3xl md:text-4xl font-extrabold">Página não encontrada.</h1>
        <p className="text-(--tc-text-secondary,#4B5563)">
          O recurso que você tentou acessar não está disponível. Verifique o endereço ou volte para a página inicial.
        </p>
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-xl border border-(--tc-border,#e5e7eb) px-4 py-2 text-sm font-semibold text-(--page-text,#0b1a3c) hover:border-(--tc-accent,#ef0001)/60"
          >
            Voltar para home
          </Link>
          <Link
            href="/applications"
            className="inline-flex items-center justify-center rounded-xl bg-(--tc-accent,#ef0001) px-4 py-2 text-sm font-semibold text-white shadow-(--tc-accent-soft,rgba(239,0,1,0.12)) transition hover:brightness-110"
          >
            Ver aplicações
          </Link>
        </div>
      </div>
    </div>
  );
}
