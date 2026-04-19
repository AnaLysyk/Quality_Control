"use client";

import AutomationCompanyTools from "../AutomationCompanyTools";
import { useAutomationModuleContext } from "../_components/AutomationModuleContext";

export default function AutomacoesToolsPage() {
  const { access, clients, activeClient } = useAutomationModuleContext();

  return (
    <AutomationCompanyTools
      access={access}
      activeCompanySlug={activeClient?.slug ?? null}
      companies={clients.map((company) => ({ name: company.name, slug: company.slug }))}
    />
  );
}

