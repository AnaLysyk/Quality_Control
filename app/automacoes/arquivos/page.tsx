"use client";

import { useRouter } from "next/navigation";

import AutomationStudio from "../AutomationStudio";
import { useAutomationModuleContext } from "../_components/AutomationModuleContext";

export default function AutomacoesArquivosPage() {
  const router = useRouter();
  const { access, clients, activeClient } = useAutomationModuleContext();

  return (
    <AutomationStudio
      access={access}
      activeCompanySlug={activeClient?.slug ?? null}
      companies={clients.map((company) => ({ name: company.name, slug: company.slug }))}
      onOpenRealRunner={() => router.push("/automacoes/execucoes")}
      mode="files"
    />
  );
}
