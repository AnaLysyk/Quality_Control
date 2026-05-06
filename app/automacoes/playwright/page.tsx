"use client";

import dynamic from "next/dynamic";
import { useAutomationModuleContext } from "../_components/AutomationModuleContext";

function LoadingStudio() {
  return (
    <div className="flex h-full w-full bg-[#f3f6fb] dark:bg-zinc-900">
      <div className="w-56 shrink-0 animate-pulse bg-slate-200 dark:bg-zinc-800" />
      <div className="flex-1 animate-pulse bg-slate-100 dark:bg-zinc-900" />
      <div className="w-72 shrink-0 animate-pulse bg-slate-200 dark:bg-zinc-800" />
    </div>
  );
}

const PlaywrightStudio = dynamic(() => import("./PlaywrightStudio"), {
  ssr: false,
  loading: LoadingStudio,
});

export default function PlaywrightStudioPage() {
  const { clients, activeClient } = useAutomationModuleContext();

  return (
    <div className="h-full min-h-0 w-full">
      <PlaywrightStudio
        activeCompanySlug={activeClient?.slug ?? null}
        companies={clients.map((c) => ({ name: c.name, slug: c.slug }))}
      />
    </div>
  );
}
