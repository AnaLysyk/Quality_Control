"use client";

import AutomationCasesBoard from "../AutomationCasesBoard";
import { useAutomationModuleContext } from "../_components/AutomationModuleContext";

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

