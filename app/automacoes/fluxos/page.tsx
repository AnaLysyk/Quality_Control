"use client";

import { useRouter, useSearchParams } from "next/navigation";

import AutomationStudio from "../AutomationStudio";
import { useAutomationModuleContext } from "../_components/AutomationModuleContext";

export default function AutomacoesFluxosPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { access, clients, activeClient } = useAutomationModuleContext();

  return (
    <AutomationStudio
      access={access}
      activeCompanySlug={activeClient?.slug ?? null}
      companies={clients.map((company) => ({ name: company.name, slug: company.slug }))}
      initialFlowId={searchParams.get("flow")}
      onOpenRealRunner={() => router.push("/automacoes/execucoes")}
    />
  );
}
