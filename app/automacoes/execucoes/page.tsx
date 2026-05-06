"use client";

import dynamic from "next/dynamic";

import { useAutomationModuleContext } from "../_components/AutomationModuleContext";

const BiometricAutomationRunner = dynamic(() => import("../BiometricAutomationRunner"), {
  loading: () => (
    <div className="h-[520px] animate-pulse rounded-[28px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff)" />
  ),
  ssr: false,
});

export default function AutomacoesExecucoesPage() {
  const { access, clients, activeClient } = useAutomationModuleContext();

  return (
    <div className="space-y-4">
      <BiometricAutomationRunner
        activeCompanySlug={activeClient?.slug ?? null}
        canConfigure={access.canConfigure}
        companies={clients.map((company) => ({ name: company.name, slug: company.slug }))}
      />
    </div>
  );
}

