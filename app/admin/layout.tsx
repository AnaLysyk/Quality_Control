"use client";

import Link from "next/link";
import { ReactNode } from "react";
import { RequireGlobalAdmin } from "@/components/RequireGlobalAdmin";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <RequireGlobalAdmin>
      <div className="min-h-screen bg-linear-to-b from-(--page-bg,#f6f8ff) to-(--page-bg,#eef2ff) text-(--page-text,#0b1a3c)">
        <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10">
          <header className="rounded-2xl border border-(--tc-border,#e5e7eb)/60 bg-white/85 px-5 py-4 shadow-sm backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.4em] text-(--tc-accent,#ef0001)">Painel Admin</p>
                <h1 className="text-xl font-semibold text-(--tc-text-primary,#0b1a3c)">Centro de operações</h1>
              </div>
              <nav className="flex flex-wrap items-center gap-2">
                <Link
                  href="/admin/home"
                  className="rounded-xl border border-(--tc-border,#e5e7eb)/80 bg-white px-4 py-2 text-sm font-semibold text-(--tc-text-primary,#0b1a3c) transition hover:bg-(--tc-surface-2,#f3f4f6)"
                >
                  Início
                </Link>
                <Link
                  href="/admin/defeitos"
                  className="rounded-xl border border-(--tc-border,#e5e7eb)/80 bg-white px-4 py-2 text-sm font-semibold text-(--tc-text-primary,#0b1a3c) transition hover:bg-(--tc-surface-2,#f3f4f6)"
                >
                  Defeitos
                </Link>
                <Link
                  href="/admin/requests"
                  className="rounded-xl border border-(--tc-border,#e5e7eb)/80 bg-white px-4 py-2 text-sm font-semibold text-(--tc-text-primary,#0b1a3c) transition hover:bg-(--tc-surface-2,#f3f4f6)"
                >
                  Solicitações
                </Link>
              </nav>
            </div>
          </header>

          <main className="flex-1">
            {children}
          </main>
        </div>
      </div>
    </RequireGlobalAdmin>
  );
}
