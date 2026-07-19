"use client";

import type { ReactNode } from "react";
import { FiDownload } from "react-icons/fi";

export default function DashboardPrintShell({ children }: { children: ReactNode }) {
  return (
    <div className="dashboard-pdf-root">
      <style jsx global>{`
        @media print {
          .dashboard-pdf-root button,
          .dashboard-pdf-root input,
          .dashboard-pdf-root select {
            display: none !important;
          }
          .dashboard-pdf-root section,
          .dashboard-pdf-root article,
          .dashboard-pdf-root aside,
          .dashboard-pdf-root tr {
            break-inside: avoid;
          }
        }
      `}</style>
      <header className="hidden border-b border-slate-200 pb-4 print:mb-5 print:block">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Relatório</p>
        <h1 className="mt-1 text-2xl font-black text-slate-950">Visão Geral TC</h1>
      </header>
      <section className="mx-auto mt-4 w-full max-w-[1480px] rounded-2xl border border-slate-200 bg-white px-5 py-4 text-slate-900 shadow-sm print:mt-0 print:shadow-none">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Leitura executiva</p>
        <h2 className="mt-1 text-lg font-black">O que decidir neste painel</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Use esta visão para priorizar empresas críticas, revisar filas em atenção, identificar falhas ou bloqueios e direcionar a atuação de Líder TC e Administrador.
        </p>
      </section>
      <div className="fixed bottom-6 right-6 z-50 print:hidden">
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-[var(--tc-primary,#011848)] bg-[var(--tc-primary,#011848)] px-4 py-2 text-sm font-extrabold text-white shadow-lg"
        >
          <FiDownload className="h-4 w-4" /> Gerar PDF
        </button>
      </div>
      {children}
    </div>
  );
}

