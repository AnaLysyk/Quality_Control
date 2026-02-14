"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function Error500Page() {
  const [reloading, setReloading] = useState(false);
  const [requestId, setRequestId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem("lastRequestId");
      if (stored) setRequestId(stored);
    } catch {
      setRequestId(null);
    }
  }, []);

  function handleReload() {
    if (reloading) return;
    setReloading(true);
    setTimeout(() => {
      window.location.reload();
    }, 350);
  }

  return (
    <main
      role="alert"
      className="min-h-screen bg-(--page-bg,#ffffff) text-(--page-text,#0b1a3c) flex flex-col items-center justify-center px-6 py-16"
    >
      <section className="max-w-xl w-full space-y-6 text-center">
        <p className="text-xs uppercase tracking-[0.4em] text-(--tc-accent,#ef0001)">Erro 500</p>
        <h1 className="text-3xl md:text-4xl font-extrabold">Ops! Algo deu errado.</h1>
        <p className="text-(--tc-text-secondary,#4b5563)">
          Encontramos um problema ao carregar esta página. Tente novamente em instantes ou volte para a página inicial.
        </p>
        {requestId ? (
          <p className="text-xs text-(--tc-text-muted,#6b7280)">Ref.: {requestId}</p>
        ) : null}
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-xl border border-(--tc-border,#e5e7eb) px-4 py-2 text-sm font-semibold text-(--page-text,#0b1a3c) transition hover:border-(--tc-accent,#ef0001)/60"
          >
            Voltar para home
          </Link>
          <button
            type="button"
            onClick={handleReload}
            disabled={reloading}
            className="inline-flex items-center justify-center rounded-xl bg-(--tc-accent,#ef0001) px-4 py-2 text-sm font-semibold text-white shadow-(--tc-accent-soft,rgba(239,0,1,0.12)) transition hover:brightness-110 disabled:opacity-60"
          >
            {reloading ? "Recarregando..." : "Tentar novamente"}
          </button>
        </div>
      </section>
    </main>
  );
}
