"use client";

import type { ReactNode } from "react";
import { FiDownload } from "react-icons/fi";

export default function DashboardPrintShell({ children }: { children: ReactNode }) {
  return (
    <div>
      <header className="hidden border-b border-slate-200 pb-4 print:mb-5 print:block">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Relatório</p>
        <h1 className="mt-1 text-2xl font-black text-slate-950">Visão Geral TC</h1>
      </header>
      <div className="fixed bottom-6 right-6 z-50 print:hidden">
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-(--tc-primary,#011848) bg-(--tc-primary,#011848) px-4 py-2 text-sm font-extrabold text-white shadow-lg"
        >
          <FiDownload className="h-4 w-4" /> Gerar PDF
        </button>
      </div>
      {children}
    </div>
  );
}
