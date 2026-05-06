"use client";

import AutomationApiLab from "../AutomationApiLab";
import { useAutomationModuleContext } from "../_components/AutomationModuleContext";

export default function AutomacoesApiLabPage() {
  const { clients, activeClient } = useAutomationModuleContext();

  return (
    <AutomationApiLab
      activeCompanySlug={activeClient?.slug ?? null}
      companies={clients.map((company) => ({ name: company.name, slug: company.slug }))}
    />
  );
}

