"use client";

import dynamic from "next/dynamic";
import { useAutomationModuleContext } from "../_components/AutomationModuleContext";

function LoadingCasesBoard() {
  return (
    <div className="flex h-full w-full animate-pulse flex-col gap-4 p-6">
      <div className="h-10 w-56 rounded-2xl bg-zinc-100" />
      <div className="grid grid-cols-3 gap-4 flex-1">
        <div className="rounded-2xl bg-zinc-100" />
        <div className="rounded-2xl bg-zinc-100" />
        <div className="rounded-2xl bg-zinc-100" />
      </div>
    </div>
  );
}

const AutomationCasesBoard = dynamic(() => import("../AutomationCasesBoard"), {
  ssr: false,
  loading: LoadingCasesBoard,
});

export default function AutomacoesCasosPage() {
  const { access, clients, activeClient } = useAutomationModuleContext();

  return (
    <AutomationCasesBoard
      access={access}
      activeCompanySlug={activeClient?.slug ?? null}
      companies={clients.map((company) => ({ name: company.name, slug: company.slug }))}
    />
  );
}
