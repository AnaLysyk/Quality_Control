export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

export default function DashboardApps() {
  redirect("/empresas");

  return (
    <div className="min-h-screen tc-dark bg-(--tc-bg) text-(--tc-text-inverse) px-6 py-10 md:px-10">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.5em] text-(--tc-accent)">Aplicações</p>
          <h1 className="text-3xl font-bold leading-tight text-(--tc-text-inverse)">Quality Control</h1>
          <p className="text-sm text-(--tc-text-secondary)">Selecione uma aplicação para navegar pelas runs e execuções.</p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" />
      </div>
    </div>
  );
}
