"use client";

import dynamic from "next/dynamic";
import { useAutomationModuleContext } from "../_components/AutomationModuleContext";

function LoadingApiLab() {
  return (
    <div className="flex h-full w-full animate-pulse flex-col gap-4 p-6">
      <div className="h-10 w-48 rounded-2xl bg-zinc-100" />
      <div className="flex flex-1 gap-4">
        <div className="w-64 rounded-2xl bg-zinc-100" />
        <div className="flex-1 rounded-2xl bg-zinc-100" />
      </div>
    </div>
  );
}

const AutomationApiLab = dynamic(() => import("../AutomationApiLab"), {
  ssr: false,
  loading: LoadingApiLab,
});

export default function AutomacoesApiLabPage() {
  const { clients, activeClient } = useAutomationModuleContext();

  return (
    <AutomationApiLab
      activeCompanySlug={activeClient?.slug ?? null}
      companies={clients.map((company) => ({ name: company.name, slug: company.slug }))}
    />
  );
}
